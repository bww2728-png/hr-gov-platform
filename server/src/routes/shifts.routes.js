/**
 * shifts.routes — إدارة الورديات والتعيينات (P0-01/07).
 * الصلاحيات: shifts.read / shifts.write.
 * يعمل seed تلقائي لوردية MORNING من مركز المعايير عند أول قراءة (idempotent).
 */
const { Router } = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const policyStore = require('../utils/policyStore');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const shiftResolver = require('../utils/shiftResolver');
const { audit } = require('../middleware/audit');

const router = Router();
router.use(authenticate);

const SHIFT_SCHEMA = z.object({
  code: z.string().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/, 'رمز لاتيني فقط'),
  nameAr: z.string().min(2).max(80),
  nameEn: z.string().max(80).optional().nullable(),
  startMin: z.number().int().min(0).max(1439),
  endMin: z.number().int().min(0).max(1440),
  graceInMins: z.number().int().min(0).max(180).default(15),
  earlyLeaveThresholdMins: z.number().int().min(0).max(180).default(15),
  checkInWindowBeforeMins: z.number().int().min(0).max(240).default(60),
  checkInWindowAfterMins: z.number().int().min(0).max(240).default(120),
  workDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  allowHolidayCheckIn: z.boolean().default(false),
  lateDeductionMultiplier: z.number().min(0).max(5).default(1.5),
  weeklyHourCap: z.number().min(0).max(60).default(45),
  isRamadan: z.boolean().default(false),
  active: z.boolean().default(true),
});

const ASSIGN_SCHEMA = z.object({
  scope: z.enum(['employee', 'department', 'branch']),
  refId: z.string().min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
});

/** وردية الصباح الافتراضية من مركز المعايير — تُنشأ مرة واحدة عند أول قراءة */
async function ensureMorningShift() {
  const existing = await prisma.workShift.findUnique({ where: { code: 'MORNING' } });
  if (existing) return existing;
  const startHour = Number(policyStore.get('workHours.startHour')) || policyStore.SEED_DEFAULTS['workHours.startHour'];
  const endHour = Number(policyStore.get('workHours.endHour')) || policyStore.SEED_DEFAULTS['workHours.endHour'];
  const grace = Number(policyStore.get('workHours.lateGraceMins')) || policyStore.SEED_DEFAULTS['workHours.lateGraceMins'];
  try {
    return await prisma.workShift.create({
      data: {
        code: 'MORNING', nameAr: 'وردية الصباح', nameEn: 'Morning',
        startMin: Math.trunc(startHour * 60), endMin: Math.trunc(endHour * 60),
        graceInMins: Math.trunc(grace), workDays: [0, 1, 2, 3, 4],
      },
    });
  } catch { // سباق إنشاء متزامن — أعد القراءة
    return prisma.workShift.findUnique({ where: { code: 'MORNING' } });
  }
}

router.get('/', requirePerm('shifts.read'), async (req, res, next) => {
  try {
    await ensureMorningShift();
    const shifts = await prisma.workShift.findMany({ orderBy: [{ active: 'desc' }, { id: 'asc' }] });
    res.json({ shifts });
  } catch (e) { next(e); }
});

router.post('/', requirePerm('shifts.write'), async (req, res, next) => {
  try {
    const data = SHIFT_SCHEMA.parse(req.body);
    const dup = await prisma.workShift.findUnique({ where: { code: data.code } });
    if (dup) return res.status(409).json({ error: 'رمز الوردية مستخدم' });
    const shift = await prisma.workShift.create({ data });
    audit(req, 'shifts.create', { entityType: 'work_shift', entityId: String(shift.id), afterJson: shift });
    res.status(201).json({ shift });
  } catch (e) { next(e); }
});

router.patch('/:id', requirePerm('shifts.write'), async (req, res, next) => {
  try {
    const id = z.number().int().positive().parse(Number(req.params.id));
    const data = SHIFT_SCHEMA.partial().parse(req.body);
    const before = await prisma.workShift.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'الوردية غير موجودة' });
    if (data.code && data.code !== before.code) {
      const dup = await prisma.workShift.findUnique({ where: { code: data.code } });
      if (dup) return res.status(409).json({ error: 'رمز الوردية مستخدم' });
    }
    const shift = await prisma.workShift.update({ where: { id }, data });
    audit(req, 'shifts.update', { entityType: 'work_shift', entityId: String(id), beforeJson: before, afterJson: shift });
    res.json({ shift });
  } catch (e) { next(e); }
});

