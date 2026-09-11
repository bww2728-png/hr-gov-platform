/**
 * Payroll Engine - مسيرات الرواتب، GOSI، السلف، المكافآت، EOS، WPS (معاملات 50-56, 70)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const policyStore = require('../utils/policyStore');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const saudi = require('../utils/saudiRules');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;
const D = (n) => Math.round(Number(n) * 100) / 100;

// ============ مسيرات الرواتب ============
router.get('/runs', requirePerm('payroll.read'), async (req, res, next) => {
  try {
    const runs = await prisma.payrollRun.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 60 });
    res.json({ runs });
  } catch (e) { next(e); }
});

router.post('/runs', requirePerm('payroll.prepare'), async (req, res, next) => {
  try {
    const { month, year } = z.object({ month: z.number().int().min(1).max(12), year: z.number().int().min(2020).max(2100) }).parse(req.body);
    const code = `PAY-${year}-${String(month).padStart(2, '0')}`;
    const existing = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } } });
    if (existing) return res.status(409).json({ error: 'يوجد مسير لهذا الشهر بالفعل', run: existing });
    const run = await prisma.payrollRun.create({ data: { code, month, year, preparedById: req.user.id } });
    audit(req, 'payroll.run.create', { entityType: 'payroll_run', entityId: String(run.id), afterJson: run });
    res.status(201).json({ run });
  } catch (e) { next(e); }
});

/**
 * حساب المسير: لكل موظف نشط:
 * الأساسي + بدلات + إضافي معتمد + مكافآت معتمدة − GOSI (9.75% موظف) − أقساط سلف − خصم غياب
 */
router.post('/runs/:id/calculate', requirePerm('payroll.prepare'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: 'المسير غير موجود' });
    // مسيرات مقفولة (مصروف/مؤرشف) — ممنوع التعديل أو إعادة الحساب نهائياً (P0-04)
    if (['paid', 'archived'].includes(run.status)) {
      return res.status(403).json({ error: 'مسير مقفول — التعديل والإعادة الحساب ممنوعان (P0-04)؛ استخدم طلب تعديل فترة عبر workflow الاعتمادات' });
    }
    if (run.status !== 'draft') return res.status(400).json({ error: 'لا يمكن الحساب إلا لمسير مسودة' });

    const employees = await prisma.employee.findMany({ where: { employmentStatus: 'active', deletedAt: null } });
    const monthStart = new Date(run.year, run.month - 1, 1);
    const monthEnd = new Date(run.year, run.month, 0);

    // تثبيت قيم السياسات المالية لحظة الحساب (إعادة إنتاج تاريخية مضمونة)
    const paramsSnapshot = await policyStore.snapshot();
    const otMultiplier = policyStore.valueFrom(paramsSnapshot, 'overtime.multiplier');
    const absenceDivisor = policyStore.valueFrom(paramsSnapshot, 'absence.dailyDivisor');
    const lateMultiplier = policyStore.valueFrom(paramsSnapshot, 'attendance.lateDeductionMultiplier');
    const hourlyDivisor = policyStore.valueFrom(paramsSnapshot, 'payroll.hourlyDivisor');

    const result = await prisma.$transaction(async (tx) => {
      await tx.payrollItem.deleteMany({ where: { runId: id } });
      let totalGross = 0; let totalNet = 0; let totalGosi = 0;

      for (const emp of employees) {
        const base = Number(emp.salary) || 0;
        const housing = D(Number(emp.housingAllowance) || 0);
        const transport = D(Number(emp.transportAllowance) || 0);
        const otherAllow = D(Number(emp.otherAllowances) || 0);

        // العمل الإضافي المعتمد هذا الشهر
        const ot = await tx.overtimeRequest.aggregate({
          _sum: { hours: true },
          where: { employeeId: emp.id, status: 'approved', date: { gte: monthStart, lte: monthEnd } },
        });
        const hourlyRate = base / 240; // 30 يوم × 8 ساعات
        const overtimePay = D((ot._sum.hours || 0) * hourlyRate * otMultiplier);

        // المكافآت المعتمدة غير المصروفة؛ ربطها بالمسير يتم بعد الدفع.
        const bonuses = await tx.bonus.findMany({ where: { employeeId: emp.id, status: 'approved', payrollRunId: null } });
        const bonusPay = D(bonuses.reduce((s, b) => s + Number(b.amount), 0));

        // GOSI المتدرج القانوني: أجر خاضع = clamp(أساسي+سكن أو الأجر المسجل، 1500، 45000)
        // النسب حسب تاريخ التسجيل وسنة الشهر (P0-02) — من snapshot المعاملات
        const gosi = saudi.gosiTier({
          nationality: emp.nationality,
          gosiRegistrationDate: emp.gosiRegistrationDate,
          basicSalary: base,
          housingAllowance: housing,
          gosiSubscriptionWage: emp.gosiSubscriptionWage,
          month: { year: run.year, month: run.month },
          snap: paramsSnapshot,
        });

        // أقساط السلف النشطة؛ تحديث الرصيد يتم فقط بعد اعتماد/دفع المسير.
        const loans = await tx.loan.findMany({ where: { employeeId: emp.id, status: 'active' } });
        const loanDeduct = D(loans.reduce(
          (sum, loan) => sum + Math.min(Number(loan.monthlyDeduct), Number(loan.remaining)),
          0
        ));

        // خصم الغياب (أيام × معدل يومي)
        const absences = await tx.attendanceRecord.count({
          where: { employeeId: emp.id, status: 'absent', date: { gte: monthStart, lte: monthEnd } },
        });
        const absenceDeduct = D(absences * (base / absenceDivisor));

        // خصم التأخر النقدي (P0-08): مجموع دقائق التأخر الفعلية بالشهر × (الأساسي/240)/60 × المعامل
        const lateAgg = await tx.attendanceRecord.aggregate({
          _sum: { lateMins: true },
          where: { employeeId: emp.id, date: { gte: monthStart, lte: monthEnd } },
        });
        const lateDeduct = D(saudi.lateDeduction(lateAgg._sum.lateMins || 0, base, lateMultiplier, hourlyDivisor));

        const gross = D(base + housing + transport + otherAllow + overtimePay + bonusPay);
        const net = D(gross - gosi.employee - loanDeduct - absenceDeduct - lateDeduct);

        await tx.payrollItem.create({
          data: {
            runId: id, employeeId: emp.id,
            baseSalary: base, housing, transport, otherAllow, overtimePay, bonusPay,
            gosiEmployee: gosi.employee, gosiEmployer: gosi.employer,
            loanDeduct, absenceDeduct, lateDeduct, gross, net, iban: emp.iban || null,
          },
        });
        totalGross += gross; totalNet += net; totalGosi += gosi.employer;
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'calculated', totalGross: D(totalGross), totalNet: D(totalNet), totalGosi: D(totalGosi), paramsSnapshotJson: paramsSnapshot },
      });
    });

    audit(req, 'payroll.run.calculate', { entityType: 'payroll_run', entityId: String(id) });
    res.json({ run: result });
  } catch (e) { next(e); }
});

