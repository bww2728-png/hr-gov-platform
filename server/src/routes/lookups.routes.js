const express = require('express');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const gov = require('../utils/governance');

const router = express.Router();

/**
 * GET /api/lookups?category=country&parent=SA
 * List lookups, optionally filtered by category and parent.
 * No permission required - used by login screen and dropdowns.
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, parent, parentCategory } = req.query;
    const where = { isActive: true };
    if (category) where.category = String(category);
    if (parent) {
      where.parentCategory = String(parentCategory || 'country');
      where.parentCode = String(parent);
    }
    const lookups = await prisma.lookup.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { valueAr: 'asc' }],
    });
    res.json({ lookups });
  } catch (e) { next(e); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const cats = await prisma.lookup.findMany({
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    res.json({ categories: cats.map(c => c.category) });
  } catch (e) { next(e); }
});

// =====================================================================
// الحوكمة — إدارة الجداول الفرعية الـ 21 بمصفوفة المالك/المعتمد
// =====================================================================

/** GET /api/lookups/governance — مصفوفة الحوكمة لكل الفئات */
router.get('/governance', authenticate, reqPerm('governance.read'), async (req, res, next) => {
  try {
    const categories = await prisma.lookupCategory.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });
    const counts = await prisma.lookup.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    const countMap = Object.fromEntries(counts.map((c) => [c.category, c._count._all]));
    res.json({
      categories: categories.map((c) => ({
        ...c,
        valuesCount: c.source === 'lookup' ? (countMap[c.code] || 0) : null,
      })),
    });
  } catch (e) { next(e); }
});

/** GET /api/lookups/governance/:code/values — قيم فئة واحدة (تشمل غير النشطة للإدارة) */
router.get('/governance/:code/values', authenticate, reqPerm('governance.read'), async (req, res, next) => {
  try {
    const cat = await gov.getCategory(req.params.code);
    let values = [];
    if (cat.source === 'lookup') {
      values = await prisma.lookup.findMany({
        where: { category: cat.code },
        orderBy: [{ sortOrder: 'asc' }, { valueAr: 'asc' }],
      });
    }
    res.json({ category: cat, values });
  } catch (e) { next(e); }
});

/** POST /api/lookups/governance/:code — اقتراح إنشاء قيمة (أو تطبيق مباشر إن لم تتطلب موافقة) */
router.post('/governance/:code', authenticate, reqPerm('governance.propose'), async (req, res, next) => {
  try {
    const { valueAr, valueEn, code, sortOrder, reason } = req.body || {};
    if (!code || !valueAr) return res.status(400).json({ error: 'الرمز والقيمة العربية إلزاميان' });
    const out = await gov.proposeLookupChange({
      categoryCode: req.params.code,
      action: 'create',
      payload: { code, valueAr, valueEn, sortOrder },
      reason,
      user: req.user,
    });
    res.status(out.applied ? 201 : 202).json(out);
  } catch (e) { next(e); }
});

/** PUT /api/lookups/governance/:code/:valueCode — اقتراح تعديل قيمة */
router.put('/governance/:code/:valueCode', authenticate, reqPerm('governance.propose'), async (req, res, next) => {
  try {
    const { valueAr, valueEn, sortOrder, isActive, reason } = req.body || {};
    const before = await prisma.lookup.findUnique({
      where: { category_code: { category: req.params.code, code: req.params.valueCode } },
    });
    if (!before) return res.status(404).json({ error: 'القيمة غير موجودة' });
    const out = await gov.proposeLookupChange({
      categoryCode: req.params.code,
      action: 'update',
      payload: { code: req.params.valueCode, valueAr, valueEn, sortOrder, isActive },
      before,
      reason,
      user: req.user,
    });
    res.status(out.applied ? 200 : 202).json(out);
  } catch (e) { next(e); }
});

/** DELETE /api/lookups/governance/:code/:valueCode — اقتراح تعطيل قيمة */
router.delete('/governance/:code/:valueCode', authenticate, reqPerm('governance.propose'), async (req, res, next) => {
  try {
    const before = await prisma.lookup.findUnique({
      where: { category_code: { category: req.params.code, code: req.params.valueCode } },
    });
    if (!before) return res.status(404).json({ error: 'القيمة غير موجودة' });
    const out = await gov.proposeLookupChange({
      categoryCode: req.params.code,
      action: 'deactivate',
      payload: { code: req.params.valueCode },
      before,
      reason: req.body?.reason || req.query.reason,
      user: req.user,
    });
    res.status(out.applied ? 200 : 202).json(out);
  } catch (e) { next(e); }
});

module.exports = router;
