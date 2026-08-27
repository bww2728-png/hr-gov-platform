/**
 * مركز المعادلات — شفافية كاملة: قراءة كل المعادلات، محاكاتها، واقتراح تعديلها.
 */
const express = require('express');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const registry = require('../utils/formulas');
const gov = require('../utils/governance');

const router = express.Router();
router.use(authenticate);

/** GET /api/formulas — كل المعادلات (تعريف DB مدمجاً بدوال الحساب) */
router.get('/', reqPerm('formulas.read'), async (req, res, next) => {
  try {
    const defs = await prisma.formulaDefinition.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    // دمج: تعريف DB (الحوكمة/النص) + دالة الحساب من السجل
    const items = defs.map((d) => ({
      ...d,
      hasEngine: Boolean(registry.BY_CODE[d.code]),
    }));
    res.json({ items, total: items.length });
  } catch (e) { next(e); }
});

/** GET /api/formulas/:code — معادلة واحدة */
router.get('/:code', reqPerm('formulas.read'), async (req, res, next) => {
  try {
    const def = await prisma.formulaDefinition.findUnique({ where: { code: req.params.code } });
    if (!def) return res.status(404).json({ error: 'معادلة غير موجودة' });
    res.json({ item: def });
  } catch (e) { next(e); }
});

/** POST /api/formulas/:code/simulate — حاسبة حية بمدخلات المستخدم */
router.post('/:code/simulate', reqPerm('formulas.read'), async (req, res, next) => {
  try {
    const { result, formula } = registry.simulate(req.params.code, req.body || {});
    res.json({ result, formula, inputs: req.body || {} });
  } catch (e) {
    if (/غير معروفة/.test(e.message)) return res.status(404).json({ error: e.message });
    next(e);
  }
});

/** POST /api/formulas/:code/propose — اقتراح تعديل معادلة (يمر بسلسلة الاعتماد) */
router.post('/:code/propose', reqPerm('formulas.propose'), async (req, res, next) => {
  try {
    const { reason, ...payload } = req.body || {};
    const before = await prisma.formulaDefinition.findUnique({ where: { code: req.params.code } });
    if (!before) return res.status(404).json({ error: 'معادلة غير موجودة' });
    const out = await gov.proposeFormulaChange({
      formulaCode: req.params.code,
      payload,
      before,
      reason,
      user: req.user,
    });
    res.status(202).json(out);
  } catch (e) { next(e); }
});

module.exports = router;
