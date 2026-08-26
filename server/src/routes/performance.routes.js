/**
 * Performance Engine - دورات، OKR، تقييمات، تغذية 360، PIP (معاملات 37-41)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ الدورات ============
router.get('/cycles', async (req, res, next) => {
  try {
    const cycles = await prisma.perfCycle.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ cycles });
  } catch (e) { next(e); }
});

router.post('/cycles', requirePerm('perf.review.approve'), async (req, res, next) => {
  try {
    const data = z.object({
      code: z.string().min(2), nameAr: z.string().min(2),
      startDate: z.string(), endDate: z.string(),
    }).parse(req.body);
    const cycle = await prisma.perfCycle.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) },
    });
    audit(req, 'perf.cycle.create', { entityType: 'perf_cycle', entityId: String(cycle.id) });
    res.status(201).json({ cycle });
  } catch (e) { next(e); }
});

// ============ الأهداف OKR ============
router.get('/objectives', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('perf.review.read') || perms.includes('perf.review.approve');
    const where = {};
    if (req.query.cycleId) where.cycleId = Number(req.query.cycleId);
    if (req.query.employeeId && seeAll) where.employeeId = String(req.query.employeeId);
    else if (!seeAll) where.employeeId = selfId(req);
    const objectives = await prisma.objective.findMany({ where, include: { keyResults: true }, orderBy: { id: 'desc' } });
    res.json({ objectives });
  } catch (e) { next(e); }
});

router.post('/objectives', async (req, res, next) => {
  try {
    const data = z.object({
      cycleId: z.number().int(), title: z.string().min(3),
      description: z.string().optional(), weight: z.number().min(0.1).max(10).optional(),
      employeeId: z.string().uuid().optional(), // المدير يضيف لفريقه
      keyResults: z.array(z.object({
        title: z.string().min(2), targetValue: z.number(), unit: z.string().min(1),
      })).optional(),
    }).parse(req.body);
    const empId = data.employeeId || selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const objective = await prisma.objective.create({
      data: {
        employeeId: empId, cycleId: data.cycleId, title: data.title,
        description: data.description || null, weight: data.weight || 1.0,
        keyResults: data.keyResults?.length ? { create: data.keyResults } : undefined,
      },
      include: { keyResults: true },
    });
    audit(req, 'perf.objective.create', { entityType: 'objective', entityId: String(objective.id) });
    res.status(201).json({ objective });
  } catch (e) { next(e); }
});

router.patch('/keyresults/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { currentValue } = z.object({ currentValue: z.number() }).parse(req.body);
    const kr = await prisma.keyResult.update({ where: { id }, data: { currentValue } });
    res.json({ keyResult: kr });
  } catch (e) { next(e); }
});

// ============ التقييمات ============
router.get('/reviews', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('perf.review.read') || perms.includes('perf.review.approve');
    const where = {};
    if (req.query.cycleId) where.cycleId = Number(req.query.cycleId);
    if (!seeAll) where.employeeId = selfId(req);
    const reviews = await prisma.perfReview.findMany({ where, orderBy: { id: 'desc' }, take: 200 });
    const empIds = [...new Set(reviews.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ reviews: reviews.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/reviews', requirePerm('perf.review.write', 'perf.review.approve'), async (req, res, next) => {
  try {
    const data = z.object({ employeeId: z.string().uuid(), cycleId: z.number().int() }).parse(req.body);
    const review = await prisma.perfReview.create({
      data: { employeeId: data.employeeId, cycleId: data.cycleId, reviewerId: req.user.id },
    });
    audit(req, 'perf.review.create', { entityType: 'perf_review', entityId: String(review.id) });
    res.status(201).json({ review });
  } catch (e) { next(e); }
});

router.post('/reviews/:id/self', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { selfScore } = z.object({ selfScore: z.number().min(0).max(5) }).parse(req.body);
    const review = await prisma.perfReview.findUnique({ where: { id } });
    if (!review || review.employeeId !== selfId(req)) return res.status(403).json({ error: 'ممنوع' });
    if (review.status !== 'pending_self') return res.status(400).json({ error: 'التقييم ليس بمرحلة التقييم الذاتي' });
    const updated = await prisma.perfReview.update({ where: { id }, data: { selfScore, status: 'pending_manager' } });
    audit(req, 'perf.review.self', { entityType: 'perf_review', entityId: String(id) });
    res.json({ review: updated });
  } catch (e) { next(e); }
});

router.post('/reviews/:id/manager', requirePerm('perf.review.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      managerScore: z.number().min(0).max(5),
      strengths: z.string().optional(), improvements: z.string().optional(),
    }).parse(req.body);
    const review = await prisma.perfReview.findUnique({ where: { id } });
    if (!review || review.status !== 'pending_manager') return res.status(400).json({ error: 'التقييم ليس بمرحلة المدير' });
    const updated = await prisma.perfReview.update({
      where: { id },
      data: { ...data, status: 'pending_review' },
    });
    audit(req, 'perf.review.manager', { entityType: 'perf_review', entityId: String(id) });
    res.json({ review: updated });
  } catch (e) { next(e); }
});

router.post('/reviews/:id/finalize', requirePerm('perf.review.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { finalScore, rating } = z.object({
      finalScore: z.number().min(0).max(5),
      rating: z.enum(['exceptional', 'exceeds', 'meets', 'below', 'poor']),
    }).parse(req.body);
    const review = await prisma.perfReview.findUnique({ where: { id } });
    if (!review || review.status !== 'pending_review') return res.status(400).json({ error: 'التقييم ليس بمرحلة الاعتماد' });
    const updated = await prisma.perfReview.update({
      where: { id }, data: { finalScore, rating, status: 'completed', signedAt: new Date() },
    });
    audit(req, 'perf.review.finalize', { entityType: 'perf_review', entityId: String(id) });
    res.json({ review: updated });
  } catch (e) { next(e); }
});

// ============ التغذية الراجعة 360 ============
router.post('/feedback', async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), type: z.enum(['continuous', 'peer', '360']).default('peer'),
      content: z.string().min(5).max(2000), isAnonymous: z.boolean().optional(),
      cycleId: z.number().int().optional(),
      sentiment: z.enum(['positive', 'constructive']).optional(),
    }).parse(req.body);
    const giverId = selfId(req);
    if (!giverId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    if (data.employeeId === giverId) return res.status(400).json({ error: 'لا يمكن تقييم نفسك' });
    const entry = await prisma.feedbackEntry.create({
      data: { ...data, giverId, cycleId: data.cycleId || null, isAnonymous: !!data.isAnonymous, sentiment: data.sentiment || null },
    });
    audit(req, 'perf.feedback.create', { entityType: 'feedback_entry', entityId: String(entry.id) });
    res.status(201).json({ entry });
  } catch (e) { next(e); }
});

router.get('/feedback/:employeeId', async (req, res, next) => {
  try {
    const empId = req.params.employeeId;
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    if (empId !== selfId(req) && !(perms.includes('*') || perms.includes('perf.review.read') || perms.includes('team.employees.read'))) {
      return res.status(403).json({ error: 'ممنوع' });
    }
    const entries = await prisma.feedbackEntry.findMany({ where: { employeeId: empId }, orderBy: { createdAt: 'desc' }, take: 100 });
    // إخفاء هوية المُقيِّم للمجهول
    res.json({ entries: entries.map((e) => ({ ...e, giverId: e.isAnonymous ? null : e.giverId })) });
  } catch (e) { next(e); }
});

// ============ خطط تحسين الأداء PIP ============
router.get('/pips', requirePerm('pip.read'), async (req, res, next) => {
  try {
    const pips = await prisma.pip.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const empIds = [...new Set(pips.map((p) => p.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ pips: pips.map((p) => ({ ...p, employee: map[p.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/pips', requirePerm('pip.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), startDate: z.string(), endDate: z.string(),
      goalsJson: z.record(z.any()),
    }).parse(req.body);
    const pip = await prisma.pip.create({
      data: {
        employeeId: data.employeeId, managerId: selfId(req) || req.user.id,
        startDate: new Date(data.startDate), endDate: new Date(data.endDate), goalsJson: data.goalsJson,
      },
    });
    audit(req, 'pip.create', { entityType: 'pip', entityId: String(pip.id) });
    res.status(201).json({ pip });
  } catch (e) { next(e); }
});

router.post('/pips/:id/outcome', requirePerm('pip.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, outcomeNote } = z.object({
      status: z.enum(['extended', 'passed', 'failed', 'cancelled']),
      outcomeNote: z.string().max(1000).optional(),
    }).parse(req.body);
    const pip = await prisma.pip.update({ where: { id }, data: { status, outcomeNote: outcomeNote || null } });
    audit(req, 'pip.outcome', { entityType: 'pip', entityId: String(id), afterJson: { status } });
    res.json({ pip });
  } catch (e) { next(e); }
});

module.exports = router;
