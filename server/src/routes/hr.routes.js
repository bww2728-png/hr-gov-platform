/**
 * HR Core Engine - Employees, Regions, Branches, Departments, Positions, History
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm, scopeFilter } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { toHijri } = require('../utils/dates');

const router = express.Router();

// =========== STRUCTURE: regions, branches, departments, positions ===========

router.get('/regions', authenticate, async (req, res, next) => {
  try {
    const regions = await prisma.region.findMany({
      include: { _count: { select: { branches: true } } },
      orderBy: { nameAr: 'asc' },
    });
    res.json({ regions });
  } catch (e) { next(e); }
});

router.get('/branches', authenticate, async (req, res, next) => {
  try {
    const where = {};
    const scope = scopeFilter(req);
    if (scope.branchId) where.id = scope.branchId;
    const branches = await prisma.branch.findMany({
      where,
      include: { region: true, _count: { select: { employees: true, departments: true } } },
      orderBy: { nameAr: 'asc' },
    });
    res.json({ branches });
  } catch (e) { next(e); }
});

router.get('/departments', authenticate, async (req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: { parent: true, children: true, _count: { select: { employees: true } } },
      orderBy: { nameAr: 'asc' },
    });
    res.json({ departments });
  } catch (e) { next(e); }
});

router.get('/positions', authenticate, async (req, res, next) => {
  try {
    const positions = await prisma.position.findMany({
      include: { department: true, _count: { select: { employees: true } } },
      orderBy: [{ level: 'desc' }, { titleAr: 'asc' }],
    });
    res.json({ positions });
  } catch (e) { next(e); }
});

// =========== EMPLOYEES ===========

const employeeSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  fullNameAr: z.string().min(2).max(100),
  fullNameEn: z.string().max(100).optional().nullable(),
  nationalId: z.string().max(20).optional().nullable(),
  nationality: z.string().max(20).optional().nullable(),
  gender: z.enum(['M', 'F']).optional().nullable(),
  maritalStatus: z.string().max(20).optional().nullable(),
  dobGregorian: z.string().optional().nullable(),
  dobHijri: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  hireDate: z.string(),
  contractEndDate: z.string().optional().nullable(),
  contractType: z.enum(['full_time', 'part_time', 'contract', 'intern', 'consultant']).default('full_time'),
  branchId: z.number().int().positive(),
  deptId: z.number().int().positive(),
  positionId: z.number().int().positive(),
  managerId: z.string().uuid().optional().nullable(),
  salary: z.number().or(z.string()).default(0),
  currency: z.string().max(5).default('SAR'),
  bankAccount: z.string().max(50).optional().nullable(),
  bankName: z.string().max(50).optional().nullable(),
  iban: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.get('/employees', authenticate, async (req, res, next) => {
  try {
    const where = {};
    const scope = scopeFilter(req);
    if (scope.branchId) where.branchId = scope.branchId;
    if (scope.deptId) where.deptId = scope.deptId;

    const { search, status, deptId, branchId } = req.query;
    if (search) {
      where.OR = [
        { fullNameAr: { contains: String(search), mode: 'insensitive' } },
        { fullNameEn: { contains: String(search), mode: 'insensitive' } },
        { employeeNumber: { contains: String(search), mode: 'insensitive' } },
        { nationalId: { contains: String(search), mode: 'insensitive' } },
      ];
    }
    if (status) where.employmentStatus = String(status);
    if (deptId) where.deptId = parseInt(deptId, 10);
    if (branchId) where.branchId = parseInt(branchId, 10);

    const employees = await prisma.employee.findMany({
      where,
      include: {
        branch: true,
        department: true,
        position: true,
        manager: { select: { id: true, fullNameAr: true, fullNameEn: true } },
      },
      orderBy: [{ employmentStatus: 'asc' }, { fullNameAr: 'asc' }],
      take: 500,
    });

    // Mask salaries unless allowed
    const perms = req.user.role?.permissions || [];
    const canSeeSalary = perms.includes('hr.employee.read.salary') || perms.includes('*');
    const masked = employees.map(({ nationalId, ...e }) => ({
      ...e,
      salary: canSeeSalary ? e.salary : null,
      iban: canSeeSalary ? e.iban : null,
      bankAccount: canSeeSalary ? e.bankAccount : null,
      nationalId: canSeeSalary ? nationalId : null,
    }));

    res.json({ employees: masked });
  } catch (e) { next(e); }
});

router.get('/employees/:id', authenticate, async (req, res, next) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        branch: true, department: true, position: true,
        manager: { select: { id: true, fullNameAr: true, fullNameEn: true } },
        reports: { select: { id: true, fullNameAr: true, fullNameEn: true } },
        history: { orderBy: { effectiveDate: 'desc' } },
        onboardingTasks: { orderBy: { dueDate: 'asc' } },
      },
    });
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    const perms = req.user.role?.permissions || [];
    const canSeeSalary = perms.includes('hr.employee.read.salary') || perms.includes('*');
    if (!canSeeSalary) {
      emp.salary = null; emp.iban = null; emp.bankAccount = null; emp.nationalId = null;
    }
    res.json({ employee: emp });
  } catch (e) { next(e); }
});

router.post('/employees', authenticate, requirePerm('hr.employee.write'), async (req, res, next) => {
  try {
    const data = employeeSchema.parse(req.body);
    const employee = await prisma.employee.create({
      data: {
        ...data,
        salary: data.salary,
        hireDate: new Date(data.hireDate),
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        dobGregorian: data.dobGregorian ? new Date(data.dobGregorian) : null,
      },
    });
    audit(req, 'hr.employee.create', {
      entityType: 'employee', entityId: employee.id, afterJson: { id: employee.id, name: employee.fullNameAr },
    });
    res.status(201).json({ employee });
  } catch (e) { next(e); }
});

router.patch('/employees/:id', authenticate, requirePerm('hr.employee.write'), async (req, res, next) => {
  try {
    const before = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'الموظف غير موجود' });

    const data = employeeSchema.partial().parse(req.body);
    const updateData = { ...data };
    if (data.hireDate) updateData.hireDate = new Date(data.hireDate);
    if (data.contractEndDate) updateData.contractEndDate = new Date(data.contractEndDate);
    if (data.dobGregorian) updateData.dobGregorian = new Date(data.dobGregorian);

    const after = await prisma.employee.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Record history if key fields changed
    const changedFields = ['positionId', 'deptId', 'branchId', 'salary', 'employmentStatus'];
    const changes = changedFields.filter((f) => data[f] != null && String(before[f]) !== String(data[f]));
    if (changes.length > 0) {
      await prisma.employeeHistory.create({
        data: {
          employeeId: before.id,
          changeType: changes.includes('salary') ? 'salary_change' : 'modification',
          beforeJson: Object.fromEntries(changes.map((c) => [c, before[c]])),
          afterJson: Object.fromEntries(changes.map((c) => [c, after[c]])),
          effectiveDate: new Date(),
          approvedById: req.user.id,
        },
      });
    }

    audit(req, 'hr.employee.update', {
      entityType: 'employee', entityId: before.id,
      beforeJson: { salary: before.salary, positionId: before.positionId },
      afterJson: { salary: after.salary, positionId: after.positionId },
    });

    res.json({ employee: after });
  } catch (e) { next(e); }
});

router.get('/employees/:id/history', authenticate, requirePerm('hr.history.read'), async (req, res, next) => {
  try {
    const history = await prisma.employeeHistory.findMany({
      where: { employeeId: req.params.id },
      orderBy: { effectiveDate: 'desc' },
    });
    res.json({ history });
  } catch (e) { next(e); }
});

// Org chart - returns tree
router.get('/org-chart', authenticate, requirePerm('hr.org.read'), async (req, res, next) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { employmentStatus: { in: ['active', 'notice_period'] } },
      select: {
        id: true, employeeNumber: true, fullNameAr: true, fullNameEn: true,
        position: { select: { titleAr: true, titleEn: true, level: true } },
        department: { select: { nameAr: true, nameEn: true } },
        branch: { select: { nameAr: true } },
        managerId: true,
      },
      orderBy: [{ position: { level: 'desc' } }, { fullNameAr: 'asc' }],
    });
    res.json({ employees });
  } catch (e) { next(e); }
});

module.exports = router;