router.post('/runs/:id/review', requirePerm('payroll.review'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run || run.status !== 'calculated') return res.status(400).json({ error: 'المسير ليس بحالة محسوب' });
    const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'reviewed', reviewedById: req.user.id } });
    audit(req, 'payroll.run.review', { entityType: 'payroll_run', entityId: String(id) });
    res.json({ run: updated });
  } catch (e) { next(e); }
});

router.post('/runs/:id/approve', requirePerm('payroll.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run || run.status !== 'reviewed') return res.status(400).json({ error: 'المسير يحتاج مراجعة أولاً' });
    // موعد WPS النظامي: يوم uploadByDay من الشهر التالي (P0-05)
    const uploadByDay = Math.max(1, Math.min(28, Number(policyStore.get('wps.uploadByDay')) || 10));
    const wpsDeadline = new Date(run.month === 12 ? run.year + 1 : run.year, run.month === 12 ? 0 : run.month, uploadByDay, 0, 0, 0);
    const updated = await prisma.payrollRun.update({
      where: { id },
      data: { status: 'approved', approvedById: req.user.id, wpsDeadline, wpsStatus: run.wpsStatus || 'pending' },
    });
    audit(req, 'payroll.run.approve', { entityType: 'payroll_run', entityId: String(id), afterJson: { wpsDeadline: wpsDeadline.toISOString() } });
    res.json({ run: updated });
  } catch (e) { next(e); }
});

