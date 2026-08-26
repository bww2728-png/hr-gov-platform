/**
 * Workflow Engine - Definitions, Instances, Steps with SLA tracking
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

router.get('/definitions', authenticate, requirePerm('workflow.def.read'), async (req, res, next) => {
  try {
    const defs = await prisma.workflowDefinition.findMany({
      include: { _count: { select: { instances: true } } },
      orderBy: { code: 'asc' },
    });
    res.json({ definitions: defs });
  } catch (e) { next(e); }
});

router.get('/definitions/:id', authenticate, requirePerm('workflow.def.read'), async (req, res, next) => {
  try {
    const def = await prisma.workflowDefinition.findUnique({ where: { id: parseInt(req.params.id, 10) } });
    if (!def) return res.status(404).json({ error: 'التعريف غير موجود' });
    res.json({ definition: def });
  } catch (e) { next(e); }
});

const definitionSchema = z.object({
  code: z.string().min(2),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional().nullable(),
  definitionJson: z.object({
    steps: z.array(z.object({
      code: z.string(),
      nameAr: z.string(),
      slaMins: z.number().int().positive(),
    })).min(1),
  }),
});

router.post('/definitions', authenticate, requirePerm('workflow.def.write'), async (req, res, next) => {
  try {
    const data = definitionSchema.parse(req.body);
    const def = await prisma.workflowDefinition.create({ data });
    audit(req, 'workflow.def.create', { entityType: 'workflow_definition', entityId: def.id });
    res.status(201).json({ definition: def });
  } catch (e) { next(e); }
});

// =========== INSTANCES ===========

router.get('/instances', authenticate, requirePerm('workflow.instance.read'), async (req, res, next) => {
  try {
    const { status, entityType, assignedToMe } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (entityType) where.entityType = String(entityType);
    if (assignedToMe === 'true') {
      where.steps = { some: { assigneeId: req.user.id, decidedAt: null } };
    }
    const instances = await prisma.workflowInstance.findMany({
      where,
      include: {
        definition: true,
        steps: { orderBy: { orderIndex: 'asc' } },
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
    });
    res.json({ instances });
  } catch (e) { next(e); }
});

const startInstanceSchema = z.object({
  definitionCode: z.string(),
  entityType: z.string(),
  entityId: z.string(),
});

router.post('/instances', authenticate, requirePerm('workflow.instance.create'), async (req, res, next) => {
  try {
    const { definitionCode, entityType, entityId } = startInstanceSchema.parse(req.body);
    const def = await prisma.workflowDefinition.findUnique({ where: { code: definitionCode } });
    if (!def) return res.status(404).json({ error: 'التعريف غير موجود' });
    if (!def.isActive) return res.status(400).json({ error: 'التعريف غير مفعّل' });

    const steps = def.definitionJson.steps;
    if (!steps || steps.length === 0) return res.status(400).json({ error: 'التعريف فارغ' });

    const firstStep = steps[0];
    const slaDeadline = new Date(Date.now() + firstStep.slaMins * 60_000);

    const instance = await prisma.workflowInstance.create({
      data: {
        definitionId: def.id,
        entityType, entityId,
        currentStep: firstStep.code,
        steps: {
          create: {
            stepCode: firstStep.code,
            stepNameAr: firstStep.nameAr,
            slaMinutes: firstStep.slaMins,
            slaDeadline,
            orderIndex: 0,
          },
        },
      },
      include: { steps: true, definition: true },
    });

    audit(req, 'workflow.instance.start', { entityType: 'workflow_instance', entityId: instance.id, afterJson: { definitionCode } });
    res.status(201).json({ instance });
  } catch (e) { next(e); }
});

const decideStepSchema = z.object({
  decision: z.enum(['approved','rejected','delegated']),
  comments: z.string().optional().nullable(),
  delegatedToId: z.string().uuid().optional().nullable(),
});

router.post('/instances/:id/decide', authenticate, requirePerm('workflow.instance.approve'), async (req, res, next) => {
  try {
    const { decision, comments, delegatedToId } = decideStepSchema.parse(req.body);
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: { steps: { orderBy: { orderIndex: 'asc' } }, definition: true },
    });
    if (!instance) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (instance.status !== 'running') return res.status(400).json({ error: 'الطلب مغلق' });

    const currentStep = instance.steps.find((s) => !s.decidedAt);
    if (!currentStep) return res.status(400).json({ error: 'لا توجد خطوة حالية' });

    // Decide current step
    await prisma.workflowStep.update({
      where: { id: currentStep.id },
      data: { decision, decidedAt: new Date(), comments, assigneeId: delegatedToId || currentStep.assigneeId },
    });

    let newStatus = 'running';
    let nextStepCode = null;

    if (decision === 'rejected') {
      newStatus = 'rejected';
    } else {
      // Move to next step
      const def = instance.definition;
      const steps = def.definitionJson.steps;
      const nextIdx = currentStep.orderIndex + 1;
      if (nextIdx < steps.length) {
        const nextStep = steps[nextIdx];
        const slaDeadline = new Date(Date.now() + nextStep.slaMins * 60_000);
        await prisma.workflowStep.create({
          data: {
            instanceId: instance.id,
            stepCode: nextStep.code,
            stepNameAr: nextStep.nameAr,
            slaMinutes: nextStep.slaMins,
            slaDeadline,
            assigneeId: delegatedToId,
            orderIndex: nextIdx,
          },
        });
        nextStepCode = nextStep.code;
      } else {
        newStatus = 'approved';
      }
    }

    const updated = await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: {
        status: newStatus,
        currentStep: nextStepCode || instance.currentStep,
        closedAt: newStatus !== 'running' ? new Date() : null,
      },
      include: { steps: { orderBy: { orderIndex: 'asc' } } },
    });

    audit(req, 'workflow.instance.decide', {
      entityType: 'workflow_instance', entityId: instance.id,
      afterJson: { decision, comments },
    });

    res.json({ instance: updated });
  } catch (e) { next(e); }
});

module.exports = router;