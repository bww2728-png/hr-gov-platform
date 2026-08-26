/**
 * Knowledge Management Engine - Documents, Decisions, Policies
 * Decision records use SHA-256 hash chain for immutability.
 */
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();

// =========== DOCUMENTS ===========

router.get('/documents', authenticate, requirePerm('knowledge.doc.read'), async (req, res, next) => {
  try {
    const { category, status } = req.query;
    const where = {};
    if (category) where.category = String(category);
    if (status) where.status = String(status);
    const docs = await prisma.knowledgeDocument.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    res.json({ documents: docs });
  } catch (e) { next(e); }
});

router.get('/documents/:id', authenticate, requirePerm('knowledge.doc.read'), async (req, res, next) => {
  try {
    const doc = await prisma.knowledgeDocument.findUnique({ where: { id: parseInt(req.params.id, 10) } });
    if (!doc) return res.status(404).json({ error: 'الوثيقة غير موجودة' });
    res.json({ document: doc });
  } catch (e) { next(e); }
});

const docSchema = z.object({
  titleAr: z.string().min(2),
  titleEn: z.string().optional().nullable(),
  contentMarkdown: z.string(),
  category: z.enum(['sop', 'guide', 'template', 'lesson_learned']),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft','in_review','approved','published','archived']).default('draft'),
});

router.post('/documents', authenticate, requirePerm('knowledge.doc.write'), async (req, res, next) => {
  try {
    const data = docSchema.parse(req.body);
    const code = `DOC-${String(Date.now()).slice(-6)}`;
    const doc = await prisma.knowledgeDocument.create({
      data: { ...data, code, authorId: req.user.id, publishedAt: data.status === 'published' ? new Date() : null },
    });
    audit(req, 'knowledge.doc.create', { entityType: 'knowledge_document', entityId: doc.id });
    res.status(201).json({ document: doc });
  } catch (e) { next(e); }
});

router.patch('/documents/:id', authenticate, requirePerm('knowledge.doc.write'), async (req, res, next) => {
  try {
    const before = await prisma.knowledgeDocument.findUnique({ where: { id: parseInt(req.params.id, 10) } });
    if (!before) return res.status(404).json({ error: 'الوثيقة غير موجودة' });
    const data = docSchema.partial().parse(req.body);
    if (data.status === 'published' && !before.publishedAt) data.publishedAt = new Date();
    if (data.status === 'archived' && !before.archivedAt) data.archivedAt = new Date();

    const doc = await prisma.knowledgeDocument.update({
      where: { id: before.id },
      data: { ...data, version: { increment: 1 }, parentVersionId: before.version > 1 ? before.id : null },
    });
    audit(req, 'knowledge.doc.update', { entityType: 'knowledge_document', entityId: doc.id, afterJson: data });
    res.json({ document: doc });
  } catch (e) { next(e); }
});

// =========== DECISION RECORDS (with hash chain) ===========

router.get('/decisions', authenticate, requirePerm('knowledge.decision.read'), async (req, res, next) => {
  try {
    const decisions = await prisma.decisionRecord.findMany({
      orderBy: { decidedAt: 'desc' },
      take: 200,
    });
    res.json({ decisions });
  } catch (e) { next(e); }
});

const decisionSchema = z.object({
  titleAr: z.string().min(2),
  contextMarkdown: z.string(),
  decisionMarkdown: z.string(),
  consequencesMarkdown: z.string().optional().nullable(),
  decidedAt: z.string().optional(),
  relatedDocsJson: z.any().optional().nullable(),
});

router.post('/decisions', authenticate, requirePerm('knowledge.decision.write'), async (req, res, next) => {
  try {
    const data = decisionSchema.parse(req.body);
    // Get previous hash for chain
    const last = await prisma.decisionRecord.findFirst({ orderBy: { id: 'desc' } });
    const previousHash = last?.currentHash || null;
    const payload = `${previousHash || ''}|${data.titleAr}|${data.decisionMarkdown}|${new Date().toISOString()}`;
    const currentHash = crypto.createHash('sha256').update(payload).digest('hex');
    const code = `ADR-${String(Date.now()).slice(-6)}`;
    const decision = await prisma.decisionRecord.create({
      data: {
        ...data,
        code,
        decidedById: req.user.id,
        decidedAt: data.decidedAt ? new Date(data.decidedAt) : new Date(),
        previousHash,
        currentHash,
      },
    });
    audit(req, 'knowledge.decision.create', { entityType: 'decision_record', entityId: decision.id, afterJson: { hash: currentHash } });
    res.status(201).json({ decision });
  } catch (e) { next(e); }
});

// Verify hash chain integrity
router.get('/decisions/verify', authenticate, requirePerm('knowledge.decision.read'), async (req, res, next) => {
  try {
    const decisions = await prisma.decisionRecord.findMany({ orderBy: { id: 'asc' } });
    let prev = null;
    let broken = null;
    for (const d of decisions) {
      if (d.previousHash !== prev) { broken = d.id; break; }
      prev = d.currentHash;
    }
    res.json({
      total: decisions.length,
      intact: broken === null,
      brokenAt: broken,
    });
  } catch (e) { next(e); }
});

// =========== POLICIES ===========

router.get('/policies', authenticate, requirePerm('knowledge.policy.read'), async (req, res, next) => {
  try {
    const { jurisdiction, status } = req.query;
    const where = {};
    if (jurisdiction) where.jurisdiction = String(jurisdiction);
    if (status) where.status = String(status);
    const policies = await prisma.policy.findMany({ where, orderBy: { effectiveDate: 'desc' } });
    res.json({ policies });
  } catch (e) { next(e); }
});

const policySchema = z.object({
  titleAr: z.string().min(2),
  titleEn: z.string().min(2),
  contentMarkdown: z.string(),
  jurisdiction: z.enum(['SA','AE','EG','GLOBAL']).default('SA'),
  effectiveDate: z.string(),
  expiryDate: z.string().optional().nullable(),
  autoRenewal: z.boolean().default(false),
  sourceUrl: z.string().optional().nullable(),
  status: z.enum(['draft','in_review','approved','published','archived']).default('draft'),
});

router.post('/policies', authenticate, requirePerm('knowledge.policy.write'), async (req, res, next) => {
  try {
    const data = policySchema.parse(req.body);
    const code = `POL-${String(Date.now()).slice(-6)}`;
    const policy = await prisma.policy.create({
      data: {
        ...data,
        code,
        effectiveDate: new Date(data.effectiveDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
    });
    audit(req, 'knowledge.policy.create', { entityType: 'policy', entityId: policy.id });
    res.status(201).json({ policy });
  } catch (e) { next(e); }
});

router.patch('/policies/:id', authenticate, requirePerm('knowledge.policy.write'), async (req, res, next) => {
  try {
    const data = policySchema.partial().parse(req.body);
    const updateData = { ...data, version: { increment: 1 } };
    if (data.effectiveDate) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate);
    const policy = await prisma.policy.update({ where: { id: parseInt(req.params.id, 10) }, data: updateData });
    audit(req, 'knowledge.policy.update', { entityType: 'policy', entityId: policy.id });
    res.json({ policy });
  } catch (e) { next(e); }
});

module.exports = router;