router.post('/runs/:id/pay', requirePerm('payroll.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run || run.status !== 'approved') return res.status(400).json({ error: 'المسير يحتاج اعتماداً أولاً' });
    const updated = await prisma.$transaction(async (tx) => {
      const paidRes = await tx.payrollRun.updateMany({
        where: { id, status: 'approved' },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (paidRes.count === 0) {
        const err = new Error('تم الدفع مسبقاً أو الحالة غير صالحة');
        err.status = 409;
        throw err;
      }
      const items = await tx.payrollItem.findMany({ where: { runId: id } });
      for (const item of items) {
        const loans = await tx.loan.findMany({ where: { employeeId: item.employeeId, status: 'active' } });
        let remainingDeduction = Number(item.loanDeduct);
        for (const loan of loans) {
          if (remainingDeduction <= 0) break;
          const deduction = Math.min(Number(loan.monthlyDeduct), Number(loan.remaining), remainingDeduction);
          const remaining = D(Number(loan.remaining) - deduction);
          remainingDeduction = D(remainingDeduction - deduction);
          await tx.loan.update({
            where: { id: loan.id },
            data: { remaining, status: remaining <= 0 ? 'settled' : 'active' },
          });
          await tx.payrollLedgerEntry.create({
            data: {
              runId: id,
              employeeId: item.employeeId,
              kind: 'loan_deduction',
              refId: loan.id,
              amount: deduction,
            },
          });
        }
      }
      const bonuses = await tx.bonus.findMany({
        where: {
          payrollRunId: null,
          status: 'approved',
          employeeId: { in: items.map((item) => item.employeeId) },
        },
      });
      if (bonuses.length) {
        await tx.bonus.updateMany({
          where: { id: { in: bonuses.map((bonus) => bonus.id) } },
          data: { status: 'paid', payrollRunId: id },
        });
        for (const bonus of bonuses) {
          await tx.payrollLedgerEntry.create({
            data: {
              runId: id,
              employeeId: bonus.employeeId,
              kind: 'bonus_payment',
              refId: bonus.id,
              amount: bonus.amount,
            },
          });
        }
      }
      return tx.payrollRun.findUnique({ where: { id } });
    });
    audit(req, 'payroll.run.pay', { entityType: 'payroll_run', entityId: String(id) });
    res.json({ run: updated });
  } catch (e) { next(e); }
});

router.get('/runs/:id/ledger', requirePerm('payroll.read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) return res.status(404).json({ error: 'المسير غير موجود' });
    const entries = await prisma.payrollLedgerEntry.findMany({
      where: { runId: id },
      orderBy: { createdAt: 'asc' },
    });
    const totals = entries.reduce((acc, e) => {
      if (e.kind === 'loan_deduction') acc.loanDeductions = D(acc.loanDeductions + Number(e.amount));
      if (e.kind === 'bonus_payment') acc.bonusPayments = D(acc.bonusPayments + Number(e.amount));
      return acc;
    }, { loanDeductions: 0, bonusPayments: 0 });
    res.json({ run: { id: run.id, code: run.code, status: run.status, paidAt: run.paidAt }, totals, entries });
  } catch (e) { next(e); }
});

router.get('/runs/:id/items', requirePerm('payroll.read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const items = await prisma.payrollItem.findMany({ where: { runId: id }, orderBy: { id: 'asc' } });
    const empIds = items.map((i) => i.employeeId);
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ items: items.map((i) => ({ ...i, employee: map[i.employeeId] || null })) });
  } catch (e) { next(e); }
});

// قسيمة الراتب الذاتية
router.get('/payslips/me', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.json({ payslips: [] }); // حساب بلا ملف موظف (مثل مدير المنصة)
    const items = await prisma.payrollItem.findMany({
      where: { employeeId: empId, run: { status: { in: ['approved', 'paid'] } } },
      include: { run: true },
      orderBy: { id: 'desc' },
      take: 24,
    });
    res.json({ payslips: items });
  } catch (e) { next(e); }
});

