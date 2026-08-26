/**
 * Lifecycle Engine - Job postings, candidates, applications, interviews, offers,
 * onboarding, exit interviews.
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

// =========== JOB POSTINGS ===========

router.get('/postings', authenticate, requirePerm('lifecycle.posting.read'), async (req, res, next) => {
  try {
    const postings = await prisma.jobPosting.findMany({
      include: {
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ postings });
  } catch (e) { next(e); }
});

const postingSchema = z.object({
  titleAr: z.string().min(2),
  titleEn: z.string().min(2),
  description: z.string().optional().nullable(),
  branchId: z.number().int().optional().nullable(),
  deptId: z.number().int().optional().nullable(),
  status: z.enum(['draft', 'open', 'on_hold', 'closed']).default('draft'),
  openings: z.number().int().positive().default(1),
});

router.post('/postings', authenticate, requirePerm('lifecycle.posting.write'), async (req, res, next) => {
  try {
    const data = postingSchema.parse(req.body);
    const code = `JP-${String(Date.now()).slice(-6)}`;
    const posting = await prisma.jobPosting.create({
      data: {
        ...data,
        code,
        publishedAt: data.status === 'open' ? new Date() : null,
        createdById: req.user.id,
      },
    });
    audit(req, 'lifecycle.posting.create', { entityType: 'job_posting', entityId: posting.id });
    res.status(201).json({ posting });
  } catch (e) { next(e); }
});

router.patch('/postings/:id', authenticate, requirePerm('lifecycle.posting.write'), async (req, res, next) => {
  try {
    const data = postingSchema.partial().parse(req.body);
    const updateData = { ...data };
    if (data.status === 'open') updateData.publishedAt = new Date();
    if (data.status === 'closed') updateData.closedAt = new Date();
    const posting = await prisma.jobPosting.update({ where: { id: parseInt(req.params.id, 10) }, data: updateData });
    audit(req, 'lifecycle.posting.update', { entityType: 'job_posting', entityId: posting.id });
    res.json({ posting });
  } catch (e) { next(e); }
});

// =========== CANDIDATES ===========

router.get('/candidates', authenticate, requirePerm('lifecycle.candidate.read'), async (req, res, next) => {
  try {
    const { search, source } = req.query;
    const where = {};
    if (search) where.OR = [
      { fullNameAr: { contains: String(search), mode: 'insensitive' } },
      { fullNameEn: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ];
    if (source) where.source = String(source);
    const candidates = await prisma.candidate.findMany({
      where,
      include: { applications: { include: { posting: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ candidates });
  } catch (e) { next(e); }
});

const candidateSchema = z.object({
  fullNameAr: z.string().min(2),
  fullNameEn: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  source: z.enum(['portal', 'referral', 'agency', 'social', 'linkedin']).default('portal'),
  resumeUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/candidates', authenticate, requirePerm('lifecycle.candidate.write'), async (req, res, next) => {
  try {
    const data = candidateSchema.parse(req.body);
    // Bias flags heuristic (mock): flag if name is suspicious (placeholder)
    const biasFlags = {};
    const candidate = await prisma.candidate.create({ data: { ...data, biasFlags } });
    audit(req, 'lifecycle.candidate.create', { entityType: 'candidate', entityId: candidate.id });
    res.status(201).json({ candidate });
  } catch (e) { next(e); }
});

// =========== APPLICATIONS ===========

router.get('/applications', authenticate, requirePerm('lifecycle.application.read'), async (req, res, next) => {
  try {
    const { postingId, stage, candidateId } = req.query;
    const where = {};
    if (postingId) where.postingId = parseInt(postingId, 10);
    if (stage) where.stage = String(stage);
    if (candidateId) where.candidateId = parseInt(candidateId, 10);
    const applications = await prisma.application.findMany({
      where,
      include: {
        candidate: true,
        posting: true,
        interviews: true,
        offer: true,
      },
      orderBy: { appliedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
});

// Pipeline counts
router.get('/pipeline', authenticate, requirePerm('lifecycle.application.read'), async (req, res, next) => {
  try {
    const stages = ['applied','screening','interview','assessment','offer','hired','rejected','withdrawn'];
    const counts = {};
    for (const s of stages) {
      counts[s] = await prisma.application.count({ where: { stage: s } });
    }
    res.json({ counts, total: Object.values(counts).reduce((a,b)=>a+b,0) });
  } catch (e) { next(e); }
});

router.patch('/applications/:id/stage', authenticate, requirePerm('lifecycle.application.write'), async (req, res, next) => {
  try {
    const { stage } = z.object({ stage: z.enum(['applied','screening','interview','assessment','offer','hired','rejected','withdrawn']) }).parse(req.body);
    const app = await prisma.application.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { stage, closedAt: ['hired','rejected','withdrawn'].includes(stage) ? new Date() : null },
    });
    audit(req, 'lifecycle.application.stage_change', {
      entityType: 'application', entityId: app.id, afterJson: { stage },
    });
    res.json({ application: app });
  } catch (e) { next(e); }
});

// =========== INTERVIEWS ===========

const interviewSchema = z.object({
  applicationId: z.number().int(),
  scheduledAt: z.string(),
  durationMins: z.number().int().positive().default(60),
  panelJson: z.any().optional().nullable(),
  decision: z.enum(['strong_hire', 'hire', 'no_hire', 'strong_no_hire']).optional().nullable(),
  notes: z.string().optional().nullable(),
  feedbackJson: z.any().optional().nullable(),
});

router.post('/interviews', authenticate, requirePerm('lifecycle.interview.write'), async (req, res, next) => {
  try {
    const data = interviewSchema.parse(req.body);
    const interview = await prisma.interview.create({
      data: { ...data, scheduledAt: new Date(data.scheduledAt) },
    });
    audit(req, 'lifecycle.interview.schedule', { entityType: 'interview', entityId: interview.id });
    res.status(201).json({ interview });
  } catch (e) { next(e); }
});

// =========== OFFERS ===========

const offerSchema = z.object({
  applicationId: z.number().int(),
  salary: z.number().or(z.string()),
  currency: z.string().default('SAR'),
  benefits: z.any().optional().nullable(),
  startDate: z.string(),
  status: z.enum(['draft','sent','accepted','declined','expired']).default('draft'),
});

router.post('/offers', authenticate, requirePerm('lifecycle.offer.write'), async (req, res, next) => {
  try {
    const data = offerSchema.parse(req.body);
    const offer = await prisma.offer.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        sentAt: data.status === 'sent' ? new Date() : null,
      },
    });
    audit(req, 'lifecycle.offer.create', { entityType: 'offer', entityId: offer.id });
    res.status(201).json({ offer });
  } catch (e) { next(e); }
});

// =========== ONBOARDING ===========

router.get('/onboarding/:employeeId', authenticate, requirePerm('lifecycle.onboarding.read'), async (req, res, next) => {
  try {
    const tasks = await prisma.onboardingTask.findMany({
      where: { employeeId: req.params.employeeId },
      orderBy: { dueDate: 'asc' },
    });
    res.json({ tasks });
  } catch (e) { next(e); }
});

router.patch('/onboarding/:id', authenticate, requirePerm('lifecycle.onboarding.write'), async (req, res, next) => {
  try {
    const data = z.object({
      status: z.enum(['pending','in_progress','done','blocked']).optional(),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const task = await prisma.onboardingTask.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { ...data, completedAt: data.status === 'done' ? new Date() : null },
    });
    audit(req, 'lifecycle.onboarding.update', { entityType: 'onboarding_task', entityId: task.id, afterJson: data });
    res.json({ task });
  } catch (e) { next(e); }
});

// =========== EXIT INTERVIEWS ===========

router.post('/exit-interviews', authenticate, requirePerm('lifecycle.exit.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      primaryReason: z.string().optional().nullable(),
      fiveWhysJson: z.any().optional().nullable(),
      knowledgeTransfer: z.any().optional().nullable(),
      feedbackJson: z.any().optional().nullable(),
      satisfactionScore: z.number().int().min(0).max(10).optional().nullable(),
      rehireEligible: z.boolean().default(true),
    }).parse(req.body);
    const exit = await prisma.exitInterview.create({
      data: { ...data, conductedAt: new Date(), conductedById: req.user.id },
    });
    audit(req, 'lifecycle.exit.create', { entityType: 'exit_interview', entityId: exit.id });
    res.status(201).json({ exitInterview: exit });
  } catch (e) { next(e); }
});

module.exports = router;