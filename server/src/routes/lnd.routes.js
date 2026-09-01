/**
 * L&D Engine - دورات، جلسات، تسجيل، شهادات، IDP، إرشاد (معاملات 42-46)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;

// ============ الكتالوج ============
router.get('/courses', async (req, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      include: { _count: { select: { sessions: true } } },
      orderBy: { titleAr: 'asc' },
    });
    res.json({ courses });
  } catch (e) { next(e); }
});

router.post('/courses', requirePerm('lnd.catalog.write'), async (req, res, next) => {
  try {
    const data = z.object({
      code: z.string().min(2), titleAr: z.string().min(2), titleEn: z.string().min(2),
      category: z.enum(['technical', 'soft_skills', 'compliance', 'leadership']),
      provider: z.string().optional(), durationHrs: z.number().min(0).optional(),
    }).parse(req.body);
    const course = await prisma.course.create({ data });
    audit(req, 'lnd.course.create', { entityType: 'course', entityId: String(course.id) });
    res.status(201).json({ course });
  } catch (e) { next(e); }
});

// ============ الجلسات ============
router.get('/sessions', async (req, res, next) => {
  try {
    const where = {};
    if (req.query.courseId) where.courseId = Number(req.query.courseId);
    const sessions = await prisma.courseSession.findMany({
      where,
      include: { course: true, _count: { select: { enrollments: true } } },
      orderBy: { startDate: 'desc' },
      take: 100,
    });
    res.json({ sessions });
  } catch (e) { next(e); }
});

router.post('/sessions', requirePerm('lnd.sessions.write'), async (req, res, next) => {
  try {
    const data = z.object({
      courseId: z.number().int(), startDate: z.string(), endDate: z.string(),
      location: z.string().optional(), trainerName: z.string().optional(),
      capacity: z.number().int().min(1).optional(),
    }).parse(req.body);
    const session = await prisma.courseSession.create({
      data: {
        courseId: data.courseId, startDate: new Date(data.startDate), endDate: new Date(data.endDate),
        location: data.location || null, trainerName: data.trainerName || null, capacity: data.capacity || 20,
      },
    });
    audit(req, 'lnd.session.create', { entityType: 'course_session', entityId: String(session.id) });
    res.status(201).json({ session });
  } catch (e) { next(e); }
});

// ============ التسجيل ============
router.post('/sessions/:id/enroll', async (req, res, next) => {
  try {
    const sessionId = Number(req.params.id);
    const session = await prisma.courseSession.findUnique({ where: { id: sessionId }, include: { _count: { select: { enrollments: true } } } });
    if (!session) return res.status(404).json({ error: 'الجلسة غير موجودة' });
    if (session._count.enrollments >= session.capacity) return res.status(400).json({ error: 'الجلسة مكتملة العدد' });

    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const canEnrollOthers = perms.includes('*') || perms.includes('lnd.enroll.write');
    const employeeId = (canEnrollOthers && req.body?.employeeId) ? String(req.body.employeeId) : selfId(req);
    if (!employeeId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });

    const enrollment = await prisma.enrollment.create({ data: { sessionId, employeeId } });
    audit(req, 'lnd.enroll', { entityType: 'enrollment', entityId: String(enrollment.id) });
    res.status(201).json({ enrollment });
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'الموظف مسجل مسبقاً في هذه الجلسة' });
    next(e);
  }
});

router.get('/enrollments/me', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.json({ enrollments: [] });
    const enrollments = await prisma.enrollment.findMany({
      where: { employeeId: empId },
      include: { session: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ enrollments });
  } catch (e) { next(e); }
});

router.patch('/enrollments/:id', requirePerm('lnd.enroll.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      status: z.enum(['enrolled', 'attended', 'completed', 'no_show', 'cancelled']).optional(),
      attendedHrs: z.number().min(0).optional(), testScore: z.number().min(0).max(100).optional(),
      evalJson: z.record(z.any()).optional(), // كيركباتريك: reaction, learning, behavior, results
    }).parse(req.body);
    const enrollment = await prisma.enrollment.update({ where: { id }, data });
    audit(req, 'lnd.enrollment.update', { entityType: 'enrollment', entityId: String(id), afterJson: data });
    res.json({ enrollment });
  } catch (e) { next(e); }
});

// ============ الشهادات ============
router.get('/certificates', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('lnd.certificates.read');
    const where = seeAll && req.query.employeeId ? { employeeId: String(req.query.employeeId) } : (seeAll ? {} : { employeeId: selfId(req) });
    const certificates = await prisma.certificate.findMany({ where, orderBy: { issuedAt: 'desc' }, take: 200 });
    res.json({ certificates });
  } catch (e) { next(e); }
});

router.post('/certificates', requirePerm('lnd.certificates.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), title: z.string().min(2),
      issuer: z.string().optional(), issuedAt: z.string().optional(), expiresAt: z.string().optional(),
      fileUrl: z.string().optional(),
    }).parse(req.body);
    const certificate = await prisma.certificate.create({
      data: {
        employeeId: data.employeeId, title: data.title, issuer: data.issuer || null,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        fileUrl: data.fileUrl || null,
      },
    });
    audit(req, 'lnd.certificate.create', { entityType: 'certificate', entityId: String(certificate.id) });
    res.status(201).json({ certificate });
  } catch (e) { next(e); }
});

// ============ خطط التطوير الفردية IDP ============
router.get('/idps', requirePerm('idp.read'), async (req, res, next) => {
  try {
    const where = req.query.employeeId ? { employeeId: String(req.query.employeeId) } : {};
    const idps = await prisma.idp.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 });
    res.json({ idps });
  } catch (e) { next(e); }
});

router.get('/idps/me', async (req, res, next) => {
  try {
    const idps = await prisma.idp.findMany({ where: { employeeId: selfId(req) }, orderBy: { updatedAt: 'desc' } });
    res.json({ idps });
  } catch (e) { next(e); }
});

router.post('/idps', requirePerm('idp.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(), goalsJson: z.record(z.any()), reviewDate: z.string().optional(),
    }).parse(req.body);
    const idp = await prisma.idp.create({
      data: {
        employeeId: data.employeeId, managerId: selfId(req) || req.user.id,
        goalsJson: data.goalsJson, reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
      },
    });
    audit(req, 'idp.create', { entityType: 'idp', entityId: String(idp.id) });
    res.status(201).json({ idp });
  } catch (e) { next(e); }
});

router.patch('/idps/:id', requirePerm('idp.write'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      goalsJson: z.record(z.any()).optional(), progress: z.number().int().min(0).max(100).optional(),
      status: z.enum(['active', 'completed', 'cancelled']).optional(),
    }).parse(req.body);
    const idp = await prisma.idp.update({ where: { id }, data });
    audit(req, 'idp.update', { entityType: 'idp', entityId: String(id), afterJson: data });
    res.json({ idp });
  } catch (e) { next(e); }
});

// ============ الإرشاد ============
router.get('/mentoring', requirePerm('lnd.mentoring.read'), async (req, res, next) => {
  try {
    const pairs = await prisma.mentoringPair.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    const empIds = [...new Set(pairs.flatMap((p) => [p.mentorId, p.menteeId]))];
    const emps = await prisma.employee.findMany({ where: { id: { in: empIds } }, select: { id: true, fullNameAr: true } });
    const map = Object.fromEntries(emps.map((e) => [e.id, e]));
    res.json({ pairs: pairs.map((p) => ({ ...p, mentor: map[p.mentorId] || null, mentee: map[p.menteeId] || null })) });
  } catch (e) { next(e); }
});

router.post('/mentoring', requirePerm('lnd.mentoring.write'), async (req, res, next) => {
  try {
    const data = z.object({
      mentorId: z.string().uuid(), menteeId: z.string().uuid(),
      startDate: z.string(), focusArea: z.string().optional(),
    }).parse(req.body);
    if (data.mentorId === data.menteeId) return res.status(400).json({ error: 'المرشد والمتدرب لا يمكن أن يكونا نفس الشخص' });
    const pair = await prisma.mentoringPair.create({
      data: { ...data, startDate: new Date(data.startDate), focusArea: data.focusArea || null },
    });
    audit(req, 'mentoring.create', { entityType: 'mentoring_pair', entityId: String(pair.id) });
    res.status(201).json({ pair });
  } catch (e) { next(e); }
});

module.exports = router;
