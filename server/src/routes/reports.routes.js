/**
 * مركز التقارير — 28 تقريراً (6 مالية / 15 تشغيلية / 7 استراتيجية)
 * + 12 طريقة عرض (T1..T12) بالأعمدة الموثقة في الوثيقة الثانية.
 */
const express = require('express');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const { simulate } = require('../utils/formulas');

const router = express.Router();
router.use(authenticate);

// ---------- فهرس التقارير ----------
const CATALOG = [
  // مالية (6)
  { code: 'FIN-01', cat: 'financial', nameAr: 'كشف راتب (Payslip)', audience: 'موظف', perm: 'self.payslip.read' },
  { code: 'FIN-02', cat: 'financial', nameAr: 'مسير رواتب شهري', audience: 'HR + مالي', perm: 'payroll.read' },
  { code: 'FIN-03', cat: 'financial', nameAr: 'كشف نهاية خدمة', audience: 'منتهية خدمته', perm: 'eos.read' },
  { code: 'FIN-04', cat: 'financial', nameAr: 'الرواتب حسب الإدارة', audience: 'مدير HR', perm: 'reports.payroll.read' },
  { code: 'FIN-05', cat: 'financial', nameAr: 'السلف والخصومات', audience: 'مالي', perm: 'loans.read' },
  { code: 'FIN-06', cat: 'financial', nameAr: 'ميزانية الرواتب السنوية', audience: 'CEO', perm: 'budget.approve' },
  // تشغيلية (15)
  { code: 'OPS-01', cat: 'operational', nameAr: 'الموظفون الحاليون', audience: 'HR', perm: 'hr.employee.read' },
  { code: 'OPS-02', cat: 'operational', nameAr: 'العقود المنتهية (90 يوم)', audience: 'HR', perm: 'hr.employee.read' },
  { code: 'OPS-03', cat: 'operational', nameAr: 'الإقامات المنتهية', audience: 'HR', perm: 'expat.iqama.read' },
  { code: 'OPS-04', cat: 'operational', nameAr: 'التأشيرات', audience: 'HR', perm: 'expat.visa.read' },
  { code: 'OPS-05', cat: 'operational', nameAr: 'الموظفون على رأس العمل', audience: 'الجوازات', perm: 'hr.employee.read' },
  { code: 'OPS-06', cat: 'operational', nameAr: 'فترة التجربة', audience: 'HR', perm: 'probation.read' },
  { code: 'OPS-07', cat: 'operational', nameAr: 'الحركة (ترقية/نقل)', audience: 'HR', perm: 'hr.history.read' },
  { code: 'OPS-08', cat: 'operational', nameAr: 'الحضور اليومي', audience: 'مدير', perm: 'attendance.read' },
  { code: 'OPS-09', cat: 'operational', nameAr: 'العمل الإضافي', audience: 'HR', perm: 'overtime.read' },
  { code: 'OPS-10', cat: 'operational', nameAr: 'الإجازات والأرصدة', audience: 'HR', perm: 'leaves.read' },
  { code: 'OPS-11', cat: 'operational', nameAr: 'نهاية الخدمة (آخر 6 أشهر)', audience: 'HR', perm: 'lifecycle.exit.read' },
  { code: 'OPS-12', cat: 'operational', nameAr: 'التحويلات الداخلية', audience: 'HR', perm: 'hr.history.read' },
  { code: 'OPS-13', cat: 'operational', nameAr: 'طلبات منصة قوى', audience: 'HR', perm: 'qiwa.read' },
  { code: 'OPS-14', cat: 'operational', nameAr: 'الموظفون حسب الجنسية', audience: 'HR', perm: 'hr.employee.read' },
  { code: 'OPS-15', cat: 'operational', nameAr: 'الموظفون حسب الفئة', audience: 'HR', perm: 'hr.employee.read' },
  // استراتيجية (7)
  { code: 'STR-01', cat: 'strategic', nameAr: 'نسبة السعودة (نطاقات)', audience: 'CEO', perm: 'nitaqat.read' },
  { code: 'STR-02', cat: 'strategic', nameAr: 'معدل دوران الموظفين', audience: 'CEO', perm: 'analytics.read' },
  { code: 'STR-03', cat: 'strategic', nameAr: 'التكلفة لكل موظف', audience: 'CEO', perm: 'analytics.read' },
  { code: 'STR-04', cat: 'strategic', nameAr: 'تقرير الإنتاجية', audience: 'CEO', perm: 'analytics.read' },
  { code: 'STR-05', cat: 'strategic', nameAr: 'تحليل الفجوات', audience: 'مدير HR', perm: 'analytics.read' },
  { code: 'STR-06', cat: 'strategic', nameAr: 'لوحة تحكم تنفيذية', audience: 'CEO', perm: 'analytics.read' },
  { code: 'STR-07', cat: 'strategic', nameAr: 'الترقيات السنوي', audience: 'CEO', perm: 'analytics.read' },
];

