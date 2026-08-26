/**
 * Government Docs + Probation Engine - مستندات الموظف الرسمية (معاملة 25) + فترة التجربة (معاملة 23)
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

// ============ مستندات الموظف ============
router.get('/documents', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('hr.documents.read');
    const where = {};
    if (req.query.employeeId && seeAll) where.employeeId = String(req.query.employeeId);
    else if (!seeAll) where.employeeId = selfId(req);
    if (req.query.docType) where.docType = String(req.query.docType);
    const documents = await prisma.employeeDocument.findMany({ where, orderBy: { expiresAt: 'asc' }, take: 300 });
    res.json({ documents });
  } catch (e) { next(e); }
});

router.post('/documents', requirePerm('hr.documents.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      docType: z.enum(['national_id', 'iqama', 'passport', 'contract', 'degree', 'gosi', 'other']),
      docNumber: z.string().optional(), fileUrl: z.string().optional(),
      issuedAt: z.string().optional(), expiresAt: z.string().optional(),
    }).parse(req.body);
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId: data.employeeId, docType: data.docType,
        docNumber: data.docNumber || null, fileUrl: data.fileUrl || null,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    audit(req, 'employee_document.create', { entityType: 'employee_document', entityId: String(doc.id) });
    res.status(201).json({ document: doc });
  } catch (e) { next(e); }
});

router.post('/documents/:id/verify', requirePerm('hr.documents.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const doc = await prisma.employeeDocument.update({ where: { id }, data: { verified: true } });
    audit(req, 'employee_document.verify', { entityType: 'employee_document', entityId: String(id) });
    res.json({ document: doc });
  } catch (e) { next(e); }
});

// المستندات المنتهية قريباً
router.get('/documents/expiring/soon', requirePerm('hr.documents.read', 'compliance.expiry.read'), async (req, res, next) => {
  try {
    const days = Number(req.query.days) || 90;
    const limit = new Date(); limit.setDate(limit.getDate() + days);
    const documents = await prisma.employeeDocument.findMany({
      where: { expiresAt: { not: null, lte: limit } },
      orderBy: { expiresAt: 'asc' },
      take: 300,
    });
    const empIds = [...new Set(documents.map((d) => d.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ documents: documents.map((d) => ({ ...d, employee: map[d.employeeId] || null })) });
  } catch (e) { next(e); }
});

// ============ فترة التجربة (45/60/90 يوم — معاملة 23) ============
router.get('/probation', requirePerm('probation.read'), async (req, res, next) => {
  try {
    // الموظفون في فترة التجربة (خلال 90 يوم من التعيين)
    const limit = new Date(); limit.setDate(limit.getDate() - saudi.RULES.probation.days);
    const inProbation = await prisma.employee.findMany({
      where: { employmentStatus: 'active', deletedAt: null, hireDate: { gte: limit } },
      select: { id: true, fullNameAr: true, employeeNumber: true, hireDate: true, probationEndDate: true },
      orderBy: { hireDate: 'desc' },
    });
    const reviews = await prisma.probationReview.findMany({
      where: { employeeId: { in: inProbation.map((e) => e.id) } },
      orderBy: { milestone: 'asc' },
    });
    const byEmp = {};
    for (const r of reviews) { (byEmp[r.employeeId] = byEmp[r.employeeId] || []).push(r); }
    res.json({
      employees: inProbation.map((e) => ({
        ...e,
        dayOfService: Math.floor((Date.now() - new Date(e.hireDate).getTime()) / 86400000),
        reviews: byEmp[e.id] || [],
      })),
      milestones: [saudi.RULES.probation.midReviewDay, saudi.RULES.probation.secondReviewDay, saudi.RULES.probation.days],
    });
  } catch (e) { next(e); }
});

router.post('/probation/reviews', requirePerm('probation.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), milestone: z.union([z.literal(45), z.literal(60), z.literal(90)]),
      performance: z.enum(['excellent', 'good', 'weak']),
      notes: z.string().max(1000).optional(),
      decision: z.enum(['continue', 'warning_pip', 'terminate', 'confirm']).optional(),
    }).parse(req.body);
    const review = await prisma.probationReview.create({
      data: {
        employeeId: data.employeeId, milestone: data.milestone, reviewDate: new Date(),
        performance: data.performance, notes: data.notes || null,
        decision: data.decision || null, reviewerId: req.user.id,
      },
    });
    // قرار التثبيت عند اليوم 90
    if (data.milestone === 90 && data.decision === 'confirm') {
      await prisma.employee.update({ where: { id: data.employeeId }, data: { probationEndDate: new Date() } });
    }
    audit(req, 'probation.review', { entityType: 'probation_review', entityId: String(review.id), afterJson: review });
    res.status(201).json({ review });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'يوجد تقييم لهذا الموظف عند هذا اليوم مسبقاً' });
    next(e);
  }
});

module.exports = router;
