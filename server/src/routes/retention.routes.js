/**
 * Retention Engine - استطلاعات (eNPS/نبض)، مقابلات البقاء، مؤشرات الاحتفاظ (معاملات 50-53)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ الاستطلاعات ============
router.get('/surveys', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const manage = perms.includes('*') || perms.includes('surveys.read') || perms.includes('surveys.write');
    const where = manage ? {} : { status: 'open' };
    const surveys = await prisma.survey.findMany({
      where,
      include: { questions: { orderBy: { orderIndex: 'asc' } }, _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ surveys });
  } catch (e) { next(e); }
});

router.post('/surveys', requirePerm('surveys.write'), async (req, res, next) => {
  try {
    const data = z.object({
      code: z.string().min(2), titleAr: z.string().min(3),
      type: z.enum(['enps', 'pulse', 'engagement']),
      opensAt: z.string().optional(), closesAt: z.string().optional(),
      isAnonymous: z.boolean().optional(),
      questions: z.array(z.object({
        text: z.string().min(3), scale: z.enum(['0_10', '1_5', 'text']).default('0_10'),
      })).min(1),
    }).parse(req.body);
    const survey = await prisma.survey.create({
      data: {
        code: data.code, titleAr: data.titleAr, type: data.type,
        opensAt: data.opensAt ? new Date(data.opensAt) : null,
        closesAt: data.closesAt ? new Date(data.closesAt) : null,
        isAnonymous: data.isAnonymous !== false,
        questions: { create: data.questions.map((q, i) => ({ ...q, orderIndex: i + 1 })) },
      },
      include: { questions: true },
    });
    audit(req, 'survey.create', { entityType: 'survey', entityId: String(survey.id) });
    res.status(201).json({ survey });
  } catch (e) { next(e); }
});

router.post('/surveys/:id/status', requirePerm('surveys.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.enum(['open', 'closed']) }).parse(req.body);
    const survey = await prisma.survey.update({ where: { id }, data: { status } });
    audit(req, 'survey.status', { entityType: 'survey', entityId: String(id), afterJson: { status } });
    res.json({ survey });
  } catch (e) { next(e); }
});

router.post('/surveys/:id/respond', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { answers } = z.object({ answers: z.record(z.union([z.number(), z.string()])) }).parse(req.body);
    const survey = await prisma.survey.findUnique({ where: { id }, include: { questions: true } });
    if (!survey || survey.status !== 'open') return res.status(400).json({ error: 'الاستطلاع غير مفتوح' });
    const deptId = req.user.employee?.deptId || null;
    const response = await prisma.surveyResponse.create({
      data: { surveyId: id, answersJson: answers, deptId },
    });
    audit(req, 'survey.respond', { entityType: 'survey_response', entityId: String(response.id) });
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// نتائج + eNPS
router.get('/surveys/:id/results', requirePerm('surveys.read', 'surveys.write', 'retention.read'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const survey = await prisma.survey.findUnique({ where: { id }, include: { questions: true, responses: true } });
    if (!survey) return res.status(404).json({ error: 'الاستطلاع غير موجود' });

    const results = { total: survey.responses.length, byQuestion: {}, enps: null };
    for (const q of survey.questions) {
      const values = survey.responses
        .map((r) => Number(r.answersJson?.[q.id]))
        .filter((v) => !Number.isNaN(v));
      if (!values.length) { results.byQuestion[q.id] = { text: q.text, count: 0 }; continue; }
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      results.byQuestion[q.id] = { text: q.text, count: values.length, avg: Math.round(avg * 100) / 100, scale: q.scale };
      // eNPS: أول سؤال بمقياس 0_10
      if (survey.type === 'enps' && q.scale === '0_10' && results.enps === null) {
        const promoters = values.filter((v) => v >= 9).length;
        const detractors = values.filter((v) => v <= 6).length;
        results.enps = Math.round(((promoters - detractors) / values.length) * 100);
        results.enpsBreakdown = { promoters, passives: values.length - promoters - detractors, detractors };
      }
    }
    res.json({ survey: { id: survey.id, titleAr: survey.titleAr, type: survey.type, status: survey.status }, results });
  } catch (e) { next(e); }
});

// ============ مقابلات البقاء ============
router.get('/stay-interviews', requirePerm('stay_interview.read', 'stay_interview.write'), async (req, res, next) => {
  try {
    const interviews = await prisma.stayInterview.findMany({ orderBy: { conductedAt: 'desc' }, take: 100 });
    const empIds = [...new Set(interviews.map((i) => i.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ interviews: interviews.map((i) => ({ ...i, employee: map[i.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/stay-interviews', requirePerm('stay_interview.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), satisfaction: z.number().int().min(1).max(10).optional(),
      issuesJson: z.record(z.any()).optional(), actionsJson: z.record(z.any()).optional(),
      followUpAt: z.string().optional(),
    }).parse(req.body);
    const interview = await prisma.stayInterview.create({
      data: {
        employeeId: data.employeeId, conductedById: req.user.id, conductedAt: new Date(),
        satisfaction: data.satisfaction || null, issuesJson: data.issuesJson || null,
        actionsJson: data.actionsJson || null,
        followUpAt: data.followUpAt ? new Date(data.followUpAt) : null,
        status: data.followUpAt ? 'follow_up' : 'done',
      },
    });
    audit(req, 'stay_interview.create', { entityType: 'stay_interview', entityId: String(interview.id) });
    res.status(201).json({ interview });
  } catch (e) { next(e); }
});

// ============ لوحة مؤشرات الاحتفاظ ============
router.get('/dashboard', requirePerm('retention.read', 'surveys.read'), async (req, res, next) => {
  try {
    const total = await prisma.employee.count({ where: { employmentStatus: 'active', deletedAt: null } });
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const exits = await prisma.employee.count({
      where: { employmentStatus: 'terminated', updatedAt: { gte: yearStart } },
    });
    const latestEnps = await prisma.survey.findFirst({
      where: { type: 'enps', status: { in: ['open', 'closed'] } },
      orderBy: { createdAt: 'desc' },
      include: { responses: true, questions: true },
    });
    let enps = null;
    if (latestEnps && latestEnps.responses.length && latestEnps.questions.length) {
      const q = latestEnps.questions.find((x) => x.scale === '0_10');
      if (q) {
        const values = latestEnps.responses.map((r) => Number(r.answersJson?.[q.id])).filter((v) => !Number.isNaN(v));
        if (values.length) {
          const promoters = values.filter((v) => v >= 9).length;
          const detractors = values.filter((v) => v <= 6).length;
          enps = Math.round(((promoters - detractors) / values.length) * 100);
        }
      }
    }
    res.json({
      totalActive: total,
      exitsThisYear: exits,
      turnoverPct: total + exits > 0 ? Math.round((exits / (total + exits)) * 1000) / 10 : 0,
      latestEnps: enps,
    });
  } catch (e) { next(e); }
});

module.exports = router;