// ============ السلف والقروض ============
router.get('/loans', requirePerm('loans.read'), async (req, res, next) => {
  try {
    const loans = await prisma.loan.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(loans.map((l) => l.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ loans: loans.map((l) => ({ ...l, employee: map[l.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.get('/loans/me', async (req, res, next) => {
  try {
    const empId = selfId(req);
    const loans = await prisma.loan.findMany({ where: { employeeId: empId }, orderBy: { createdAt: 'desc' } });
    res.json({ loans });
  } catch (e) { next(e); }
});

router.post('/loans', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const data = z.object({
      amount: z.number().positive().max(500000), months: z.number().int().min(1).max(60),
      reason: z.string().max(500).optional(),
    }).parse(req.body);
    const activeLoans = await prisma.loan.count({ where: { employeeId: empId, status: 'active' } });
    if (activeLoans > 0) return res.status(400).json({ error: 'يوجد سلفة نشطة — لا يمكن طلب سلفة جديدة قبل سداد الحالية' });
    const loan = await prisma.loan.create({
      data: {
        employeeId: empId, amount: data.amount, months: data.months,
        monthlyDeduct: D(data.amount / data.months), remaining: data.amount, reason: data.reason || null,
      },
    });
    audit(req, 'loan.create', { entityType: 'loan', entityId: String(loan.id), afterJson: loan });
    res.status(201).json({ loan });
  } catch (e) { next(e); }
});

router.post('/loans/:id/decision', requirePerm('loans.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan || loan.status !== 'pending') return res.status(400).json({ error: 'السلفة ليست معلقة' });
    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: decision === 'approve' ? 'active' : 'rejected',
        approvedById: req.user.id,
        startDate: decision === 'approve' ? new Date() : null,
      },
    });
    audit(req, `loan.${decision}`, { entityType: 'loan', entityId: String(id) });
    res.json({ loan: updated });
  } catch (e) { next(e); }
});

// ============ المكافآت ============
router.get('/bonuses', requirePerm('bonuses.read'), async (req, res, next) => {
  try {
    const bonuses = await prisma.bonus.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(bonuses.map((b) => b.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ bonuses: bonuses.map((b) => ({ ...b, employee: map[b.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/bonuses', requirePerm('bonuses.nominate'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), amount: z.number().positive(),
      type: z.enum(['performance', 'annual', 'exceptional', 'eid']),
      reason: z.string().max(500).optional(),
    }).parse(req.body);
    const bonus = await prisma.bonus.create({ data: { ...data, nominatedById: req.user.id } });
    audit(req, 'bonus.nominate', { entityType: 'bonus', entityId: String(bonus.id), afterJson: bonus });
    res.status(201).json({ bonus });
  } catch (e) { next(e); }
});

router.post('/bonuses/:id/decision', requirePerm('bonus.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
    const bonus = await prisma.bonus.findUnique({ where: { id } });
    if (!bonus || bonus.status !== 'pending') return res.status(400).json({ error: 'المكافأة ليست معلقة' });
    const updated = await prisma.bonus.update({ where: { id }, data: { status: decision === 'approve' ? 'approved' : 'rejected' } });
    audit(req, `bonus.${decision}`, { entityType: 'bonus', entityId: String(id) });
    res.json({ bonus: updated });
  } catch (e) { next(e); }
});

// ============ نهاية الخدمة (م84/85 — المحرك القانوني الموحد) ============
router.post('/eos/calculate', requirePerm('eos.calculate'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      reason: z.enum(['resignation', 'termination', 'retirement', 'end_fixed_contract', 'death', 'disability', 'force_majeure', 'article80']),
      endDate: z.string().optional(),
      otherDues: z.number().optional(),
    }).parse(req.body);
    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    // الأجر المعتمد للـEOS = الأساسي + السكن + البدلات الثابتة المنتظمة (م84)
    const wage = D((Number(emp.salary) || 0) + (Number(emp.housingAllowance) || 0) + (Number(emp.transportAllowance) || 0) + (Number(emp.otherAllowances) || 0));
    const calc = saudi.calculateEOS({
      hireDate: emp.hireDate,
      endDate: data.endDate ? new Date(data.endDate) : (emp.lastWorkingDate ? new Date(emp.lastWorkingDate) : new Date()),
      wage,
      reason: data.reason,
    });
    const otherDues = D(data.otherDues || 0);
    const eos = await prisma.eosCalculation.create({
      data: {
        employeeId: emp.id, reason: data.reason, serviceYears: calc.years,
        lastSalary: wage, eosAmount: calc.eosAmount,
        otherDues, totalPayable: D(calc.eosAmount + otherDues),
        formulaJson: calc, calculatedById: req.user.id,
      },
    });
    audit(req, 'eos.calculate', { entityType: 'eos_calculation', entityId: String(eos.id), afterJson: eos });
    res.status(201).json({ eos, breakdown: calc });
  } catch (e) { next(e); }
});

// ============ تقرير GOSI الشهري (P0-02): الخاضع والنسب والإجمالي ومقارنة الشهر السابق ============
router.get('/gosi-report', requirePerm('payroll.read'), async (req, res, next) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || (now.getMonth() === 0 ? 12 : now.getMonth());
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;

    const run = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } }, include: { items: true } });
    if (!run) return res.status(404).json({ error: 'لا يوجد مسير لهذا الشهر — أنشئه واحسبه أولاً' });
    const prevRun = await prisma.payrollRun.findUnique({ where: { month_year: { month: prevMonth, year: prevYear } }, include: { items: true } });

    const emps = await prisma.employee.findMany({
      where: { id: { in: run.items.map((i) => i.employeeId) } },
      select: { id: true, fullNameAr: true, employeeNumber: true, nationality: true, gosiRegistrationDate: true, gosiSubscriptionWage: true, salary: true, housingAllowance: true },
    });
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
    const prevItemMap = Object.fromEntries((prevRun ? prevRun.items : []).map((i) => [i.employeeId, i]));

    const paramsSnapshot = run.paramsSnapshotJson || null;
    const rows = run.items.map((item) => {
      const emp = empMap[item.employeeId] || {};
      const tier = saudi.gosiTier({
        nationality: emp.nationality,
        gosiRegistrationDate: emp.gosiRegistrationDate,
        basicSalary: Number(emp.salary) || 0,
        housingAllowance: Number(emp.housingAllowance) || 0,
        gosiSubscriptionWage: emp.gosiSubscriptionWage,
        month: { year, month },
        snap: paramsSnapshot,
      });
      const prev = prevItemMap[item.employeeId];
      return {
        employeeId: item.employeeId,
        name: emp.fullNameAr, employeeNumber: emp.employeeNumber,
        tier: tier.tier, needsRegistrationDate: tier.needsRegistrationDate,
        wageSubject: tier.wage, wageRaw: tier.wageRaw, clamped: tier.clamped,
        employeePct: tier.employeePct, employerPct: tier.employerPct,
        employeeShare: item.gosiEmployee, employerShare: item.gosiEmployer,
        prevEmployeeShare: prev ? prev.gosiEmployee : null,
        deltaVsPrev: prev ? D(item.gosiEmployee - prev.gosiEmployee) : null,
      };
    });
    res.json({
      year, month,
      totals: {
        employees: rows.length,
        wageSubject: D(rows.reduce((s, r) => s + r.wageSubject, 0)),
        employeeShare: D(rows.reduce((s, r) => s + r.employeeShare, 0)),
        employerShare: D(rows.reduce((s, r) => s + r.employerShare, 0)),
      },
      needsRegistrationDate: rows.filter((r) => r.needsRegistrationDate).map((r) => ({ employeeId: r.employeeId, name: r.name })),
      rows,
    });
  } catch (e) { next(e); }
});

