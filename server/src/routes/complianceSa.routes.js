/**
 * Saudi Compliance Engine - نطاقات، PDPL، تقارير تنظيمية، قواعد نظام العمل (معاملات 69-74)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const saudi = require('../utils/saudiRules');

const router = express.Router();
router.use(authenticate);

// ============ قواعد نظام العمل (قراءة — للعرض والمراجعة) ============
router.get('/rules', async (req, res, next) => {
  try {
    res.json({ rules: saudi.RULES });
  } catch (e) { next(e); }
});

// ============ نطاقات (لقطات التوطين — معاملة 69) ============
router.get('/nitaqat', requirePerm('nitaqat.read'), async (req, res, next) => {
  try {
    const snapshots = await prisma.nitaqatSnapshot.findMany({ orderBy: { snapshotDate: 'desc' }, take: 36 });
    res.json({ snapshots });
  } catch (e) { next(e); }
});

router.post('/nitaqat/snapshot', requirePerm('nitaqat.write'), async (req, res, next) => {
  try {
    const { notes } = z.object({ notes: z.string().max(500).optional() }).parse(req.body || {});
    const total = await prisma.employee.count({ where: { employmentStatus: 'active', deletedAt: null } });
    const saudiCount = await prisma.employee.count({ where: { employmentStatus: 'active', deletedAt: null, residentType: 'saudi' } });
    const expatCount = total - saudiCount;
    const pct = total > 0 ? Math.round((saudiCount / total) * 1000) / 10 : 0;
    const snapshot = await prisma.nitaqatSnapshot.create({
      data: {
        snapshotDate: new Date(), totalEmployees: total, saudiCount, expatCount,
        saudizationPct: pct, band: saudi.nitaqatBand(pct), notes: notes || null,
      },
    });
    audit(req, 'nitaqat.snapshot', { entityType: 'nitaqat_snapshot', entityId: String(snapshot.id), afterJson: snapshot });
    res.status(201).json({ snapshot });
  } catch (e) { next(e); }
});

// ============ PDPL (حالة الامتثال — معاملة 73) ============
router.get('/pdpl', requirePerm('pdpl.read'), async (req, res, next) => {
  try {
    const employees = await prisma.employee.count({ where: { deletedAt: null } });
    const users = await prisma.user.count();
    const auditLogs = await prisma.auditLog.count();
    const docsWithExpiry = await prisma.employeeDocument.count({ where: { expiresAt: { not: null } } });
    res.json({
      status: {
        dataSubjects: employees, systemUsers: users, auditTrailEntries: auditLogs,
        documentsTracked: docsWithExpiry,
        principles: [
          { code: 'consent', nameAr: 'الموافقة والغرض', applied: true },
          { code: 'minimization', nameAr: 'تقليل البيانات', applied: true },
          { code: 'retention', nameAr: 'سياسة الاحتفاظ', applied: true },
          { code: 'access_rights', nameAr: 'حقوق الوصول والتصحيح', applied: true },
          { code: 'breach_notify', nameAr: 'الإبلاغ عن الاختراق', applied: true },
        ],
      },
    });
  } catch (e) { next(e); }
});

// ============ التقارير التنظيمية (معاملة 74) ============
router.get('/regulatory', requirePerm('regulatory.read'), async (req, res, next) => {
  try {
    const reports = await prisma.regulatoryReport.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ reports });
  } catch (e) { next(e); }
});

router.post('/regulatory', requirePerm('regulatory.write'), async (req, res, next) => {
  try {
    const data = z.object({
      type: z.enum(['gosi', 'zatca', 'labor_office', 'stats']),
      period: z.string().min(4),
      payloadJson: z.record(z.any()).optional(),
    }).parse(req.body);
    const report = await prisma.regulatoryReport.create({
      data: { ...data, payloadJson: data.payloadJson || null, createdById: req.user.id },
    });
    audit(req, 'regulatory.create', { entityType: 'regulatory_report', entityId: String(report.id) });
    res.status(201).json({ report });
  } catch (e) { next(e); }
});

router.post('/regulatory/:id/submit', requirePerm('regulatory.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const report = await prisma.regulatoryReport.update({
      where: { id }, data: { status: 'submitted', submittedAt: new Date() },
    });
    audit(req, 'regulatory.submit', { entityType: 'regulatory_report', entityId: String(id) });
    res.json({ report });
  } catch (e) { next(e); }
});

// ============ لوحة الامتثال السعودي ============
router.get('/dashboard', requirePerm('nitaqat.read', 'compliance.rule.read'), async (req, res, next) => {
  try {
    const latest = await prisma.nitaqatSnapshot.findFirst({ orderBy: { snapshotDate: 'desc' } });
    const total = await prisma.employee.count({ where: { employmentStatus: 'active', deletedAt: null } });
    const saudiCount = await prisma.employee.count({ where: { employmentStatus: 'active', deletedAt: null, residentType: 'saudi' } });
    const currentPct = total > 0 ? Math.round((saudiCount / total) * 1000) / 10 : 0;
    const pendingReports = await prisma.regulatoryReport.count({ where: { status: 'draft' } });
    const wpsPending = await prisma.wpsFile.count({ where: { status: 'generated' } });
    res.json({
      latestSnapshot: latest,
      current: { total, saudiCount, expatCount: total - saudiCount, pct: currentPct, band: saudi.nitaqatBand(currentPct) },
      pendingReports, wpsPending,
    });
  } catch (e) { next(e); }
});

module.exports = router;