const VIEWS = [
  { code: 'T1', nameAr: 'بيانات الموظفين الأساسي', cols: 29 },
  { code: 'T2', nameAr: 'المتعاقدات', cols: 37 },
  { code: 'T3', nameAr: 'حالة الموظفين', cols: 14 },
  { code: 'T4', nameAr: 'بيانات الموظفين التفصيلي', cols: 42 },
  { code: 'T5', nameAr: 'حركة الترقيات', cols: 11 },
  { code: 'T6', nameAr: 'إدارة التشغيل', cols: 23 },
  { code: 'T7', nameAr: 'التاريخ والملاحظات', cols: 5 },
  { code: 'T8', nameAr: 'تقرير التحويلات', cols: 17 },
  { code: 'T9', nameAr: 'المتعاقدات النهائي', cols: 17 },
  { code: 'T10', nameAr: 'بيانات الموظفين الشامل', cols: 23 },
  { code: 'T11', nameAr: 'طلبات منصة قوى', cols: 22 },
  { code: 'T12', nameAr: 'فترة التجربة', cols: 19 },
];

/** GET /api/reports/catalog */
router.get('/catalog', async (req, res) => {
  const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
  const can = (p) => perms.includes('*') || perms.includes(p);
  res.json({
    reports: CATALOG.map((r) => ({ ...r, allowed: can(r.perm) })),
    views: VIEWS,
  });
});

// ---------- منفّذات التقارير ----------
const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