router.get('/eos', requirePerm('eos.read'), async (req, res, next) => {
  try {
    const list = await prisma.eosCalculation.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const empIds = [...new Set(list.map((e) => e.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ calculations: list.map((e) => ({ ...e, employee: map[e.employeeId] || null })) });
  } catch (e) { next(e); }
});

// ============ حماية الأجور WPS (معاملة 70) ============
router.get('/wps', requirePerm('wps.read'), async (req, res, next) => {
  try {
    const files = await prisma.wpsFile.findMany({ orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 36 });
    res.json({ files });
  } catch (e) { next(e); }
});

/** لوحة WPS: مواعيد كل مسير معتمد/مصروف + الأيام المتبقية + تقدير العقوبات (P0-05) */
router.get('/wps/dashboard', requirePerm('wps.read'), async (req, res, next) => {
  try {
    const runs = await prisma.payrollRun.findMany({
      where: { status: { in: ['approved', 'paid'] } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 24,
    });
    const itemCounts = await prisma.payrollItem.groupBy({ by: ['runId'], _count: { id: true }, where: { runId: { in: runs.map((r) => r.id) } } });
    const countMap = Object.fromEntries(itemCounts.map((c) => [c.runId, c._count.id]));
    const now = new Date();
    const rows = runs.map((r) => {
      const deadline = r.wpsDeadline ? new Date(r.wpsDeadline) : null;
      const daysLeft = deadline ? Math.ceil((deadline - now) / 86400000) : null;
      const employees = countMap[r.id] || 0;
      // العقوبات المتوقعة حسب التأخر بعد الموعد (تقدير نظامي: 3000/6000/10000 × عدد الموظفين)
      let penalty = 0; let penaltyBand = null;
      if (daysLeft != null && daysLeft < 0 && !['uploaded', 'accepted'].includes(r.wpsStatus)) {
        const lateDays = -daysLeft;
        penaltyBand = lateDays <= 10 ? '3000' : lateDays <= 20 ? '6000' : '10000';
        penalty = employees * Number(penaltyBand);
      }
      return {
        runId: r.id, code: r.code, month: r.month, year: r.year,
        status: r.status, wpsStatus: r.wpsStatus || 'pending',
        wpsDeadline: deadline, daysLeft, employees,
        totalNet: r.totalNet, penalty, penaltyBand,
        wpsFileGeneratedAt: r.wpsFileGeneratedAt, wpsUploadedAt: r.wpsUploadedAt,
      };
    });
    res.json({ rows, today: now.toISOString().slice(0, 10) });
  } catch (e) { next(e); }
});

/** تنبيهات WPS المحفوظة (تستخدمها اللوحة وواجهة التنبيهات) */
router.get('/wps/notifications', requirePerm('wps.read'), async (req, res, next) => {
  try {
    const roleKey = req.user.role?.key || req.user.role?.name || null;
    const notifications = await prisma.systemNotification.findMany({
      where: { OR: [{ roleKey: { in: roleKey ? [roleKey, 'sysadmin'] : ['sysadmin'] } }, { userId: req.user.id }] },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    res.json({ notifications });
  } catch (e) { next(e); }
});

/**
 * توليد ملف WPS/SIF بصيغة حماية الأجور السعودية (P0-05):
 * مطابقة ثلاثية (بنود المسير ↔ أجر اشتراك التأمينات ↔ عقد/قوى عبر طبقة الربط) ثم
 * سجل تفاصيل لكل موظف + سجل ملخص برأس المنشأة والإجماليات.
 * بلا بيانات اعتماد قوى: فحص العقد يعيد "غير متاح — بانتظار الربط" ولا يمنع التوليد،
 * وأي اختلاف حقيقي في المطابقة يمنع التوليد (409).
 */
router.post('/wps/generate', requirePerm('wps.write'), async (req, res, next) => {
  try {
    const { month, year } = z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).parse(req.body);
    const run = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } }, include: { items: true } });
    if (!run || !['approved', 'paid'].includes(run.status)) {
      return res.status(400).json({ error: 'لا يوجد مسير معتمد لهذا الشهر لتوليد ملف WPS' });
    }
    // ==== المطابقة الثلاثية ====
    const empIds = run.items.map((i) => i.employeeId);
    const emps = await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, fullNameAr: true, nationalId: true, iqamaNumber: true, nationality: true, iban: true, bankName: true, bankAccount: true, salary: true, housingAllowance: true, gosiSubscriptionWage: true, employmentStatus: true },
    });
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
    const mismatches = []; const contractChecks = []; const missingIban = [];
    for (const item of run.items) {
      const emp = empMap[item.employeeId];
      if (!emp) { mismatches.push({ employeeId: item.employeeId, reason: 'الموظف غير موجود' }); continue; }
      if (!emp.iban && !emp.bankAccount) missingIban.push(emp.fullNameAr);
      // 1) البند ↔ أجر الاشتراك المسجل: إعادة حساب الأجر الخاضع ومقارنة نصيب الموظف
      const tier = saudi.gosiTier({
        nationality: emp.nationality, gosiRegistrationDate: emp.gosiRegistrationDate,
        basicSalary: Number(emp.salary) || 0, housingAllowance: Number(emp.housingAllowance) || 0,
        gosiSubscriptionWage: emp.gosiSubscriptionWage,
        month: { year, month }, snap: run.paramsSnapshotJson,
      });
      if (D(Number(item.gosiEmployee) - Number(tier.employee)) !== 0) {
        mismatches.push({ employeeId: emp.id, name: emp.fullNameAr, reason: `نصيب التأمينات بالمسير (${item.gosiEmployee}) يختلف عن المعاد القانوني (${tier.employee})` });
      }
      // 2) العقد/قوى — طبقة الربط غير مربوطة بعد: حالة موثقة لا تمنع
      contractChecks.push({ employeeId: emp.id, name: emp.fullNameAr, status: 'unavailable', note: 'غير مربوط — بانتظار اعتماد بيانات قوى' });
    }
    if (mismatches.length) {
      audit(req, 'wps.generate.blocked', { entityType: 'payroll_run', entityId: String(run.id), afterJson: { mismatches } });
      return res.status(409).json({ error: 'فروقات في المطابقة الثلاثية — منع الرفع', mismatches });
    }
    if (missingIban.length) {
      return res.status(409).json({ error: 'موظفون بلا IBAN — لا يمكن توليد الملف', employees: missingIban });
    }

    // ==== ملف SIF (سجل تفاصيل لكل موظف + سجل ملخص) ====
    const money = (v) => D(v).toFixed(2);
    const details = run.items.map((item) => {
      const emp = empMap[item.employeeId];
      const identity = emp.iqamaNumber || emp.nationalId || '';
      return {
        identity, identityType: emp.iqamaNumber ? 'iqama' : 'national_id',
        name: emp.fullNameAr, iban: emp.iban || emp.bankAccount || '',
        bank: emp.bankName || '',
        basic: money(item.baseSalary), housing: money(item.housing), transport: money(item.transport),
        other: money(D(item.otherAllow + item.overtimePay + item.bonusPay)),
        deductions: money(D(item.gosiEmployee + item.loanDeduct + item.absenceDeduct + item.lateDeduct + item.otherDeduct)),
        net: money(item.net), days: 30,
      };
    });
    const summary = {
      period: `${year}-${String(month).padStart(2, '0')}`,
      recordCount: details.length,
      totalBasic: money(run.items.reduce((s, i) => s + Number(i.baseSalary), 0)),
      totalHousing: money(run.items.reduce((s, i) => s + Number(i.housing), 0)),
      totalTransport: money(run.items.reduce((s, i) => s + Number(i.transport), 0)),
      totalOther: money(run.items.reduce((s, i) => s + Number(D(i.otherAllow + i.overtimePay + i.bonusPay)), 0)),
      totalDeductions: money(run.items.reduce((s, i) => s + Number(D(i.gosiEmployee + i.loanDeduct + i.absenceDeduct + i.lateDeduct + i.otherDeduct)), 0)),
      totalNet: money(run.totalNet),
    };

    // CSV بترميز UTF-8 مع BOM (قراءة صحيحة في Excel) — تفاصيل ثم ملخص
    const head = 'period,identity,identity_type,name,iban,bank,basic,housing,transport,other_allowances,total_deductions,net,days';
    const csvLines = [head];
    for (const d of details) {
      csvLines.push([summary.period, d.identity, d.identityType, d.name.replace(/,/g, '،'), d.iban, d.bank.replace(/,/g, '،'), d.basic, d.housing, d.transport, d.other, d.deductions, d.net, d.days].join(','));
    }
    csvLines.push('');
    csvLines.push(`#SUMMARY,period=${summary.period},records=${summary.recordCount},total_basic=${summary.totalBasic},total_housing=${summary.totalHousing},total_transport=${summary.totalTransport},total_other=${summary.totalOther},total_deductions=${summary.totalDeductions},total_net=${summary.totalNet}`);
    const csv = '\uFEFF' + csvLines.join('\r\n');

    const fileRef = `SIF-WPS-${year}-${String(month).padStart(2, '0')}-${Date.now()}`;
    const [file] = await prisma.$transaction([
      prisma.wpsFile.upsert({
        where: { month_year: { month, year } },
        create: { payrollRunId: run.id, month, year, fileRef, status: 'generated' },
        update: { payrollRunId: run.id, fileRef, status: 'generated' },
      }),
      prisma.payrollRun.update({
        where: { id: run.id },
        data: { wpsStatus: 'generated', wpsFileGeneratedAt: new Date(), wpsDeadline: run.wpsDeadline || new Date(year + (month === 12 ? 1 : 0), month === 12 ? 0 : month, Math.max(1, Math.min(28, Number(policyStore.get('wps.uploadByDay')) || 10))) },
      }),
    ]);
    audit(req, 'wps.generate', { entityType: 'wps_file', entityId: String(file.id), afterJson: { fileRef, recordCount: details.length, contractChecks: contractChecks.length } });
    res.status(201).json({ file, csv, summary, recordCount: details.length, contractChecks });
  } catch (e) { next(e); }
});