/** تعيين وردية لنطاق — استبدال منطقي: إغلاق التعيين الساري لنفس النطاق بتحديد endDate */
router.post('/:id/assign', requirePerm('shifts.write'), async (req, res, next) => {
  try {
    const shiftId = z.number().int().positive().parse(Number(req.params.id));
    const data = ASSIGN_SCHEMA.parse(req.body);
    const shift = await prisma.workShift.findUnique({ where: { id: shiftId } });
    if (!shift || !shift.active) return res.status(404).json({ error: 'الوردية غير موجودة أو معطلة' });
    if (data.endDate && data.endDate < data.startDate) return res.status(400).json({ error: 'نهاية السريان قبل بدايته' });

    const openSame = await prisma.shiftAssignment.findMany({
      where: { scope: data.scope, refId: data.refId, shiftId: { not: shiftId }, endDate: null },
    });
    const day = new Date(Date.UTC(data.startDate.getUTCFullYear(), data.startDate.getUTCMonth(), data.startDate.getUTCDate()));
    const closed = [];
    for (const o of openSame) {
      const c = await prisma.shiftAssignment.update({ where: { id: o.id }, data: { endDate: day } });
      closed.push(c.id);
    }
    const dup = await prisma.shiftAssignment.findFirst({
      where: { scope: data.scope, refId: data.refId, shiftId, endDate: null },
    });
    if (dup) return res.status(409).json({ error: 'التعيين ساري أصلاً لنفس النطاق والوردية' });
    const assignment = await prisma.shiftAssignment.create({
      data: { scope: data.scope, refId: data.refId, shiftId, startDate: data.startDate, endDate: data.endDate || null },
    });
    audit(req, 'shifts.assign', { entityType: 'shift_assignment', entityId: String(assignment.id), afterJson: { ...assignment, closed } });
    res.status(201).json({ assignment, closed });
  } catch (e) { next(e); }
});

router.delete('/assignments/:id', requirePerm('shifts.write'), async (req, res, next) => {
  try {
    const id = z.number().int().positive().parse(Number(req.params.id));
    const before = await prisma.shiftAssignment.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ error: 'التعيين غير موجود' });
    await prisma.shiftAssignment.delete({ where: { id } });
    audit(req, 'shifts.unassign', { entityType: 'shift_assignment', entityId: String(id), beforeJson: before });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/assignments', requirePerm('shifts.read'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.employeeId) where = { scope: 'employee', refId: String(req.query.employeeId) };
    if (req.query.scope && req.query.refId) where = { scope: String(req.query.scope), refId: String(req.query.refId) };
    const assignments = await prisma.shiftAssignment.findMany({
      where, include: { shift: true }, orderBy: { startDate: 'desc' }, take: 300,
    });
    res.json({ assignments });
  } catch (e) { next(e); }
});

/** معاينة الوردية الفعّالة — نفس المحرك الذي يستخدمه الحضور وكشف الغياب */
router.get('/resolve/:employeeId', requirePerm('shifts.read'), async (req, res, next) => {
  try {
    const emp = await prisma.employee.findUnique({
      where: { id: String(req.params.employeeId) },
      select: { id: true, fullNameAr: true, deptId: true, branchId: true },
    });
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
    const date = req.query.date
      ? new Date(`${String(req.query.date).slice(0, 10)}T00:00:00Z`)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const resolved = await shiftResolver.resolveShift(emp, date);
    const holiday = await shiftResolver.officialHoliday(date);
    res.json({
      employeeId: emp.id, name: emp.fullNameAr,
      date: date.toISOString().slice(0, 10),
      ...resolved, shift: { ...resolved.shift },
      officialHoliday: holiday ? { nameAr: holiday.nameAr } : null,
      isWorkDay: shiftResolver.isWorkDay(resolved.shift, date),
    });
  } catch (e) { next(e); }
});

module.exports = router;