const RUNNERS = {
  'FIN-01': async (req) => {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const canPayroll = perms.includes('*') || perms.includes('payroll.read');
    let employeeId = selfId(req);
    let subject = null;
    if (canPayroll && req.query.employeeNumber) {
      subject = await prisma.employee.findUnique({
        where: { employeeNumber: String(req.query.employeeNumber) },
        select: { id: true, fullNameAr: true, employeeNumber: true, department: { select: { nameAr: true } }, position: { select: { titleAr: true } } },
      });
      if (!subject) return { note: 'لا يوجد موظف بهذا الرقم الوظيفي' };
      employeeId = subject.id;
    }
    if (!employeeId) return { note: 'لا يوجد ملف موظف مرتبط بهذا الحساب' };
    const item = await prisma.payrollItem.findFirst({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      include: { run: { select: { code: true, month: true, year: true, status: true, paymentDate: true } } },
    });
    if (!item) return { note: 'لا توجد مسيرات رواتب لهذا الموظف بعد' };
    if (!subject) {
      subject = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, fullNameAr: true, employeeNumber: true, department: { select: { nameAr: true } }, position: { select: { titleAr: true } } },
      });
    }
    return { payslip: { employee: subject, run: item.run, earnings: { baseSalary: item.baseSalary, housing: item.housing, transport: item.transport, otherAllow: item.otherAllow, overtimePay: item.overtimePay, bonusPay: item.bonusPay }, deductions: { gosiEmployee: item.gosiEmployee, gosiEmployer: item.gosiEmployer, loanDeduct: item.loanDeduct, absenceDeduct: item.absenceDeduct, otherDeduct: item.otherDeduct }, gross: item.gross, net: item.net, iban: item.iban } };
  },
  'FIN-02': async () => {
    const runs = await prisma.payrollRun.findMany({
      include: { items: { include: { employee: { select: { fullNameAr: true, employeeNumber: true, department: { select: { nameAr: true } } } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 3,
    });
    return { runs };
  },
  'FIN-04': async () => {
    const byDept = await prisma.employee.groupBy({
      by: ['deptId'],
      where: { deletedAt: null, employmentStatus: 'active' },
      _sum: { salary: true }, _count: { _all: true },
    });
    const depts = await prisma.department.findMany();
    const map = Object.fromEntries(depts.map((d) => [d.id, d.nameAr]));
    return { rows: byDept.map((r) => ({ dept: map[r.deptId] || r.deptId, employees: r._count._all, totalSalary: r._sum.salary })) };
  },
  'FIN-05': async () => {
    const loans = await prisma.loan.findMany({ include: { employee: { select: { fullNameAr: true, employeeNumber: true } } } });
    return { loans };
  },
  'FIN-06': async () => {
    const agg = await prisma.employee.aggregate({
      where: { deletedAt: null, employmentStatus: 'active' },
      _sum: { salary: true, housingAllowance: true, transportAllowance: true, otherAllowances: true },
      _count: { _all: true },
    });
    const monthly = (agg._sum.salary || 0) + (agg._sum.housingAllowance || 0) + (agg._sum.transportAllowance || 0) + (agg._sum.otherAllowances || 0);
    return { employees: agg._count._all, monthlyEstimate: monthly, annualEstimate: monthly * 12 };
  },
  'OPS-01': async () => {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, employmentStatus: 'active' },
      include: { branch: true, department: true, position: true, section: true },
      orderBy: { fullNameAr: 'asc' },
    });
    return { employees };
  },
  'OPS-02': async () => {
    const soon = new Date(Date.now() + 90 * 24 * 3600 * 1000);
    const contracts = await prisma.contract.findMany({
      where: { status: 'active', endDate: { lte: soon } },
      include: { employee: { select: { fullNameAr: true, employeeNumber: true, department: { select: { nameAr: true } } } } },
      orderBy: { endDate: 'asc' },
    });
    return { contracts, withinDays: 90 };
  },
  'OPS-03': async () => {
    const iqamas = await prisma.iqamaRecord.findMany({
      where: { expiryDate: { lte: new Date(Date.now() + 90 * 24 * 3600 * 1000) } },
      include: { employee: { select: { fullNameAr: true, employeeNumber: true } } },
      orderBy: { expiryDate: 'asc' },
    });
    return { iqamas };
  },
  'OPS-04': async () => {
    const visas = await prisma.visa.findMany({ include: { employee: { select: { fullNameAr: true } } }, orderBy: { createdAt: 'desc' } });
    return { visas };
  },
  'OPS-05': async () => {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, employmentStatus: 'active', residentType: 'expat' },
      select: { fullNameAr: true, employeeNumber: true, iqamaNumber: true, passportNumber: true, nationality: true, sponsorCode: true, department: { select: { nameAr: true } } },
    });
    return { employees };
  },
  'OPS-06': async () => {
    const employees = await prisma.employee.findMany({
      where: { deletedAt: null, probationEndDate: { gte: new Date() } },
      include: { department: { select: { nameAr: true } }, position: { select: { titleAr: true } } },
    });
    const reviews = await prisma.probationReview.findMany();
    return { employees, reviews };
  },
  'OPS-07': async () => {
    const promotions = await prisma.promotion.findMany({ include: { employee: { select: { fullNameAr: true } } }, orderBy: { createdAt: 'desc' } });
    const transfers = await prisma.transfer.findMany({ include: { employee: { select: { fullNameAr: true } } }, orderBy: { createdAt: 'desc' } });
    return { promotions, transfers };
  },
  'OPS-08': async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const records = await prisma.attendanceRecord.findMany({
      where: { date: { gte: today } },
      include: { employee: { select: { fullNameAr: true, employeeNumber: true } } },
    });
    return { date: today, records };
  },
  'OPS-09': async () => {
    const overtime = await prisma.overtimeRequest.findMany({ include: { employee: { select: { fullNameAr: true } } }, orderBy: { createdAt: 'desc' } });
    return { overtime };
  },
  'OPS-10': async () => {
    const balances = await prisma.leaveBalance.findMany({ include: { employee: { select: { fullNameAr: true } }, leaveType: true } });
    const requests = await prisma.leaveRequest.findMany({ include: { employee: { select: { fullNameAr: true } }, leaveType: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { balances, requests };
  },
  'OPS-11': async () => {
    const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: 'terminated', updatedAt: { gte: since } },
      include: { department: { select: { nameAr: true } } },
    });
    const eos = await prisma.eosCalculation.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return { employees, eos };
  },
  'OPS-12': async () => {
    const transfers = await prisma.transfer.findMany({
      include: { employee: { select: { fullNameAr: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { transfers };
  },
  'OPS-13': async () => {
    const requests = await prisma.qiwaRequest.findMany({
      include: { employee: { select: { fullNameAr: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { requests };
  },
  'OPS-14': async () => {
    const grouped = await prisma.employee.groupBy({
      by: ['nationality'], where: { deletedAt: null, employmentStatus: 'active' }, _count: { _all: true },
      orderBy: { _count: { nationality: 'desc' } },
    });
    return { rows: grouped.map((g) => ({ nationality: g.nationality || 'غير محدد', count: g._count._all })) };
  },
  'OPS-15': async () => {
    const grouped = await prisma.employee.groupBy({
      by: ['jobCategoryCode'], where: { deletedAt: null, employmentStatus: 'active' }, _count: { _all: true },
    });
    const cats = await prisma.lookup.findMany({ where: { category: 'job_category' } });
    const map = Object.fromEntries(cats.map((c) => [c.code, c.valueAr]));
    return { rows: grouped.map((g) => ({ category: map[g.jobCategoryCode] || g.jobCategoryCode || 'غير محدد', count: g._count._all })) };
  },
  'STR-01': async () => {
    const [saudi, total] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'active', residentType: 'saudi' } }),
      prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'active' } }),
    ]);
    const { result } = simulate('F29', { saudi, total });
    const snapshots = await prisma.nitaqatSnapshot.findMany({ orderBy: { snapshotDate: 'desc' }, take: 5 });
    return { saudi, total, saudizationPct: result, snapshots };
  },
  'STR-02': async () => {
    const yearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const [terminated, total] = await Promise.all([
      prisma.employee.count({ where: { employmentStatus: 'terminated', updatedAt: { gte: yearAgo } } }),
      prisma.employee.count({ where: { deletedAt: null } }),
    ]);
    const { result } = simulate('F26', { terminated, avgHeadcount: total || 1 });
    return { terminated, avgHeadcount: total, turnoverPct: result };
  },
  'STR-03': async () => {
    const agg = await prisma.employee.aggregate({
      where: { deletedAt: null, employmentStatus: 'active' },
      _sum: { salary: true, housingAllowance: true, transportAllowance: true, otherAllowances: true },
      _count: { _all: true },
    });
    const total = (agg._sum.salary || 0) + (agg._sum.housingAllowance || 0) + (agg._sum.transportAllowance || 0) + (agg._sum.otherAllowances || 0);
    const gosi = await prisma.gosiRecord.aggregate({ _sum: { employerShare: true } });
    return {
      employees: agg._count._all,
      totalMonthlyCost: total + (gosi._sum.employerShare || 0),
      costPerEmployee: agg._count._all ? Math.round((total + (gosi._sum.employerShare || 0)) / agg._count._all) : 0,
    };
  },
  'STR-04': async () => {
    const objectives = await prisma.objective.count();
    const completed = await prisma.keyResult.count({ where: { status: 'completed' } });
    const krs = await prisma.keyResult.count();
    return { objectives, keyResultsCompleted: completed, keyResultsTotal: krs, completionPct: krs ? Math.round((completed / krs) * 100) : 0 };
  },
  'STR-05': async () => {
    const plans = await prisma.successionPlan.findMany({ include: { candidates: true } });
    const gaps = plans.filter((p) => !p.candidates.length);
    return { plans, criticalGaps: gaps.length };
  },
  'STR-06': async () => {
    const [emps, saudi, open, pending] = await Promise.all([
      prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'active' } }),
      prisma.employee.count({ where: { deletedAt: null, employmentStatus: 'active', residentType: 'saudi' } }),
      prisma.jobPosting.count({ where: { status: 'open' } }),
      prisma.employeeRequest.count({ where: { status: 'pending' } }),
    ]);
    return { employees: emps, saudizationPct: emps ? Math.round((saudi / emps) * 1000) / 10 : 0, openPostings: open, pendingRequests: pending };
  },
  'STR-07': async () => {
    const year = new Date().getFullYear();
    const promotions = await prisma.promotion.findMany({
      where: { effectiveDate: { gte: new Date(`${year}-01-01`) } },
      include: { employee: { select: { fullNameAr: true, department: { select: { nameAr: true } } } } },
    });
    return { year, promotions };
  },
};

