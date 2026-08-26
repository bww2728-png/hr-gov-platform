/**
 * Health Insurance Engine - وثائق التأمين + الأعضاء (معاملة 58)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ الوثائق ============
router.get('/policies', requirePerm('insurance.read'), async (req, res, next) => {
  try {
    const policies = await prisma.insurancePolicy.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { endDate: 'desc' },
    });
    res.json({ policies });
  } catch (e) { next(e); }
});

router.post('/policies', requirePerm('insurance.write'), async (req, res, next) => {
  try {
    const data = z.object({
      provider: z.string().min(2), policyNumber: z.string().min(2),
      planName: z.string().min(2), startDate: z.string(), endDate: z.string(),
      premium: z.number().positive(),
    }).parse(req.body);
    const policy = await prisma.insurancePolicy.create({
      data: { ...data, startDate: new Date(data.startDate), endDate: new Date(data.endDate) },
    });
    audit(req, 'insurance.policy.create', { entityType: 'insurance_policy', entityId: String(policy.id) });
    res.status(201).json({ policy });
  } catch (e) { next(e); }
});

// ============ الأعضاء ============
router.get('/policies/:id/members', requirePerm('insurance.read'), async (req, res, next) => {
  try {
    const policyId = Number(req.params.id);
    const members = await prisma.insuranceMember.findMany({ where: { policyId } });
    const empIds = members.map((m) => m.employeeId);
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true, employeeNumber: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ members: members.map((m) => ({ ...m, employee: map[m.employeeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/policies/:id/members', requirePerm('insurance.write'), async (req, res, next) => {
  try {
    const policyId = Number(req.params.id);
    const data = z.object({
      employeeId: z.string().uuid(),
      relation: z.enum(['self', 'spouse', 'child']).default('self'),
      cardNumber: z.string().optional(),
    }).parse(req.body);
    const member = await prisma.insuranceMember.create({
      data: { policyId, ...data, cardNumber: data.cardNumber || null },
    });
    audit(req, 'insurance.member.add', { entityType: 'insurance_member', entityId: String(member.id) });
    res.status(201).json({ member });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'العضو مسجل مسبقاً بهذه الصلة' });
    next(e);
  }
});

router.delete('/members/:id', requirePerm('insurance.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.insuranceMember.delete({ where: { id } });
    audit(req, 'insurance.member.remove', { entityType: 'insurance_member', entityId: String(id) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// تأميني (خدمة ذاتية)
router.get('/me', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const members = await prisma.insuranceMember.findMany({
      where: { employeeId: empId },
      include: { policy: true },
    });
    res.json({ memberships: members });
  } catch (e) { next(e); }
});

module.exports = router;
