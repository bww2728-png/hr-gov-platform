/**
 * Compliance Engine - Rules, Violations, Document Expiries
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

router.get('/rules', authenticate, requirePerm('compliance.rule.read'), async (req, res, next) => {
  try {
    const rules = await prisma.complianceRule.findMany({
      include: { _count: { select: { violations: true } } },
      orderBy: { code: 'asc' },
    });
    res.json({ rules });
  } catch (e) { next(e); }
});

const ruleSchema = z.object({
  code: z.string().min(2),
  nameAr: z.string().min(2),
  nameEn: z.string().min(2),
  description: z.string().optional().nullable(),
  jurisdiction: z.string().default('SA'),
  ruleJson: z.any(),
  severity: z.enum(['info','warning','critical']).default('warning'),
});

router.post('/rules', authenticate, requirePerm('compliance.rule.write'), async (req, res, next) => {
  try {
    const data = ruleSchema.parse(req.body);
    const rule = await prisma.complianceRule.create({ data });
    audit(req, 'compliance.rule.create', { entityType: 'compliance_rule', entityId: rule.id });
    res.status(201).json({ rule });
  } catch (e) { next(e); }
});

router.get('/violations', authenticate, requirePerm('compliance.violation.read'), async (req, res, next) => {
  try {
    const { status, severity } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (severity) where.severity = String(severity);
    const violations = await prisma.complianceViolation.findMany({
      where,
      include: { rule: true },
      orderBy: { detectedAt: 'desc' },
    });
    res.json({ violations });
  } catch (e) { next(e); }
});

router.patch('/violations/:id/resolve', authenticate, requirePerm('compliance.violation.resolve'), async (req, res, next) => {
  try {
    const data = z.object({
      status: z.enum(['resolved','false_positive','in_progress']),
      notes: z.string().optional().nullable(),
    }).parse(req.body);
    const v = await prisma.complianceViolation.update({
      where: { id: parseInt(req.params.id, 10) },
      data: { ...data, resolvedById: req.user.id, resolvedAt: data.status === 'resolved' || data.status === 'false_positive' ? new Date() : null },
    });
    audit(req, 'compliance.violation.resolve', { entityType: 'compliance_violation', entityId: v.id, afterJson: data });
    res.json({ violation: v });
  } catch (e) { next(e); }
});

router.get('/expiries', authenticate, requirePerm('compliance.expiry.read'), async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const cutoff = new Date(Date.now() + parseInt(days, 10) * 24 * 60 * 60 * 1000);
    const expiries = await prisma.documentExpiry.findMany({
      where: { expiryDate: { lte: cutoff } },
      orderBy: { expiryDate: 'asc' },
      take: 200,
    });
    res.json({ expiries });
  } catch (e) { next(e); }
});

const expirySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  documentType: z.string(),
  documentRef: z.string().optional().nullable(),
  expiryDate: z.string(),
});

router.post('/expiries', authenticate, requirePerm('compliance.expiry.read'), async (req, res, next) => {
  try {
    const data = expirySchema.parse(req.body);
    const exp = await prisma.documentExpiry.create({
      data: { ...data, expiryDate: new Date(data.expiryDate) },
    });
    res.status(201).json({ expiry: exp });
  } catch (e) { next(e); }
});

// Compliance dashboard summary
router.get('/summary', authenticate, requirePerm('compliance.rule.read'), async (req, res, next) => {
  try {
    const [openViolations, criticalViolations, expiringSoon, totalRules] = await Promise.all([
      prisma.complianceViolation.count({ where: { status: 'open' } }),
      prisma.complianceViolation.count({ where: { severity: 'critical', status: { not: 'resolved' } } }),
      prisma.documentExpiry.count({ where: { expiryDate: { lte: new Date(Date.now() + 30 * 86400000) } } }),
      prisma.complianceRule.count({ where: { isActive: true } }),
    ]);
    res.json({ openViolations, criticalViolations, expiringSoon, totalRules });
  } catch (e) { next(e); }
});

module.exports = router;