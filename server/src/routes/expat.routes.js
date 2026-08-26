/**
 * Expat / Government Services Engine - تأشيرات، إقامة، GOSI، GAMCA، توثيق، كفالة، هروب
 * (معاملات 12-19, 79-86)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const saudi = require('../utils/saudiRules');

const router = express.Router();
router.use(authenticate);

// ============ التأشيرات ============
router.get('/visas', requirePerm('expat.visa.read'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.status) where.status = String(req.query.status);
    const visas = await prisma.visa.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = visas.filter((v) => v.employeeId).map((v) => v.employeeId);
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ visas: visas.map((v) => ({ ...v, employee: v.employeeId ? (map[v.employeeId] || null) : null })) });
  } catch (e) { next(e); }
});

router.post('/visas', requirePerm('expat.visa.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid().optional(), candidateName: z.string().optional(),
      type: z.enum(['work', 'exit_reentry_single', 'exit_reentry_multi', 'final_exit', 'family_visit']),
      feesPaid: z.number().optional(), notes: z.string().max(500).optional(),
    }).parse(req.body);

    // تأشيرة عائلية: شروط الراتب ومدة الخدمة (معاملة 18)
    if (data.type === 'family_visit') {
      if (!data.employeeId) return res.status(400).json({ error: 'التأشيرة العائلية تتطلب موظفاً' });
      const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
      const check = saudi.familyVisaEligible({ salary: Number(emp.salary), hireDate: emp.hireDate });
      if (!check.eligible) {
        return res.status(400).json({
          error: 'غير مستوفي شروط التأشيرة العائلية',
          details: { salaryOk: check.salaryOk, tenureOk: check.tenureOk, monthsServed: check.monthsServed, minSalary: saudi.RULES.familyVisa.minSalary },
        });
      }
    }
    // الخروج النهائي: صلاحية 60 يوماً
    let expiresAt = null;
    if (data.type === 'final_exit') {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + saudi.RULES.finalExit.validityDays);
    }
    const visa = await prisma.visa.create({
      data: {
        employeeId: data.employeeId || null, candidateName: data.candidateName || null,
        type: data.type, feesPaid: data.feesPaid || null, notes: data.notes || null,
        expiresAt, status: 'requested',
      },
    });
    audit(req, 'visa.create', { entityType: 'visa', entityId: String(visa.id), afterJson: visa });
    res.status(201).json({ visa });
  } catch (e) { next(e); }
});

router.post('/visas/:id/status', requirePerm('expat.visa.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status, refNumber, issuedAt } = z.object({
      status: z.enum(['issued', 'used', 'expired', 'cancelled']),
      refNumber: z.string().optional(), issuedAt: z.string().optional(),
    }).parse(req.body);
    const visa = await prisma.visa.update({
      where: { id },
      data: { status, refNumber: refNumber || undefined, issuedAt: issuedAt ? new Date(issuedAt) : (status === 'issued' ? new Date() : undefined) },
    });
    audit(req, 'visa.status', { entityType: 'visa', entityId: String(id), afterJson: { status } });
    res.json({ visa });
  } catch (e) { next(e); }
});

// ============ الإقامات ============
router.get('/iqamas', requirePerm('expat.iqama.read'), async (req, res, next) => {
  try {
    const iqamas = await prisma.iqamaRecord.findMany({ orderBy: { expiresAt: 'asc' }, take: 300 });
    const empIds = [...new Set(iqamas.map((i) => i.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ iqamas: iqamas.map((i) => ({ ...i, employee: map[i.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/iqamas', requirePerm('expat.iqama.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), iqamaNumber: z.string().optional(),
      profession: z.string().optional(), issuedAt: z.string().optional(), expiresAt: z.string().optional(),
    }).parse(req.body);
    const iqama = await prisma.iqamaRecord.create({
      data: {
        employeeId: data.employeeId, iqamaNumber: data.iqamaNumber || null,
        profession: data.profession || null,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    audit(req, 'iqama.create', { entityType: 'iqama_record', entityId: String(iqama.id) });
    res.status(201).json({ iqama });
  } catch (e) { next(e); }
});

// الإقامات المنتهية قريباً (خلال 3 أشهر — قاعدة التجديد)
router.get('/iqamas/expiring/soon', requirePerm('expat.iqama.read', 'compliance.expiry.read'), async (req, res, next) => {
  try {
    const months = Number(req.query.months) || saudi.RULES.iqama.renewalNoticeMonths;
    const limit = new Date(); limit.setMonth(limit.getMonth() + months);
    const iqamas = await prisma.iqamaRecord.findMany({
      where: { status: 'active', expiresAt: { lte: limit } },
      orderBy: { expiresAt: 'asc' },
    });
    const empIds = [...new Set(iqamas.map((i) => i.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ iqamas: iqamas.map((i) => ({ ...i, employee: map[i.employeeId] || null })) });
  } catch (e) { next(e); }
});

// ============ GOSI ============
router.get('/gosi', requirePerm('gosi.read'), async (req, res, next) => {
  try {
    const records = await prisma.gosiRecord.findMany({ orderBy: { registeredAt: 'desc' }, take: 300 });
    const empIds = [...new Set(records.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ records: records.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/gosi', requirePerm('gosi.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), gosiNumber: z.string().optional(), salaryBase: z.number().positive().optional(),
    }).parse(req.body);
    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
    const salaryBase = data.salaryBase || Number(emp.salary);
    const shares = saudi.gosiShares(salaryBase);
    const record = await prisma.gosiRecord.create({
      data: {
        employeeId: data.employeeId, gosiNumber: data.gosiNumber || null,
        registeredAt: new Date(), salaryBase,
        employeeShare: shares.employee, employerShare: shares.employer,
      },
    });
    audit(req, 'gosi.register', { entityType: 'gosi_record', entityId: String(record.id), afterJson: record });
    res.status(201).json({ record, shares });
  } catch (e) { next(e); }
});

// ============ GAMCA (فحص طبي للوافدين) ============
router.get('/gamca', requirePerm('expat.visa.read', 'expat.iqama.read'), async (req, res, next) => {
  try {
    const records = await prisma.gamcaRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ records });
  } catch (e) { next(e); }
});

router.post('/gamca', requirePerm('expat.gamca.write'), async (req, res, next) => {
  try {
    const data = z.object({
      candidateName: z.string().min(2), passportNo: z.string().optional(),
      examDate: z.string().optional(), result: z.enum(['fit', 'unfit']).optional(),
    }).parse(req.body);
    let validUntil = null;
    if (data.result === 'fit') {
      validUntil = new Date(data.examDate || Date.now());
      validUntil.setMonth(validUntil.getMonth() + saudi.RULES.gamca.validityMonths);
    }
    const record = await prisma.gamcaRecord.create({
      data: {
        candidateName: data.candidateName, passportNo: data.passportNo || null,
        examDate: data.examDate ? new Date(data.examDate) : null,
        result: data.result || null, validUntil,
      },
    });
    audit(req, 'gamca.create', { entityType: 'gamca_record', entityId: String(record.id) });
    res.status(201).json({ record });
  } catch (e) { next(e); }
});

// ============ توثيق الشهادات (سلسلة: جامعة → خارجية → سفارة → خارجية السعودية → معادلة) ============
router.get('/attestations', requirePerm('expat.visa.read', 'expat.iqama.read'), async (req, res, next) => {
  try {
    const records = await prisma.attestation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ records });
  } catch (e) { next(e); }
});

router.post('/attestations', requirePerm('expat.attestation.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid().optional(), candidateName: z.string().optional(),
      documentType: z.string().min(2),
    }).parse(req.body);
    const record = await prisma.attestation.create({ data });
    audit(req, 'attestation.create', { entityType: 'attestation', entityId: String(record.id) });
    res.status(201).json({ record });
  } catch (e) { next(e); }
});

router.post('/attestations/:id/advance', requirePerm('expat.attestation.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const stages = ['university', 'foreign_ministry', 'saudi_embassy', 'mofa_sa', 'moet_equation', 'done'];
    const record = await prisma.attestation.findUnique({ where: { id } });
    if (!record) return res.status(404).json({ error: 'السجل غير موجود' });
    const idx = stages.indexOf(record.stage);
    const nextStage = stages[Math.min(idx + 1, stages.length - 1)];
    const updated = await prisma.attestation.update({
      where: { id },
      data: { stage: nextStage, status: nextStage === 'done' ? 'done' : 'in_progress' },
    });
    audit(req, 'attestation.advance', { entityType: 'attestation', entityId: String(id), afterJson: { stage: nextStage } });
    res.json({ record: updated });
  } catch (e) { next(e); }
});

// ============ نقل الكفالة ============
router.get('/kafala', requirePerm('expat.kafala.read'), async (req, res, next) => {
  try {
    const records = await prisma.kafalaTransfer.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(records.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ records: records.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/kafala', requirePerm('expat.kafala.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), fromEmployer: z.string().optional(), toEmployer: z.string().optional(),
      reason: z.enum(['normal', 'salary_delay_3m', 'abuse_court']).optional(),
      feesPaid: z.number().optional(),
    }).parse(req.body);
    const emp = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    const months = saudi.serviceYears(emp.hireDate) * 12;
    const exempt = data.reason && saudi.RULES.kafala.exemptionReasons.includes(data.reason);
    if (!exempt && months < saudi.RULES.kafala.minServiceMonths) {
      return res.status(400).json({ error: `نقل الكفالة يتطلب ${saudi.RULES.kafala.minServiceMonths} شهر خدمة أو سبب إعفاء`, monthsServed: Math.floor(months) });
    }
    const record = await prisma.kafalaTransfer.create({ data: { ...data, feesPaid: data.feesPaid || null, reason: data.reason || 'normal' } });
    audit(req, 'kafala.create', { entityType: 'kafala_transfer', entityId: String(record.id) });
    res.status(201).json({ record, exempt });
  } catch (e) { next(e); }
});

router.post('/kafala/:id/status', requirePerm('expat.kafala.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.enum(['sponsor_ok', 'gov_ok', 'done', 'rejected']) }).parse(req.body);
    const record = await prisma.kafalaTransfer.update({
      where: { id },
      data: { status, currentSponsorOk: ['sponsor_ok', 'gov_ok', 'done'].includes(status) },
    });
    audit(req, 'kafala.status', { entityType: 'kafala_transfer', entityId: String(id), afterJson: { status } });
    res.json({ record });
  } catch (e) { next(e); }
});

// ============ بلاغات الهروب ============
router.get('/huroob', requirePerm('expat.iqama.read', 'expat.kafala.read'), async (req, res, next) => {
  try {
    const records = await prisma.huroobReport.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const empIds = [...new Set(records.map((r) => r.employeeId))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ records: records.map((r) => ({ ...r, employee: map[r.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/huroob', requirePerm('expat.huroob.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), absenceSince: z.string(),
    }).parse(req.body);
    const record = await prisma.huroobReport.create({
      data: { employeeId: data.employeeId, absenceSince: new Date(data.absenceSince) },
    });
    audit(req, 'huroob.create', { entityType: 'huroob_report', entityId: String(record.id) });
    res.status(201).json({ record });
  } catch (e) { next(e); }
});

router.post('/huroob/:id/status', requirePerm('expat.huroob.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { status } = z.object({ status: z.enum(['reported', 'cancelled', 'deported']) }).parse(req.body);
    const record = await prisma.huroobReport.update({
      where: { id },
      data: {
        status,
        reportedAt: status === 'reported' ? new Date() : undefined,
        resolvedAt: ['cancelled', 'deported'].includes(status) ? new Date() : undefined,
      },
    });
    audit(req, 'huroob.status', { entityType: 'huroob_report', entityId: String(id), afterJson: { status } });
    res.json({ record });
  } catch (e) { next(e); }
});

// ============ لوحة شؤون المقيمين ============
router.get('/dashboard', requirePerm('expat.visa.read', 'expat.iqama.read', 'gosi.read'), async (req, res, next) => {
  try {
    const expatCount = await prisma.employee.count({ where: { residentType: 'expat', employmentStatus: 'active', deletedAt: null } });
    const limit = new Date(); limit.setMonth(limit.getMonth() + 3);
    const expiringIqamas = await prisma.iqamaRecord.count({ where: { status: 'active', expiresAt: { lte: limit } } });
    const pendingVisas = await prisma.visa.count({ where: { status: 'requested' } });
    const activeHuroob = await prisma.huroobReport.count({ where: { status: { in: ['monitoring', 'reported'] } } });
    const gosiRegistered = await prisma.gosiRecord.count({ where: { status: 'active' } });
    res.json({ expatCount, expiringIqamas, pendingVisas, activeHuroob, gosiRegistered });
  } catch (e) { next(e); }
});

module.exports = router;
