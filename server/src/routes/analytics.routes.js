/**
 * Operational Excellence, Maturity, 5 Whys, Risk, Roadmap, Analytics
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

// =========== PROCESS KPIs ===========

router.get('/kpis', authenticate, requirePerm('opex.kpi.read'), async (req, res, next) => {
  try {
    const kpis = await prisma.processKPI.findMany({ orderBy: [{ processCode: 'asc' }, { nameAr: 'asc' }] });
    res.json({ kpis });
  } catch (e) { next(e); }
});

const kpiSchema = z.object({
  processCode: z.string().min(2),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional().nullable(),
  targetValue: z.number(),
  currentValue: z.number().default(0),
  measurementUnit: z.string(),
  frequency: z.enum(['daily','weekly','monthly','quarterly','yearly']).default('monthly'),
  direction: z.enum(['higher_is_better','lower_is_better']).default('higher_is_better'),
});

router.post('/kpis', authenticate, requirePerm('opex.kpi.write'), async (req, res, next) => {
  try {
    const data = kpiSchema.parse(req.body);
    const gap = data.direction === 'higher_is_better'
      ? data.targetValue - data.currentValue
      : data.currentValue - data.targetValue;
    const kpi = await prisma.processKPI.create({
      data: { ...data, gapAuto: gap, ownerId: req.user.id, lastMeasuredAt: new Date() },
    });
    audit(req, 'opex.kpi.create', { entityType: 'process_kpi', entityId: kpi.id });
    res.status(201).json({ kpi });
  } catch (e) { next(e); }
});

router.patch('/kpis/:id/measure', authenticate, requirePerm('opex.kpi.write'), async (req, res, next) => {
  try {
    const { currentValue } = z.object({ currentValue: z.number() }).parse(req.body);
    const kpi = await prisma.processKPI.findUnique({ where: { id: parseInt(req.params.id, 10) } });
    if (!kpi) return res.status(404).json({ error: 'المؤشر غير موجود' });
    const gap = kpi.direction === 'higher_is_better'
      ? kpi.targetValue - currentValue
      : currentValue - kpi.targetValue;
    const updated = await prisma.processKPI.update({
      where: { id: kpi.id },
      data: { currentValue, gapAuto: gap, lastMeasuredAt: new Date() },
    });
    audit(req, 'opex.kpi.measure', { entityType: 'process_kpi', entityId: kpi.id, afterJson: { currentValue } });
    res.json({ kpi: updated });
  } catch (e) { next(e); }
});

// =========== MATURITY (42 dimensions across 7 axes) ===========

router.get('/maturity/dimensions', authenticate, requirePerm('maturity.read'), async (req, res, next) => {
  try {
    const dimensions = await prisma.maturityDimension.findMany({
      include: { assessments: { orderBy: { assessedAt: 'desc' }, take: 1 } },
      orderBy: [{ axisId: 'asc' }, { code: 'asc' }],
    });
    res.json({ dimensions });
  } catch (e) { next(e); }
});

router.get('/maturity/summary', authenticate, requirePerm('maturity.read'), async (req, res, next) => {
  try {
    const dimensions = await prisma.maturityDimension.findMany({
      include: { assessments: { orderBy: { assessedAt: 'desc' }, take: 1 } },
    });
    const byAxis = {};
    let total = 0, count = 0;
    for (const d of dimensions) {
      const score = d.assessments[0]?.score || 0;
      total += score; count++;
      if (!byAxis[d.axisId]) byAxis[d.axisId] = { axisId: d.axisId, axisNameAr: d.axisNameAr, axisNameEn: d.axisNameEn, total: 0, count: 0, dimensions: [] };
      byAxis[d.axisId].total += score;
      byAxis[d.axisId].count++;
      byAxis[d.axisId].dimensions.push({ code: d.code, nameAr: d.nameAr, score });
    }
    const axes = Object.values(byAxis).map((a) => ({ ...a, avg: a.count ? +(a.total / a.count).toFixed(2) : 0 }));
    const overallAvg = count ? +(total / count).toFixed(2) : 0;
    res.json({ axes, overallAvg, totalDimensions: dimensions.length });
  } catch (e) { next(e); }
});

const assessmentSchema = z.object({
  dimensionId: z.number().int(),
  score: z.number().int().min(1).max(5),
  evidence: z.string().optional().nullable(),
  targetScore: z.number().int().min(1).max(5).optional().nullable(),
  targetDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/maturity/assess', authenticate, requirePerm('maturity.write'), async (req, res, next) => {
  try {
    const data = assessmentSchema.parse(req.body);
    const assessment = await prisma.maturityAssessment.create({
      data: {
        ...data,
        assessorId: req.user.id,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
      },
    });
    audit(req, 'maturity.assess', { entityType: 'maturity_dimension', entityId: data.dimensionId, afterJson: { score: data.score } });
    res.status(201).json({ assessment });
  } catch (e) { next(e); }
});

// =========== 5 WHYS ===========

router.get('/fivewhys', authenticate, requirePerm('fivewhys.read'), async (req, res, next) => {
  try {
    const analyses = await prisma.fiveWhysAnalysis.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ analyses });
  } catch (e) { next(e); }
});

const fiveWhysSchema = z.object({
  title: z.string().min(2),
  problemDesc: z.string(),
  treeJson: z.any(),
  rootCause: z.string().optional().nullable(),
  correctiveAction: z.string().optional().nullable(),
  linkedEntityType: z.string().optional().nullable(),
  linkedEntityId: z.string().optional().nullable(),
});

router.post('/fivewhys', authenticate, requirePerm('fivewhys.write'), async (req, res, next) => {
  try {
    const data = fiveWhysSchema.parse(req.body);
    const analysis = await prisma.fiveWhysAnalysis.create({
      data: { ...data, createdById: req.user.id },
    });
    audit(req, 'fivewhys.create', { entityType: 'five_whys', entityId: analysis.id });
    res.status(201).json({ analysis });
  } catch (e) { next(e); }
});

// =========== RISKS (C01-C15) ===========

router.get('/risks', authenticate, requirePerm('risk.read'), async (req, res, next) => {
  try {
    const risks = await prisma.risk.findMany({ orderBy: [{ score: 'desc' }, { code: 'asc' }] });
    res.json({ risks });
  } catch (e) { next(e); }
});

const riskSchema = z.object({
  code: z.string().min(2),
  titleAr: z.string().min(2),
  titleEn: z.string().min(2),
  category: z.enum(['operational','strategic','financial','compliance','security']),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigationPlan: z.string().optional().nullable(),
  status: z.enum(['identified','assessed','mitigated','accepted','closed']).default('identified'),
  reviewDate: z.string().optional().nullable(),
});

router.post('/risks', authenticate, requirePerm('risk.write'), async (req, res, next) => {
  try {
    const data = riskSchema.parse(req.body);
    const score = data.probability * data.impact;
    const level = score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low';
    const risk = await prisma.risk.create({
      data: {
        ...data,
        score, level,
        ownerId: req.user.id,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
      },
    });
    audit(req, 'risk.create', { entityType: 'risk', entityId: risk.id });
    res.status(201).json({ risk });
  } catch (e) { next(e); }
});

router.patch('/risks/:id', authenticate, requirePerm('risk.write'), async (req, res, next) => {
  try {
    const data = riskSchema.partial().parse(req.body);
    const updateData = { ...data };
    if (data.probability || data.impact) {
      const cur = await prisma.risk.findUnique({ where: { id: parseInt(req.params.id, 10) } });
      const p = data.probability || cur.probability;
      const i = data.impact || cur.impact;
      const score = p * i;
      const level = score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low';
      updateData.score = score;
      updateData.level = level;
    }
    if (data.reviewDate) updateData.reviewDate = new Date(data.reviewDate);
    const risk = await prisma.risk.update({ where: { id: parseInt(req.params.id, 10) }, data: updateData });
    audit(req, 'risk.update', { entityType: 'risk', entityId: risk.id, afterJson: data });
    res.json({ risk });
  } catch (e) { next(e); }
});

// =========== ROADMAP (52 weeks) ===========

router.get('/roadmap', authenticate, requirePerm('roadmap.read'), async (req, res, next) => {
  try {
    const items = await prisma.roadmapItem.findMany({ orderBy: [{ weekNumber: 'asc' }] });
    res.json({ items });
  } catch (e) { next(e); }
});

const roadmapSchema = z.object({
  weekNumber: z.number().int().min(1).max(52),
  titleAr: z.string().min(2),
  titleEn: z.string().min(2),
  description: z.string().optional().nullable(),
  dependencies: z.array(z.number().int()).default([]),
  deliverable: z.string().optional().nullable(),
  kpi: z.string().optional().nullable(),
  status: z.enum(['pending','in_progress','done','blocked','skipped']).default('pending'),
  targetDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

router.post('/roadmap', authenticate, requirePerm('roadmap.write'), async (req, res, next) => {
  try {
    const data = roadmapSchema.parse(req.body);
    const item = await prisma.roadmapItem.create({
      data: { ...data, ownerId: req.user.id, targetDate: data.targetDate ? new Date(data.targetDate) : null },
    });
    audit(req, 'roadmap.create', { entityType: 'roadmap_item', entityId: item.id });
    res.status(201).json({ item });
  } catch (e) { next(e); }
});

router.patch('/roadmap/:id', authenticate, requirePerm('roadmap.write'), async (req, res, next) => {
  try {
    const data = roadmapSchema.partial().parse(req.body);
    const updateData = { ...data };
    if (data.targetDate) updateData.targetDate = new Date(data.targetDate);
    if (data.status === 'done') updateData.completedAt = new Date();
    const item = await prisma.roadmapItem.update({ where: { id: parseInt(req.params.id, 10) }, data: updateData });
    audit(req, 'roadmap.update', { entityType: 'roadmap_item', entityId: item.id, afterJson: data });
    res.json({ item });
  } catch (e) { next(e); }
});

// =========== ANALYTICS DASHBOARD ===========

router.get('/dashboard', authenticate, requirePerm('analytics.read'), async (req, res, next) => {
  try {
    const [totalEmployees, activeEmployees, noticeEmployees, openPostings, pendingApps, criticalViolations, openHighRisks, maturityAvg, doneRoadmap, totalRoadmap] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { employmentStatus: 'active' } }),
      prisma.employee.count({ where: { employmentStatus: 'notice_period' } }),
      prisma.jobPosting.count({ where: { status: 'open' } }),
      prisma.application.count({ where: { stage: { in: ['applied', 'screening'] } } }),
      prisma.complianceViolation.count({ where: { severity: 'critical', status: { not: 'resolved' } } }),
      prisma.risk.count({ where: { level: { in: ['high', 'critical'] }, status: { not: 'closed' } } }),
      prisma.maturityAssessment.aggregate({ _avg: { score: true } }),
      prisma.roadmapItem.count({ where: { status: 'done' } }),
      prisma.roadmapItem.count(),
    ]);

    res.json({
      totalEmployees, activeEmployees, noticeEmployees, openPostings, pendingApps,
      criticalViolations, openHighRisks,
      maturityAvg: maturityAvg._avg.score || 0,
      roadmapProgress: { done: doneRoadmap, total: totalRoadmap },
    });
  } catch (e) { next(e); }
});

module.exports = router;