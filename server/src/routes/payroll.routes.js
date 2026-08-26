/**
 * Payroll Engine - مسيرات الرواتب، GOSI، السلف، المكافآت، EOS، WPS (معاملات 50-56, 70)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
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
    if (!['draft', 'calculated'].includes(run.status)) return res.status(400).json({ error: 'لا يمكن الحساب في هذه الحالة' });

    const employees = await prisma.employee.findMany({ where: { employmentStatus: 'active', deletedAt: null } });
    const monthStart = new Date(run.year, run.month - 1, 1);
    const monthEnd = new Date(run.year, run.month, 0);

    const result = await prisma.$transaction(async (tx) => {
      await tx.payrollItem.deleteMany({ where: { runId: id } });
      let totalGross = 0; let totalNet = 0; let totalGosi = 0;

      for (const emp of employees) {
        const base = Number(emp.salary) || 0;
        const housing = D(base * 0.25);
        const transport = 500;

        // العمل الإضافي المعتمد هذا الشهر
        const ot = await tx.overtimeRequest.aggregate({
          _sum: { hours: true },
          where: { employeeId: emp.id, status: 'approved', date: { gte: monthStart, lte: monthEnd } },
        });
        const hourlyRate = base / 240; // 30 يوم × 8 ساعات
        const overtimePay = D((ot._sum.hours || 0) * hourlyRate * saudi.RULES.overtime.multiplier);

        // المكافآت المعتمدة غير المصروفة
        const bonuses = await tx.bonus.findMany({ where: { employeeId: emp.id, status: 'approved', payrollRunId: null } });
        const bonusPay = D(bonuses.reduce((s, b) => s + Number(b.amount), 0));

        // GOSI على (الأساسي + السكن)
        const gosi = saudi.gosiShares(base + housing);

        // أقساط السلف النشطة
        const loans = await tx.loan.findMany({ where: { employeeId: emp.id, status: 'active' } });
        let loanDeduct = 0;
        for (const loan of loans) {
          const deduct = Math.min(Number(loan.monthlyDeduct), Number(loan.remaining));
          loanDeduct += deduct;
          const remaining = D(Number(loan.remaining) - deduct);
          await tx.loan.update({ where: { id: loan.id }, data: { remaining, status: remaining <= 0 ? 'settled' : 'active' } });
        }
        loanDeduct = D(loanDeduct);

        // خصم الغياب (أيام × معدل يومي)
        const absences = await tx.attendanceRecord.count({
          where: { employeeId: emp.id, status: 'absent', date: { gte: monthStart, lte: monthEnd } },
        });
        const absenceDeduct = D(absences * (base / 30));

        const gross = D(base + housing + transport + overtimePay + bonusPay);
        const net = D(gross - gosi.employee - loanDeduct - absenceDeduct);

        await tx.payrollItem.create({
          data: {
            runId: id, employeeId: emp.id,
            baseSalary: base, housing, transport, overtimePay, bonusPay,
            gosiEmployee: gosi.employee, gosiEmployer: gosi.employer,
            loanDeduct, absenceDeduct, gross, net, iban: emp.iban || null,
          },
        });
        if (bonuses.length) {
          await tx.bonus.updateMany({ where: { id: { in: bonuses.map((b) => b.id) } }, data: { status: 'paid', payrollRunId: id } });
        }
        totalGross += gross; totalNet += net; totalGosi += gosi.employer;
      }

      return tx.payrollRun.update({
        where: { id },
        data: { status: 'calculated', totalGross: D(totalGross), totalNet: D(totalNet), totalGosi: D(totalGosi) },
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
    const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'approved', approvedById: req.user.id } });
    audit(req, 'payroll.run.approve', { entityType: 'payroll_run', entityId: String(id) });
    res.json({ run: updated });
  } catch (e) { next(e); }
});

router.post('/runs/:id/pay', requirePerm('payroll.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run || run.status !== 'approved') return res.status(400).json({ error: 'المسير يحتاج اعتماداً أولاً' });
    const updated = await prisma.payrollRun.update({ where: { id }, data: { status: 'paid', paidAt: new Date() } });
    audit(req, 'payroll.run.pay', { entityType: 'payroll_run', entityId: String(id) });
    res.json({ run: updated });
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
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
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

// ============ نهاية الخدمة (معاملة 56) ============
router.post('/eos/calculate', requirePerm('eos.calculate'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      reason: z.enum(['resignation', 'termination', 'retirement']),
      endDate: z.string().optional(),
      otherDues: z.number().optional(),
    }).parse(req.body);
    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const calc = saudi.calculateEOS({
      hireDate: emp.hireDate,
      endDate: data.endDate ? new Date(data.endDate) : new Date(),
      lastSalary: Number(emp.salary),
      reason: data.reason,
    });
    const otherDues = D(data.otherDues || 0);
    const eos = await prisma.eosCalculation.create({
      data: {
        employeeId: emp.id, reason: data.reason, serviceYears: calc.years,
        lastSalary: Number(emp.salary), eosAmount: calc.eosAmount,
        otherDues, totalPayable: D(calc.eosAmount + otherDues),
        formulaJson: calc, calculatedById: req.user.id,
      },
    });
    audit(req, 'eos.calculate', { entityType: 'eos_calculation', entityId: String(eos.id), afterJson: eos });
    res.status(201).json({ eos, breakdown: calc });
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

router.post('/wps/generate', requirePerm('wps.write'), async (req, res, next) => {
  try {
    const { month, year } = z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).parse(req.body);
    const run = await prisma.payrollRun.findUnique({ where: { month_year: { month, year } }, include: { items: true } });
    if (!run || !['approved', 'paid'].includes(run.status)) {
      return res.status(400).json({ error: 'لا يوجد مسير معتمد لهذا الشهر لتوليد ملف WPS' });
    }
    // محتوى ملف ساري مبسط (نص CSV)
    const lines = ['employee_id,iban,net_salary'];
    for (const item of run.items) lines.push(`${item.employeeId},${item.iban || ''},${item.net}`);
    const fileRef = `WPS-${year}-${String(month).padStart(2, '0')}-${Date.now()}`;

    const file = await prisma.wpsFile.upsert({
      where: { month_year: { month, year } },
      create: { payrollRunId: run.id, month, year, fileRef, status: 'generated' },
      update: { payrollRunId: run.id, fileRef, status: 'generated' },
    });
    audit(req, 'wps.generate', { entityType: 'wps_file', entityId: String(file.id) });
    res.status(201).json({ file, preview: lines.slice(0, 6), recordCount: run.items.length });
  } catch (e) { next(e); }
});

router.post('/wps/:id/status', requirePerm('wps.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.enum(['uploaded', 'confirmed', 'failed']) }).parse(req.body);
    const file = await prisma.wpsFile.update({
      where: { id },
      data: { status, uploadedAt: status === 'uploaded' ? new Date() : undefined, confirmedAt: status === 'confirmed' ? new Date() : undefined },
    });
    audit(req, 'wps.status', { entityType: 'wps_file', entityId: String(id), afterJson: { status } });
    res.json({ file });
  } catch (e) { next(e); }
});

module.exports = router;
