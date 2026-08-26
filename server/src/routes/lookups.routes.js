const express = require('express');
const prisma = require('../prisma');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

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

module.exports = router;