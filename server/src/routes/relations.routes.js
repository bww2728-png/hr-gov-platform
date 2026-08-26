/**
 * Labor Relations Engine - قضايا تأديبية + تظلمات (معاملات 65-68)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ القضايا التأديبية ============
router.get('/disciplinary', requirePerm('disciplinary.read'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
    const cases = await prisma.disciplinaryCase.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(cases.map((c) => c.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ cases: cases.map((c) => ({ ...c, employee: map[c.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/disciplinary', requirePerm('disciplinary.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      violation: z.string().min(5).max(500),
      severity: z.enum(['minor', 'medium', 'major', 'severe']),
      investigationNote: z.string().max(5000).optional(),
    }).parse(req.body);
    const row = await prisma.disciplinaryCase.create({ data });
    audit(req, 'disciplinary.create', { entityType: 'disciplinary_case', entityId: String(row.id), afterJson: row });
    res.status(201).json({ case: row });
  } catch (e) { next(e); }
});

// دفاع الموظف عن نفسه
router.post('/disciplinary/:id/defense', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { employeeDefense } = z.object({ employeeDefense: z.string().min(5).max(5000) }).parse(req.body);
    const row = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!row || row.employeeId !== selfId(req)) return res.status(403).json({ error: 'ممنوع' });
    if (row.status !== 'investigating') return res.status(400).json({ error: 'القضية ليست قيد التحقيق' });
    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: { employeeDefense } });
    audit(req, 'disciplinary.defense', { entityType: 'disciplinary_case', entityId: String(id) });
    res.json({ case: updated });
  } catch (e) { next(e); }
});

router.post('/disciplinary/:id/decide', requirePerm('disciplinary.decide'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { action } = z.object({
      action: z.enum(['none', 'warning_written', 'fine', 'suspension', 'termination']),
    }).parse(req.body);
    const row = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!row || row.status !== 'investigating') return res.status(400).json({ error: 'القضية ليست قيد التحقيق' });
    const updated = await prisma.disciplinaryCase.update({
      where: { id },
      data: { action, status: 'decided', decidedById: req.user.id, decidedAt: new Date() },
    });
    audit(req, 'disciplinary.decide', { entityType: 'disciplinary_case', entityId: String(id), afterJson: { action } });
    res.json({ case: updated });
  } catch (e) { next(e); }
});

// تظلم من القرار التأديبي
router.post('/disciplinary/:id/appeal', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { appealNote } = z.object({ appealNote: z.string().min(5).max(3000) }).parse(req.body);
    const row = await prisma.disciplinaryCase.findUnique({ where: { id } });
    if (!row || row.employeeId !== selfId(req)) return res.status(403).json({ error: 'ممنوع' });
    if (row.status !== 'decided') return res.status(400).json({ error: 'لا يوجد قرار للتظلم منه' });
    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: { status: 'appealed', appealNote } });
    audit(req, 'disciplinary.appeal', { entityType: 'disciplinary_case', entityId: String(id) });
    res.json({ case: updated });
  } catch (e) { next(e); }
});

router.post('/disciplinary/:id/close', requirePerm('disciplinary.decide'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: { status: 'closed' } });
    audit(req, 'disciplinary.close', { entityType: 'disciplinary_case', entityId: String(id) });
    res.json({ case: updated });
  } catch (e) { next(e); }
});

// ============ التظلمات ============
router.get('/grievances', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('grievances.read') || perms.includes('grievances.resolve');
    const where = seeAll ? {} : { employeeId: selfId(req) };
    if (req.query.status) where.status = String(req.query.status);
    const grievances = await prisma.grievance.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(grievances.map((g) => g.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ grievances: grievances.map((g) => ({ ...g, employee: seeAll ? (map[g.employeeId] || null) : undefined })) });
  } catch (e) { next(e); }
});

router.post('/grievances', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const data = z.object({
      subject: z.string().min(5).max(200), details: z.string().min(10).max(5000),
    }).parse(req.body);
    const grievance = await prisma.grievance.create({ data: { employeeId: empId, ...data } });
    audit(req, 'grievance.create', { entityType: 'grievance', entityId: String(grievance.id) });
    res.status(201).json({ grievance });
  } catch (e) { next(e); }
});

router.post('/grievances/:id/resolve', requirePerm('grievances.resolve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      resolution: z.string().min(5).max(3000),
      escalate: z.boolean().optional(),
    }).parse(req.body);
    const row = await prisma.grievance.findUnique({ where: { id } });
    if (!row || ['resolved', 'closed'].includes(row.status)) return res.status(400).json({ error: 'التظلم مغلق' });
    const updated = await prisma.grievance.update({
      where: { id },
      data: {
        status: data.escalate ? 'escalated' : 'resolved',
        resolution: data.resolution,
        resolvedById: req.user.id,
        escalatedToId: data.escalate ? req.user.id : null,
      },
    });
    audit(req, 'grievance.resolve', { entityType: 'grievance', entityId: String(id), afterJson: { escalated: !!data.escalate } });
    res.json({ grievance: updated });
  } catch (e) { next(e); }
});

// تقييم رضا الموظف عن الحل
router.post('/grievances/:id/satisfaction', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { satisfied } = z.object({ satisfied: z.boolean() }).parse(req.body);
    const row = await prisma.grievance.findUnique({ where: { id } });
    if (!row || row.employeeId !== selfId(req)) return res.status(403).json({ error: 'ممنوع' });
    if (row.status !== 'resolved') return res.status(400).json({ error: 'التظلم لم يُحل بعد' });
    const updated = await prisma.grievance.update({
      where: { id },
      data: { satisfied, status: satisfied ? 'closed' : 'escalated' },
    });
    audit(req, 'grievance.satisfaction', { entityType: 'grievance', entityId: String(id), afterJson: { satisfied } });
    res.json({ grievance: updated });
  } catch (e) { next(e); }
});

module.exports = router;
