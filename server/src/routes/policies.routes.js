/**
 * مركز قواعد وسياسات العمل — قراءة المعايير واقتراح تعديلاتها
 * عبر سلسلة Maker-Checker (governance) مع انعكاس لحظي بدون إعادة نشر.
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const gov = require('../utils/governance');
const policyStore = require('../utils/policyStore');
const { getIO } = require('../socket');

const router = express.Router();
router.use(authenticate);

/** تحميل الكاش عند أول استخدام */
router.use(async (req, res, next) => {
  try { await policyStore.load(); return next(); } catch (e) { return next(e); }
});

/** GET /api/policies — كل المعايير مع القيمة الحية */
router.get('/', reqPerm('policies.read', 'formulas.read'), async (req, res, next) => {
  try {
    const params = await prisma.policyParameter.findMany({ orderBy: [{ category: 'asc' }, { code: 'asc' }] });
    res.json({ params: params.map((p) => ({ ...p, currentValue: policyStore.get(p.code) })) });
  } catch (e) { next(e); }
});

/** GET /api/policies/leave-types — قواعد أنواع الإجازات (سقوف) كما في القاعدة */
router.get('/leave-types', reqPerm('policies.read', 'leaves.read'), async (req, res, next) => {
  try {
    const types = await prisma.leaveType.findMany({
      select: { code: true, nameAr: true, rulesJson: true },
      orderBy: { code: 'asc' },
    });
    res.json({ types });
  } catch (e) { next(e); }
});

/** GET /api/policies/:code/versions — تاريخ نسخ معامل (Append-only) */
router.get('/:code/versions', reqPerm('policies.read', 'governance.read'), async (req, res, next) => {
  try {
    const versions = await prisma.policyParameterVersion.findMany({
      where: { parameterCode: req.params.code },
      orderBy: { version: 'desc' },
      take: 100,
    });
    res.json({ versions });
  } catch (e) { next(e); }
});

/** POST /api/policies/:code/propose — اقتراح تغيير معامل (Maker-Checker) */
const proposeSchema = z.object({
  value: z.number(),
  effectiveFrom: z.string().datetime().optional(),
  reason: z.string().min(3).max(500),
});
router.post('/:code/propose', reqPerm('policies.propose'), async (req, res, next) => {
  try {
    const input = proposeSchema.parse(req.body);
    const result = await gov.proposeParameterChange({
      parameterCode: req.params.code,
      value: input.value,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
      user: req.user,
    });
    res.status(result.applied ? 200 : 201).json(result);
  } catch (e) { next(e); }
});

/** POST /api/policies/leave-types/:code/propose-rules — اقتراح تعديل قواعد نوع إجازة */
router.post('/leave-types/:code/propose-rules', reqPerm('policies.propose'), async (req, res, next) => {
  try {
    const { rules, reason } = z.object({ rules: z.record(z.any()), reason: z.string().min(3).max(500) }).parse(req.body);
    const result = await gov.proposeLeaveTypeRulesChange({
      leaveTypeCode: req.params.code, rules, reason, user: req.user,
    });
    res.status(201).json(result);
  } catch (e) { next(e); }
});

/** POST /api/policies/refresh — إبطال الكاش وإعادة التحميل (sysadmin) + بث لحظي */
router.post('/refresh', async (req, res, next) => {
  try {
    if (req.user.role?.code !== 'sysadmin') {
      return res.status(403).json({ error: 'ممنوع: هذه العملية لنظام فقط' });
    }
    await policyStore.load();
    getIO()?.emit('public:policies.updated', { at: new Date().toISOString() });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
