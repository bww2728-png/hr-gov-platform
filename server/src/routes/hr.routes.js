/**
 * HR Core Engine - Employees, Regions, Branches, Departments, Positions, History
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm, scopeFilter } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const { toHijri } = require('../utils/dates');
const bcrypt = require('bcryptjs');
const { encryptSecret, decryptSecret, generatePassword } = require('../utils/credentialVault');

const router = express.Router();

// ===== أدوات الاستيراد والتسجيل التلقائي =====
const normAr = (s) =>
  String(s || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();

const CONTRACT_MAP = { 'دوام كامل': 'full_time', 'دوام جزئي': 'part_time', 'عقد': 'contract', 'متدرب': 'intern', 'مستشار': 'consultant' };
const GENDER_MAP = { 'ذكر': 'M', 'انثى': 'F', 'أنثى': 'F' };

async function getEmployeeRole() {
  return prisma.role.findUnique({ where: { code: 'employee' } });
}

async function createEmployeeWithAccount(tx, data, employeeRole) {
  const password = generatePassword(12);
  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await tx.employee.create({ data });
  const user = await tx.user.create({
    data: {
      username: data.employeeNumber,
      fullNameAr: data.fullNameAr,
      fullNameEn: data.fullNameEn || null,
      email: data.email || null,
      phone: data.phone || null,
      passwordHash,
      roleId: employeeRole.id,
      employeeId: employee.id,
      mustChangePassword: true,
      initialPasswordEnc: encryptSecret(password),
      passwordIssuedAt: new Date(),
    },
  });
  return { employee, user, password };
}

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

router.get('/employees/credentials', authenticate, requirePerm('hr.employee.write'), async (req, res, next) => {
  try {
    const search = normAr(req.query.search || '');
    const users = await prisma.user.findMany({
      where: { initialPasswordEnc: { not: null }, deletedAt: null, employeeId: { not: null } },
      include: {
        employee: { select: { employeeNumber: true, fullNameAr: true } },
        role: { select: { nameAr: true } },
      },
      orderBy: { passwordIssuedAt: 'desc' },
      take: 1000,
    });
    let rows = users.map((u) => {
      const pwd = decryptSecret(u.initialPasswordEnc);
      return {
        username: u.username,
        fullNameAr: u.employee?.fullNameAr || u.fullNameAr,
        employeeNumber: u.employee?.employeeNumber || u.username,
        roleName: u.role?.nameAr || '',
        password: pwd,
        issuedAt: u.passwordIssuedAt,
        changed: pwd == null,
      };
    });
    if (search) {
      rows = rows.filter((r) =>
        normAr(r.fullNameAr).includes(search) ||
        r.username.toLowerCase().includes(search.toLowerCase()) ||
        String(r.employeeNumber).toLowerCase().includes(search.toLowerCase())
      );
    }
    audit(req, 'hr.employee.credentials.view', { meta: { count: rows.length } });
    res.json({ rows });
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
    const employeeRole = await getEmployeeRole();
    const empData = {
      ...data,
      salary: data.salary,
      hireDate: new Date(data.hireDate),
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
      dobGregorian: data.dobGregorian ? new Date(data.dobGregorian) : null,
    };
    const { employee, password } = await prisma.$transaction(async (tx) =>
      createEmployeeWithAccount(tx, empData, employeeRole)
    );
    audit(req, 'hr.employee.create', {
      entityType: 'employee', entityId: employee.id, afterJson: { id: employee.id, name: employee.fullNameAr, withAccount: true },
    });
    res.status(201).json({
      employee,
      credentials: { username: employee.employeeNumber, password, mustChangePassword: true },
    });
  } catch (e) { next(e); }
});

// =========== الاستيراد من Excel + تقرير كلمات السر ===========

const importRowSchema = z.object({
  employeeNumber: z.string().min(1).max(20),
  fullNameAr: z.string().min(2).max(100),
  fullNameEn: z.string().max(100).optional().nullable(),
  hireDate: z.string().min(6).max(30),
  branchName: z.string().min(1),
  deptName: z.string().min(1),
  positionTitle: z.string().min(1),
  salary: z.union([z.number(), z.string()]).optional().nullable(),
  nationality: z.string().max(40).optional().nullable(),
  gender: z.string().max(20).optional().nullable(),
  nationalId: z.string().max(20).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().max(120).optional().nullable(),
  contractType: z.string().max(30).optional().nullable(),
  iban: z.string().max(50).optional().nullable(),
  bankName: z.string().max(50).optional().nullable(),
});

router.post('/employees/import', authenticate, requirePerm('hr.employee.write'), async (req, res, next) => {
  try {
    const { rows } = z.object({ rows: z.array(importRowSchema).min(1).max(500) }).parse(req.body);
    const employeeRole = await getEmployeeRole();
    if (!employeeRole) return res.status(500).json({ error: 'دور "employee" غير معرف في النظام' });

    const [branches, departments, positions] = await Promise.all([
      prisma.branch.findMany(),
      prisma.department.findMany(),
      prisma.position.findMany(),
    ]);
    const branchBy = new Map(branches.map((b) => [normAr(b.nameAr), b]));
    const deptBy = new Map(departments.map((d) => [normAr(d.nameAr), d]));
    const posBy = new Map(positions.map((p) => [normAr(p.titleAr), p]));

    const results = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      try {
        const branch = branchBy.get(normAr(row.branchName));
        if (!branch) throw new Error(`الفرع «${row.branchName}» غير موجود في النظام`);
        const dept = deptBy.get(normAr(row.deptName));
        if (!dept) throw new Error(`الإدارة «${row.deptName}» غير موجودة في النظام`);
        const position = posBy.get(normAr(row.positionTitle));
        if (!position) throw new Error(`المنصب «${row.positionTitle}» غير موجود في النظام`);

        const hireDate = new Date(row.hireDate);
        if (isNaN(hireDate.getTime())) throw new Error(`تاريخ المباشرة غير صالح: «${row.hireDate}» (المطلوب YYYY-MM-DD)`);

        const gender = row.gender ? GENDER_MAP[normAr(row.gender)] : null;
        if (row.gender && !gender) throw new Error(`الجنس يجب أن يكون «ذكر» أو «أنثى» وليس «${row.gender}»`);
        const contractType = row.contractType ? CONTRACT_MAP[normAr(row.contractType)] : 'full_time';
        if (row.contractType && !contractType) throw new Error(`نوع العقد غير معروف: «${row.contractType}»`);

        const dup = await prisma.employee.findUnique({ where: { employeeNumber: row.employeeNumber } });
        if (dup) throw new Error(`الرقم الوظيفي «${row.employeeNumber}» مستخدم مسبقاً للموظف: ${dup.fullNameAr}`);
        const dupUser = await prisma.user.findUnique({ where: { username: row.employeeNumber } });
        if (dupUser) throw new Error(`اسم الدخول «${row.employeeNumber}» مستخدم مسبقاً بحساب آخر`);

        const empData = {
          employeeNumber: row.employeeNumber,
          fullNameAr: row.fullNameAr,
          fullNameEn: row.fullNameEn || null,
          nationalId: row.nationalId || null,
          nationality: row.nationality || null,
          gender: gender || null,
          email: row.email || null,
          phone: row.phone || null,
          hireDate,
          contractType: contractType || 'full_time',
          branchId: branch.id,
          deptId: dept.id,
          positionId: position.id,
          salary: row.salary != null && row.salary !== '' ? Number(row.salary) : 0,
          iban: row.iban || null,
          bankName: row.bankName || null,
        };
        if (empData.salary === null || isNaN(empData.salary)) throw new Error(`الراتب غير صالح: «${row.salary}»`);

        const { employee, password } = await prisma.$transaction(async (tx) =>
          createEmployeeWithAccount(tx, empData, employeeRole)
        );
        results.push({
          rowNum,
          ok: true,
          employeeNumber: employee.employeeNumber,
          fullNameAr: employee.fullNameAr,
          username: employee.employeeNumber,
          password,
        });
      } catch (err) {
        const msg = err?.code === 'P2002'
          ? 'قيمة مكررة (رقم وظيفي أو هوية أو اسم دخول مستخدم مسبقاً)'
          : (err?.message || 'خطأ غير متوقع');
        results.push({ rowNum, ok: false, error: msg });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    audit(req, 'hr.employee.import', {
      entityType: 'employee',
      meta: { total: rows.length, created: okCount, failed: rows.length - okCount },
    });
    res.json({ total: rows.length, created: okCount, failed: rows.length - okCount, results });
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