/** GET /api/reports/run/:code */
const FIN_FIELDS = new Set([
  'nationalId', 'iban', 'bankAccount', 'salary', 'housingAllowance', 'transportAllowance',
  'otherAllowances', 'basicSalary', 'gross', 'net', 'gosiEmployee', 'gosiEmployer',
  'loanDeduct', 'absenceDeduct', 'otherDeduct', 'overtimePay', 'bonusPay',
]);
const EXPAT_FIELDS = new Set(['iqamaNumber', 'passportNumber']);

function redactDeep(value, canFin, canExpat) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, canFin, canExpat));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (FIN_FIELDS.has(k) && !canFin) { out[k] = null; continue; }
      if (EXPAT_FIELDS.has(k) && !canExpat) { out[k] = null; continue; }
      out[k] = redactDeep(v, canFin, canExpat);
    }
    return out;
  }
  return value;
}

router.get('/run/:code', async (req, res, next) => {
  try {
    const def = CATALOG.find((r) => r.code === req.params.code);
    if (!def) return res.status(404).json({ error: 'تقرير غير معروف' });
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    if (!perms.includes('*') && !perms.includes(def.perm)) {
      return res.status(403).json({ error: 'ممنوع: لا تملك صلاحية هذا التقرير' });
    }
    const canFin = perms.includes('*') || perms.includes('hr.employee.read.salary') || perms.includes('payroll.read') || perms.includes('loans.read');
    const canExpat = perms.includes('*') || perms.includes('expat.iqama.read') || perms.includes('expat.visa.read');
    const runner = RUNNERS[def.code];
    const data = runner ? await runner(req) : { note: 'التقرير قيد الإعداد' };
    res.json({ report: def, data: redactDeep(data, canFin, canExpat), generatedAt: new Date() });
  } catch (e) { next(e); }
});