router.post('/wps/:id/status', requirePerm('wps.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.enum(['uploaded', 'confirmed', 'failed']) }).parse(req.body);
    const file = await prisma.$transaction(async (tx) => {
      const f = await tx.wpsFile.update({
        where: { id },
        data: { status, uploadedAt: status === 'uploaded' ? new Date() : undefined, confirmedAt: status === 'confirmed' ? new Date() : undefined },
      });
      // رفع/تأكيد الملف يحدّث حالة المسير (P0-05)
      if (f.payrollRunId) {
        await tx.payrollRun.update({
          where: { id: f.payrollRunId },
          data: {
            wpsStatus: status === 'uploaded' ? 'uploaded' : status === 'confirmed' ? 'accepted' : 'rejected',
            wpsUploadedAt: status === 'uploaded' ? new Date() : undefined,
          },
        });
      }
      return f;
    });
    audit(req, 'wps.status', { entityType: 'wps_file', entityId: String(id), afterJson: { status } });
    res.json({ file });
  } catch (e) { next(e); }
});

// ============ تعديلات الفترات المقفولة (P0-04): HR ← مالي ← CEO ============
router.get('/adjustments', requirePerm('adjustments.read'), async (req, res, next) => {
  try {
    const list = await prisma.periodAdjustmentRequest.findMany({
      orderBy: { createdAt: 'desc' }, take: 100,
    });
    const runs = await prisma.payrollRun.findMany({ where: { id: { in: list.map((a) => a.payrollRunId) } }, select: { id: true, code: true, month: true, year: true, status: true } });
    const runMap = Object.fromEntries(runs.map((r) => [r.id, r]));
    res.json({ adjustments: list.map((a) => ({ ...a, run: runMap[a.payrollRunId] || null })) });
  } catch (e) { next(e); }
});

