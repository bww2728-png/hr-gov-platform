/**
 * صندوق الاعتمادات — طلبات التغيير المحكومة (قوائم/معادلات/هياكل رواتب).
 */
const express = require('express');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const gov = require('../utils/governance');

const router = express.Router();
router.use(authenticate);

/** GET /api/governance/pending — ما ينتظر اعتمادي أنا تحديداً */
router.get('/pending', reqPerm('governance.read'), async (req, res, next) => {
  try {
    const items = await gov.pendingFor(req.user);
    res.json({ items });
  } catch (e) { next(e); }
});

/** GET /api/governance/all — كل الطلبات (للمراقب/المدير/النظام) */
router.get('/all', reqPerm('governance.read'), async (req, res, next) => {
  try {
    const { status, kind } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (kind) where.kind = String(kind);
    const items = await prisma.changeRequest.findMany({
      where,
      include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ items });
  } catch (e) { next(e); }
});

/** GET /api/governance/:id — تفاصيل طلب */
router.get('/:id', reqPerm('governance.read'), async (req, res, next) => {
  try {
    const item = await prisma.changeRequest.findUnique({
      where: { id: Number(req.params.id) },
      include: { proposer: { select: { id: true, fullNameAr: true, username: true } } },
    });
    if (!item) return res.status(404).json({ error: 'غير موجود' });
    res.json({ item });
  } catch (e) { next(e); }
});

/** POST /api/governance/:id/decision — اعتماد أو رفض { decision: 'approve'|'reject', note } */
router.post('/:id/decision', reqPerm('governance.approve', 'formulas.approve'), async (req, res, next) => {
  try {
    const { decision, note } = req.body || {};
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'القرار يجب أن يكون approve أو reject' });
    }
    const updated = await gov.decide({
      changeRequestId: Number(req.params.id),
      user: req.user,
      decision,
      note,
    });
    res.json({ item: updated });
  } catch (e) { next(e); }
});

module.exports = router;