// ---------- طرق العرض الـ 12 (T1..T12) ----------
const VIEW_RUNNERS = {
  T1: async () => prisma.employee.findMany({
    where: { deletedAt: null },
    include: { branch: true, department: true, position: true, contracts: { where: { status: 'active' }, take: 1 } },
  }),
  T2: async () => prisma.contract.findMany({ include: { employee: { include: { department: true, position: true, section: true } } } }),
  T3: async () => prisma.employee.findMany({
    where: { deletedAt: null },
    select: { employmentStatus: true, employeeNumber: true, fullNameAr: true, hireDate: true, contractEndDate: true, department: true, section: true, jobCategoryCode: true, nationality: true },
  }),
  T4: async () => prisma.employee.findMany({
    where: { deletedAt: null },
    include: { department: true, section: true, position: true, contracts: { where: { status: 'active' }, take: 1 } },
  }),
  T5: async () => prisma.promotion.findMany({ include: { employee: { include: { department: true, position: true } } } }),
  T6: async () => prisma.employee.findMany({
    where: { deletedAt: null, employmentStatus: 'active' },
    include: { department: true, section: true, position: true, branch: true, contracts: { where: { status: 'active' }, take: 1 } },
  }),
  T7: async () => prisma.employeeHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { employee: { select: { fullNameAr: true } } } }),
  T8: async () => prisma.transfer.findMany({ include: { employee: { select: { fullNameAr: true, employeeNumber: true } } } }),
  T9: async () => prisma.contract.findMany({ include: { employee: { include: { department: true, position: true } } }, orderBy: { createdAt: 'desc' } }),
  T10: async () => prisma.employee.findMany({ where: { deletedAt: null }, include: { branch: true, department: true, position: true } }),
  T11: async () => prisma.qiwaRequest.findMany({ include: { employee: { include: { branch: true, department: true, section: true, position: true } } } }),
  T12: async () => ({
    employees: await prisma.employee.findMany({ where: { deletedAt: null, probationEndDate: { not: null } }, include: { section: true, position: true } }),
    reviews: await prisma.probationReview.findMany(),
  }),
};

/** GET /api/reports/view/:code — طريقة عرض T1..T12 */
router.get('/view/:code', reqPerm('hr.employee.read'), async (req, res, next) => {
  try {
    const def = VIEWS.find((v) => v.code === req.params.code);
    if (!def) return res.status(404).json({ error: 'طريقة عرض غير معروفة' });
    const runner = VIEW_RUNNERS[def.code];
    if (!runner) return res.status(501).json({ error: 'غير منفذة بعد' });
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const canFin = perms.includes('*') || perms.includes('hr.employee.read.salary') || perms.includes('payroll.read');
    const canExpat = perms.includes('*') || perms.includes('expat.iqama.read') || perms.includes('expat.visa.read');
    const data = await runner(req);
    res.json({ view: def, data: redactDeep(data, canFin, canExpat), generatedAt: new Date() });
  } catch (e) { next(e); }
});

module.exports = router;