router.post('/adjustments', requirePerm('adjustments.request'), async (req, res, next) => {
  try {
    const data = z.object({
      payrollRunId: z.number().int().positive(),
      reason: z.string().min(5).max(500),
      items: z.array(z.object({
        employeeId: z.string().uuid(),
        kind: z.enum(['reversal_loan', 'reversal_bonus', 'late_deduction', 'absence_deduction', 'other']),
        amount: z.number(),
        note: z.string().max(300).optional(),
      })).min(1),
    }).parse(req.body);
    const run = await prisma.payrollRun.findUnique({ where: { id: data.payrollRunId } });
    if (!run) return res.status(404).json({ error: 'المسير غير موجود' });
    if (!['paid', 'archived'].includes(run.status)) {
      return res.status(400).json({ error: 'التعديل عبر الطلب مخصص للمسيرات المقفولة (مصروف/مؤرشف) — المسيرات السارية تُعدّل مباشرة بصلاحياتها' });
    }
    const dup = await prisma.periodAdjustmentRequest.findFirst({ where: { payrollRunId: data.payrollRunId, status: 'pending' } });
    if (dup) return res.status(409).json({ error: 'يوجد طلب معلق لنفس المسير' });
    const request = await prisma.periodAdjustmentRequest.create({
      data: { payrollRunId: data.payrollRunId, reason: data.reason, payloadJson: { items: data.items }, requestedById: req.user.id },
    });
    audit(req, 'adjustments.request', { entityType: 'period_adjustment', entityId: String(request.id), afterJson: request });
    res.status(201).json({ request });
  } catch (e) { next(e); }
});

