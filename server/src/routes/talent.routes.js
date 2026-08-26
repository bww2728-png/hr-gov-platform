/**
 * Talent Engine - خطط التعاقب + HiPo (معاملات 47-49)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

// ============ خطط التعاقب ============
router.get('/succession', requirePerm('succession.read'), async (req, res, next) => {
  try {
    const plans = await prisma.successionPlan.findMany({
      include: { candidates: true },
      orderBy: { createdAt: 'desc' },
    });
    const posIds = plans.map((p) => p.positionId);
    const positions = await prisma.position.findMany({ where: { id: { in: posIds } } });
    const posMap = Object.fromEntries(positions.map((p) => [p.id, p]));
    const empIds = [...new Set(plans.flatMap((p) => p.candidates.map((c) => c.employeeId)))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const empMap = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({
      plans: plans.map((p) => ({
        ...p,
        position: posMap[p.positionId] || null,
        candidates: p.candidates.map((c) => ({ ...c, employee: empMap[c.employeeId] || null })),
      })),
    });
  } catch (e) { next(e); }
});

router.post('/succession', requirePerm('succession.write'), async (req, res, next) => {
  try {
    const { positionId } = z.object({ positionId: z.number().int().positive() }).parse(req.body);
    const plan = await prisma.successionPlan.create({ data: { positionId } });
    audit(req, 'succession.plan.create', { entityType: 'succession_plan', entityId: String(plan.id) });
    res.status(201).json({ plan });
  } catch (e) { next(e); }
});

router.post('/succession/:id/candidates', requirePerm('succession.write', 'talent.nominate'), async (req, res, next) => {
  try {
    const planId = Number(req.params.id);
    const data = z.object({
      employeeId: z.string().uuid(),
      readiness: z.enum(['ready_now', 'ready_1y', 'ready_2_3y']),
      developmentNote: z.string().max(500).optional(),
    }).parse(req.body);
    const candidate = await prisma.successionCandidate.create({
      data: { planId, ...data, developmentNote: data.developmentNote || null },
    });
    audit(req, 'succession.candidate.add', { entityType: 'succession_candidate', entityId: String(candidate.id) });
    res.status(201).json({ candidate });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'الموظف مرشح مسبقاً لهذه الخطة' });
    next(e);
  }
});

router.post('/succession/:id/approve', requirePerm('succession.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const plan = await prisma.successionPlan.update({ where: { id }, data: { approvedById: req.user.id } });
    audit(req, 'succession.plan.approve', { entityType: 'succession_plan', entityId: String(id) });
    res.json({ plan });
  } catch (e) { next(e); }
});

// ============ المواهب عالية الإمكانات HiPo ============
router.get('/hipo', requirePerm('talent.hipo.read'), async (req, res, next) => {
  try {
    const members = await prisma.hipoMember.findMany({ orderBy: { createdAt: 'desc' } });
    const empIds = members.map((m) => m.employeeId);
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true, positionId: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ members: members.map((m) => ({ ...m, employee: map[m.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/hipo', requirePerm('talent.hipo.write', 'talent.nominate'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      programJson: z.record(z.any()).optional(),
    }).parse(req.body);
    const member = await prisma.hipoMember.create({
      data: { employeeId: data.employeeId, nominatedById: req.user.id, programJson: data.programJson || null },
    });
    audit(req, 'hipo.nominate', { entityType: 'hipo_member', entityId: String(member.id) });
    res.status(201).json({ member });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'الموظف عضو مسبقاً في برنامج المواهب' });
    next(e);
  }
});

router.patch('/hipo/:id', requirePerm('talent.hipo.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      status: z.enum(['active', 'graduated', 'removed']).optional(),
      programJson: z.record(z.any()).optional(),
    }).parse(req.body);
    const member = await prisma.hipoMember.update({ where: { id }, data });
    audit(req, 'hipo.update', { entityType: 'hipo_member', entityId: String(id), afterJson: data });
    res.json({ member });
  } catch (e) { next(e); }
});

module.exports = router;
