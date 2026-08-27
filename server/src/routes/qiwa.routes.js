/**
 * طلبات منصة قوى (T11) — سجل داخلي بمحاكاة رفع/استعلام (لا تكامل حكومي حقيقي).
 */
const express = require('express');
const prisma = require('../prisma');
const { authenticate, require: reqPerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

/** GET /api/qiwa — سجل الطلبات */
router.get('/', reqPerm('qiwa.read'), async (req, res, next) => {
  try {
    const { status, changeType } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (changeType) where.changeType = String(changeType);
    const requests = await prisma.qiwaRequest.findMany({
      where,
      include: { employee: { select: { fullNameAr: true, employeeNumber: true, nationalId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ requests });
  } catch (e) { next(e); }
});

/** POST /api/qiwa — إنشاء طلب (مسودة) */
router.post('/', reqPerm('qiwa.write'), async (req, res, next) => {
  try {
    const { employeeId, changeType, payload, notes } = req.body || {};
    if (!changeType) return res.status(400).json({ error: 'نوع التغيير إلزامي' });
    const count = await prisma.qiwaRequest.count();
    const request = await prisma.qiwaRequest.create({
      data: {
        requestNo: `QW-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        employeeId: employeeId || null,
        changeType,
        payloadJson: payload || {},
        notes: notes || null,
        raisedBy: req.user.id,
      },
    });
    audit(req, 'qiwa.create', { entityType: 'qiwa_request', entityId: request.requestNo, afterJson: request });
    res.status(201).json({ request });
  } catch (e) { next(e); }
});

/** POST /api/qiwa/:id/raise — رفع الطلب على قوى (محاكاة: draft→raised→in_progress) */
router.post('/:id/raise', reqPerm('qiwa.write'), async (req, res, next) => {
  try {
    const existing = await prisma.qiwaRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (!['draft', 'rejected'].includes(existing.status)) {
      return res.status(409).json({ error: `لا يمكن رفع طلب بحالة ${existing.status}` });
    }
    const request = await prisma.qiwaRequest.update({
      where: { id: existing.id },
      data: {
        status: 'raised',
        raisedAt: new Date(),
        responseJson: { simulated: true, message: 'محاكاة رفع على منصة قوى — لا يوجد تكامل حكومي فعلي في هذه المرحلة' },
      },
    });
    audit(req, 'qiwa.raise', { entityType: 'qiwa_request', entityId: request.requestNo, beforeJson: { status: existing.status }, afterJson: { status: 'raised' } });
    res.json({ request });
  } catch (e) { next(e); }
});

/** POST /api/qiwa/:id/complete — إتمام الطلب */
router.post('/:id/complete', reqPerm('qiwa.write'), async (req, res, next) => {
  try {
    const existing = await prisma.qiwaRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'الطلب غير موجود' });
    const request = await prisma.qiwaRequest.update({
      where: { id: existing.id },
      data: { status: 'completed', completedAt: new Date(), responseJson: req.body?.response || existing.responseJson },
    });
    audit(req, 'qiwa.complete', { entityType: 'qiwa_request', entityId: request.requestNo });
    res.json({ request });
  } catch (e) { next(e); }
});

/** POST /api/qiwa/:id/reject — رفض */
router.post('/:id/reject', reqPerm('qiwa.write'), async (req, res, next) => {
  try {
    const existing = await prisma.qiwaRequest.findUnique({ where: { id: Number(req.params.id) } });
    if (!existing) return res.status(404).json({ error: 'الطلب غير موجود' });
    const request = await prisma.qiwaRequest.update({
      where: { id: existing.id },
      data: { status: 'rejected', notes: req.body?.reason || existing.notes },
    });
    audit(req, 'qiwa.reject', { entityType: 'qiwa_request', entityId: request.requestNo, reason: req.body?.reason });
    res.json({ request });
  } catch (e) { next(e); }
});

module.exports = router;