router.post('/adjustments/:id/finance', requirePerm('adjustments.finance'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
    const row = await prisma.periodAdjustmentRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلقاً' });
    const updated = await prisma.periodAdjustmentRequest.update({
      where: { id },
      data: { status: decision === 'approve' ? 'finance_approved' : 'rejected', financeDecidedById: req.user.id },
    });
    audit(req, `adjustments.finance.${decision}`, { entityType: 'period_adjustment', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

/** الاعتماد النهائي: توليد قيود عكسية append-only في دفتر الرواتب (لا حذف ولا تعديل) */
router.post('/adjustments/:id/ceo', requirePerm('adjustments.ceo'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
    const row = await prisma.periodAdjustmentRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'finance_approved') return res.status(400).json({ error: 'الطلب يحتاج اعتماد مالي أولاً' });
    if (decision === 'reject') {
      const updated = await prisma.periodAdjustmentRequest.update({
        where: { id }, data: { status: 'rejected', ceoDecidedById: req.user.id, decidedAt: new Date() },
      });
      audit(req, 'adjustments.ceo.reject', { entityType: 'period_adjustment', entityId: String(id) });
      return res.json({ request: updated });
    }
    const result = await prisma.$transaction(async (tx) => {
      const payload = row.payloadJson || { items: [] };
      const entries = [];
      for (const item of payload.items) {
        const entry = await tx.payrollLedgerEntry.create({
          data: {
            runId: row.payrollRunId, employeeId: item.employeeId, kind: 'reversal',
            refId: String(row.id), amount: D(item.amount),
            note: `قيد عكسي لطلب تعديل فترة #${row.id}: ${item.note || item.kind}`, createdById: req.user.id,
          },
        });
        entries.push(entry);
      }
      const request = await tx.periodAdjustmentRequest.update({
        where: { id },
        data: { status: 'approved', ceoDecidedById: req.user.id, decidedAt: new Date() },
      });
      return { request, entries };
    });
    audit(req, 'adjustments.ceo.approve', { entityType: 'period_adjustment', entityId: String(id), afterJson: { entries: result.entries.length } });
    res.json(result);
  } catch (e) { next(e); }
});

module.exports = router;
