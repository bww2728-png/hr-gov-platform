/**
 * Leaves Engine - أنواع الإجازات، الأرصدة، الطلبات (معاملات 29-36)
 * القواعد محسوبة عبر محرك saudiRules (استحقاق 21/30، مرضية بثلاث فئات، حج مرة واحدة...)
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
const canSeeAll = (req) => {
  const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
  return perms.includes('*') || perms.includes('leaves.read') || perms.includes('leaves.approve.hr');
};

function daysBetween(start, end) {
  const s = new Date(start); const e = new Date(end);
  return Math.round((e - s) / 86400000) + 1;
}

// ============ أنواع الإجازات ============
router.get('/types', async (req, res, next) => {
  try {
    const types = await prisma.leaveType.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
    res.json({ types });
  } catch (e) { next(e); }
});

const typeSchema = z.object({
  code: z.string().min(2).max(40),
  nameAr: z.string().min(2).max(100),
  nameEn: z.string().min(2).max(100),
  rulesJson: z.record(z.any()),
  isActive: z.boolean().optional(),
});

router.post('/types', requirePerm('leaves.balances.write'), async (req, res, next) => {
  try {
    const data = typeSchema.parse(req.body);
    const type = await prisma.leaveType.create({ data });
    audit(req, 'leave_type.create', { entityType: 'leave_type', entityId: String(type.id), afterJson: type });
    res.status(201).json({ type });
  } catch (e) { next(e); }
});

router.patch('/types/:id', requirePerm('leaves.balances.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = typeSchema.partial().parse(req.body);
    const before = await prisma.leaveType.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'نوع الإجازة غير موجود' });
    const type = await prisma.leaveType.update({ where: { id }, data });
    audit(req, 'leave_type.update', { entityType: 'leave_type', entityId: String(id), beforeJson: before, afterJson: type });
    res.json({ type });
  } catch (e) { next(e); }
});

// ============ الأرصدة ============
async function ensureBalances(employeeId, year) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) return [];
  const types = await prisma.leaveType.findMany({ where: { isActive: true } });
  const out = [];
  for (const t of types) {
    let bal = await prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: t.id, year } },
    });
    if (!bal) {
      const rules = t.rulesJson || {};
      let entitled = Number(rules.daysPerYear || 0);
      if (t.code === 'annual') entitled = saudi.annualEntitlement(emp.hireDate);
      bal = await prisma.leaveBalance.create({
        data: { employeeId, leaveTypeId: t.id, year, entitled, accrued: entitled },
      });
    }
    out.push({ ...bal, leaveType: t });
  }
  return out;
}

router.get('/balances/me', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.json({ balances: null, noEmployeeFile: true }); // حساب بلا ملف موظف
    const year = Number(req.query.year) || new Date().getFullYear();
    const balances = await ensureBalances(empId, year);
    res.json({ balances });
  } catch (e) { next(e); }
});

router.get('/balances/:employeeId', requirePerm('leaves.read', 'leaves.balances.write'), async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const balances = await ensureBalances(req.params.employeeId, year);
    res.json({ balances });
  } catch (e) { next(e); }
});

// ============ الطلبات ============
const requestSchema = z.object({
  leaveTypeId: z.number().int().positive(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).optional().nullable(),
  attachmentUrl: z.string().max(500).optional().nullable(),
});

router.get('/requests', async (req, res, next) => {
  try {
    const where = { deletedAt: null };
    if (!canSeeAll(req)) {
      const empId = selfId(req);
      if (!empId) return res.json({ requests: [] });
      const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
      if (perms.includes('requests.read.team') || perms.includes('leaves.approve')) {
        const team = await prisma.employee.findMany({ where: { managerId: empId }, select: { id: true } });
        where.employeeId = { in: [empId, ...team.map((t) => t.id)] };
      } else {
        where.employeeId = empId;
      }
    }
    if (req.query.status) where.status = String(req.query.status);
    const requests = await prisma.leaveRequest.findMany({
      where,
      include: { leaveType: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const empIds = [...new Set(requests.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ requests: requests.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/requests', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const data = requestSchema.parse(req.body);
    const days = daysBetween(data.startDate, data.endDate);
    if (days <= 0) return res.status(400).json({ error: 'التواريخ غير صحيحة' });

    const type = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
    if (!type || !type.isActive) return res.status(404).json({ error: 'نوع الإجازة غير موجود' });
    const emp = await prisma.employee.findUnique({ where: { id: empId } });
    const rules = type.rulesJson || {};
    const year = new Date(data.startDate).getFullYear();

    // فحص الرصيد للأنواع ذات الاستحقاق السنوي
    if (rules.daysPerYear || type.code === 'annual') {
      const balances = await ensureBalances(empId, year);
      const bal = balances.find((b) => b.leaveTypeId === type.id);
      const available = (bal.entitled + bal.carried) - bal.used;
      if (days > available) {
        return res.status(400).json({ error: `الرصيد غير كافٍ — المتاح ${available} يوم، المطلوب ${days}` });
      }
    }
    // حج: مرة واحدة بعد سنتين خدمة
    if (type.code === 'hajj') {
      const usedBefore = await prisma.leaveRequest.count({
        where: { employeeId: empId, leaveType: { code: 'hajj' }, status: { in: ['approved', 'manager_approved'] } },
      });
      if (!saudi.hajjEligible(emp.hireDate, usedBefore > 0)) {
        return res.status(400).json({ error: 'غير مستحق لإجازة الحج — تتطلب سنتي خدمة وتُمنح مرة واحدة' });
      }
    }
    // مرضية: تفصيل فئات الأجر
    let sickDetail = null;
    if (type.code === 'sick') {
      const yearStart = new Date(year, 0, 1);
      const usedSick = await prisma.leaveRequest.aggregate({
        _sum: { days: true },
        where: { employeeId: empId, leaveType: { code: 'sick' }, status: 'approved', startDate: { gte: yearStart } },
      });
      sickDetail = saudi.sickPayTier(usedSick._sum.days || 0, days);
    }

    const request = await prisma.leaveRequest.create({
      data: {
        employeeId: empId,
        leaveTypeId: type.id,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        days,
        reason: data.reason || null,
        attachmentUrl: data.attachmentUrl || null,
      },
      include: { leaveType: true },
    });
    audit(req, 'leave.request.create', { entityType: 'leave_request', entityId: String(request.id), afterJson: { ...request, sickDetail } });
    res.status(201).json({ request, sickDetail });
  } catch (e) { next(e); }
});

router.post('/requests/:id/manager-decision', requirePerm('leaves.approve', 'requests.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision, note } = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }).parse(req.body);
    const reqRow = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!reqRow || reqRow.status !== 'pending') return res.status(400).json({ error: 'الطلب ليس بانتظار قرار المدير' });
    const managerId = selfId(req);
    const employee = await prisma.employee.findUnique({
      where: { id: reqRow.employeeId },
      select: { managerId: true },
    });
    if (!managerId || !employee || employee.managerId !== managerId) {
      return res.status(403).json({ error: 'لا تملك صلاحية اتخاذ قرار لهذا الموظف' });
    }
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: decision === 'approve' ? 'manager_approved' : 'rejected',
        managerId,
        managerNote: note || null,
        decidedAt: decision === 'reject' ? new Date() : null,
      },
    });
    audit(req, `leave.request.manager_${decision}`, { entityType: 'leave_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

router.post('/requests/:id/hr-decision', requirePerm('leaves.approve.hr'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision, note } = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }).parse(req.body);
    const reqRow = await prisma.leaveRequest.findUnique({ where: { id }, include: { leaveType: true } });
    if (!reqRow || reqRow.status !== 'manager_approved') return res.status(400).json({ error: 'الطلب ليس بانتظار اعتماد HR' });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: decision === 'approve' ? 'approved' : 'rejected',
          hrApproverId: req.user.id,
          hrNote: note || null,
          decidedAt: new Date(),
        },
      });
      if (decision === 'approve') {
        const year = reqRow.startDate.getFullYear();
        await tx.leaveBalance.updateMany({
          where: { employeeId: reqRow.employeeId, leaveTypeId: reqRow.leaveTypeId, year },
          data: { used: { increment: reqRow.days } },
        });
      }
      return u;
    });
    audit(req, `leave.request.hr_${decision}`, { entityType: 'leave_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

router.post('/requests/:id/cancel', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const reqRow = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!reqRow) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (reqRow.employeeId !== selfId(req) && !canSeeAll(req)) return res.status(403).json({ error: 'ممنوع' });
    if (!['pending', 'manager_approved'].includes(reqRow.status)) return res.status(400).json({ error: 'لا يمكن إلغاء الطلب في هذه الحالة' });
    const updated = await prisma.leaveRequest.update({ where: { id }, data: { status: 'cancelled' } });
    audit(req, 'leave.request.cancel', { entityType: 'leave_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

// ============ العطل الرسمية ============
router.get('/holidays', async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const holidays = await prisma.officialHoliday.findMany({ where: { year }, orderBy: { startDate: 'asc' } });
    res.json({ holidays });
  } catch (e) { next(e); }
});

router.post('/holidays', requirePerm('leaves.balances.write'), async (req, res, next) => {
  try {
    const data = z.object({
      nameAr: z.string().min(2), nameEn: z.string().min(2),
      startDate: z.string(), endDate: z.string(),
    }).parse(req.body);
    const holiday = await prisma.officialHoliday.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate), year: new Date(data.startDate).getFullYear() },
    });
    audit(req, 'holiday.create', { entityType: 'official_holiday', entityId: String(holiday.id) });
    res.status(201).json({ holiday });
  } catch (e) { next(e); }
});

module.exports = router;
