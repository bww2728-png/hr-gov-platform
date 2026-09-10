/**
 * Unified Requests Center - مركز الطلبات الموحد (معاملات 29-36, 51-53, 57)
 * كل طلبات الموظف: إجازة/سلفة/تدريب/شهادة/إضافي/تحديث بيانات — بنمط واحد:
 * تقديم → اعتماد مدير → معالجة HR → تنفيذ
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ أنواع الطلبات ============
router.get('/types', async (req, res, next) => {
  try {
    const types = await prisma.requestType.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
    res.json({ types });
  } catch (e) { next(e); }
});

router.post('/types', requirePerm('admin.settings.write', 'requests.process'), async (req, res, next) => {
  try {
    const data = z.object({
      code: z.string().min(2), nameAr: z.string().min(2), nameEn: z.string().min(2),
      workflowDefCode: z.string().optional(), formSchema: z.record(z.any()).optional(),
    }).parse(req.body);
    const type = await prisma.requestType.create({ data });
    audit(req, 'request_type.create', { entityType: 'request_type', entityId: String(type.id) });
    res.status(201).json({ type });
  } catch (e) { next(e); }
});

// ============ الطلبات ============
router.get('/', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('requests.read.all') || perms.includes('requests.process');
    const seeTeam = perms.includes('requests.read.team') || perms.includes('requests.approve');

    const where = {};
    if (!seeAll) {
      const empId = selfId(req);
      if (seeTeam && empId) {
        const team = await prisma.employee.findMany({ where: { managerId: empId }, select: { id: true } });
        where.employeeId = { in: [empId, ...team.map((t) => t.id)] };
      } else if (empId) {
        where.employeeId = empId;
      } else {
        // مستخدم بلا ملف موظف ولا صلاحية قراءة واسعة — لا شيء يراه (employeeId غير قابل للـ null)
        return res.json({ requests: [] });
      }
    }
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.typeId) where.typeId = Number(req.query.typeId);

    const requests = await prisma.employeeRequest.findMany({
      where, include: { type: true }, orderBy: { createdAt: 'desc' }, take: 300,
    });
    const empIds = [...new Set(requests.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ requests: requests.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const data = z.object({
      typeId: z.number().int().positive(),
      payload: z.record(z.any()),
      note: z.string().max(500).optional(),
    }).parse(req.body);
    const type = await prisma.requestType.findUnique({ where: { id: data.typeId } });
    if (!type || !type.isActive) return res.status(404).json({ error: 'نوع الطلب غير موجود' });

    const request = await prisma.employeeRequest.create({
      data: { typeId: type.id, employeeId: empId, payloadJson: data.payload, note: data.note || null },
      include: { type: true },
    });
    audit(req, 'request.create', { entityType: 'employee_request', entityId: String(request.id), afterJson: { type: type.code } });
    res.status(201).json({ request });
  } catch (e) { next(e); }
});

// قرار المدير: submitted → in_approval (أو rejected)
router.post('/:id/manager-decision', requirePerm('requests.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision, note } = z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }).parse(req.body);
    const row = await prisma.employeeRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'submitted') return res.status(400).json({ error: 'الطلب ليس بانتظار قرار المدير' });
    const updated = await prisma.employeeRequest.update({
      where: { id },
      data: {
        status: decision === 'approve' ? 'in_approval' : 'rejected',
        decidedById: req.user.id, decidedAt: new Date(), note: note || row.note,
      },
    });
    audit(req, `request.manager_${decision}`, { entityType: 'employee_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

// معالجة HR: in_approval → approved / rejected؛ ثم تنفيذ → done
router.post('/:id/hr-decision', requirePerm('requests.process'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision, note } = z.object({ decision: z.enum(['approve', 'reject', 'done']), note: z.string().max(500).optional() }).parse(req.body);
    const row = await prisma.employeeRequest.findUnique({ where: { id }, include: { type: true } });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    const allowed = { approve: ['in_approval'], reject: ['submitted', 'in_approval'], done: ['approved'] };
    if (!allowed[decision].includes(row.status)) {
      return res.status(400).json({ error: `لا يمكن تنفيذ ${decision} على حالة ${row.status}` });
    }
    const statusMap = { approve: 'approved', reject: 'rejected', done: 'done' };
    const updated = await prisma.employeeRequest.update({
      where: { id },
      data: { status: statusMap[decision], decidedById: req.user.id, decidedAt: new Date(), note: note || row.note },
    });
    audit(req, `request.hr_${decision}`, { entityType: 'employee_request', entityId: String(id), afterJson: { type: row.type.code } });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.employeeRequest.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (row.employeeId !== selfId(req)) return res.status(403).json({ error: 'ممنوع' });
    if (!['submitted', 'in_approval'].includes(row.status)) return res.status(400).json({ error: 'لا يمكن إلغاء الطلب في هذه الحالة' });
    const updated = await prisma.employeeRequest.update({ where: { id }, data: { status: 'cancelled' } });
    audit(req, 'request.cancel', { entityType: 'employee_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

module.exports = router;
