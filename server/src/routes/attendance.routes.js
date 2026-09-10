/**
 * Attendance Engine - حضور وانصراف، عمل إضافي، مخالفات (معاملات 26-28)
 */
const express = require('express');
const { z } = require('zod');
const prisma = require('../prisma');
const { authenticate, require: requirePerm } = require('../middleware/auth');
const { audit } = require('../middleware/audit');
const saudi = require('../utils/saudiRules');
const policyStore = require('../utils/policyStore');

const router = express.Router();
router.use(authenticate);

const selfId = (req) => req.user.employeeId || req.user.employee?.id || null;
const rules = require('../utils/attendanceRules');

// ============ سجلات الحضور ============
router.get('/records', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('attendance.read');
    const where = {};
    if (req.query.employeeId && seeAll) where.employeeId = String(req.query.employeeId);
    else if (!seeAll) {
      const empId = selfId(req);
      if (!empId) return res.json({ records: [] });
      where.employeeId = empId;
    }
    if (req.query.from) where.date = { ...(where.date || {}), gte: new Date(String(req.query.from)) };
    if (req.query.to) where.date = { ...(where.date || {}), lte: new Date(String(req.query.to)) };
    const records = await prisma.attendanceRecord.findMany({ where, orderBy: { date: 'desc' }, take: 500 });
    res.json({ records });
  } catch (e) { next(e); }
});

router.post('/records', requirePerm('attendance.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      date: z.string(),
      checkIn: z.string().optional().nullable(),
      checkOut: z.string().optional().nullable(),
      method: z.enum(['fingerprint', 'gps', 'card', 'manual']).default('manual'),
      status: z.enum(['present', 'absent', 'leave', 'holiday', 'remote']).default('present'),
      notes: z.string().max(500).optional().nullable(),
    }).parse(req.body);

    let lateMins = 0; let workedHours = 0;
    const ci = data.checkIn ? new Date(data.checkIn) : null;
    const co = data.checkOut ? new Date(data.checkOut) : null;
    if (ci) {
      lateMins = rules.computeLateMins(ci);
    }
    if (ci && co) workedHours = Math.round(((co - ci) / 3600000) * 100) / 100;

    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date: new Date(data.date) } },
      create: {
        employeeId: data.employeeId, date: new Date(data.date),
        checkIn: ci, checkOut: co, method: data.method, status: data.status,
        lateMins, workedHours, notes: data.notes || null,
      },
      update: { checkIn: ci, checkOut: co, method: data.method, status: data.status, lateMins, workedHours, notes: data.notes || null },
    });
    audit(req, 'attendance.record.upsert', { entityType: 'attendance_record', entityId: String(record.id), afterJson: record });
    res.status(201).json({ record });
  } catch (e) { next(e); }
});

// تسجيل ذاتي (بصمة/GPS من الواجهة)
router.post('/check-in', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const method = z.enum(['fingerprint', 'gps', 'card', 'manual']).parse(req.body?.method || 'gps');
    const now = new Date();
    const today = rules.riyadhDayStart(now);
    const lateMins = rules.computeLateMins(now);

    const record = await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: empId, date: today } },
      create: { employeeId: empId, date: today, checkIn: now, method, lateMins, status: 'present' },
      update: { checkIn: now, method, lateMins, status: 'present' },
    });
    audit(req, 'attendance.check_in', { entityType: 'attendance_record', entityId: String(record.id) });
    res.status(201).json({ record, lateMins });
  } catch (e) { next(e); }
});

router.post('/check-out', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const now = new Date();
    const today = rules.riyadhDayStart(now);
    const existing = await prisma.attendanceRecord.findUnique({ where: { employeeId_date: { employeeId: empId, date: today } } });
    if (!existing || !existing.checkIn) return res.status(400).json({ error: 'لم يتم تسجيل حضور اليوم' });
    const workedHours = Math.round(((now - existing.checkIn) / 3600000) * 100) / 100;
    const earlyMins = rules.computeEarlyMins(now);
    const record = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { checkOut: now, workedHours, earlyMins },
    });
    audit(req, 'attendance.check_out', { entityType: 'attendance_record', entityId: String(record.id) });
    res.json({ record, workedHours, earlyMins });
  } catch (e) { next(e); }
});

// نافذة الدوام الحالية (للعرض في الواجهات) — من مركز المعايير والقواعد
// + قيمة خصم التأخر النقدي اللحظية للموظف الحالي (P0-08)
router.get('/work-window', async (req, res, next) => {
  try {
    const win = rules.getWorkWindow();
    const out = { ...win, cutoffHour: win.startHour + win.absenceAfterHours };

    const empId = selfId(req);
    if (empId) {
      const today = rules.riyadhDayStart(new Date());
      const rec = await prisma.attendanceRecord.findUnique({
        where: { employeeId_date: { employeeId: empId, date: today } },
        select: { lateMins: true },
      });
      const emp = await prisma.employee.findUnique({ where: { id: empId }, select: { salary: true } });
      const lateMins = rec?.lateMins || 0;
      const deduction = saudi.lateDeduction(
        lateMins,
        Number(emp?.salary) || 0,
        policyStore.get('attendance.lateDeductionMultiplier'),
        policyStore.get('payroll.hourlyDivisor')
      );
      out.todayLate = { mins: lateMins, deduction: Math.round(deduction * 100) / 100 };
    }
    res.json(out);
  } catch (e) { next(e); }
});

// تشغيل مسح الغياب يدوياً (للمسؤول) — نفس منطق المجدول تماماً (idempotent)
router.post('/absence-sweep/run', requirePerm('attendance.incidents.write'), async (req, res, next) => {
  try {
    const result = await rules.runAbsenceSweep({ actorId: req.user.id });
    audit(req, 'attendance.absence_sweep.run', { entityType: 'attendance_sweep', afterJson: result });
    res.json({ result });
  } catch (e) { next(e); }
});

// ملخص شهري
router.get('/summary/:employeeId', async (req, res, next) => {
  try {
    const empId = req.params.employeeId;
    const me = selfId(req);
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    if (empId !== me && !(perms.includes('*') || perms.includes('attendance.read'))) {
      return res.status(403).json({ error: 'ممنوع' });
    }
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);
    const records = await prisma.attendanceRecord.findMany({ where: { employeeId: empId, date: { gte: from, lte: to } } });
    const summary = {
      present: records.filter((r) => r.status === 'present').length,
      absent: records.filter((r) => r.status === 'absent').length,
      leave: records.filter((r) => r.status === 'leave').length,
      remote: records.filter((r) => r.status === 'remote').length,
      totalLateMins: records.reduce((s, r) => s + (r.lateMins || 0), 0),
      totalWorkedHours: Math.round(records.reduce((s, r) => s + (r.workedHours || 0), 0) * 100) / 100,
    };
    res.json({ summary, month, year });
  } catch (e) { next(e); }
});

// ============ العمل الإضافي (سقف 720 ساعة/سنة) ============
router.get('/overtime', async (req, res, next) => {
  try {
    const perms = Array.isArray(req.user.role?.permissions) ? req.user.role.permissions : [];
    const seeAll = perms.includes('*') || perms.includes('overtime.read') || perms.includes('overtime.approve');
    const empId = selfId(req);
    if (!seeAll && !empId) return res.json({ requests: [] });
    const where = seeAll ? {} : { employeeId: empId };
    if (req.query.status) where.status = String(req.query.status);
    const requests = await prisma.overtimeRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ requests });
  } catch (e) { next(e); }
});

router.post('/overtime', async (req, res, next) => {
  try {
    const empId = selfId(req);
    if (!empId) return res.status(400).json({ error: 'لا يوجد ملف موظف مرتبط' });
    const data = z.object({
      date: z.string(), hours: z.number().positive().max(12),
      reason: z.string().min(3).max(500), isEmergency: z.boolean().optional(),
    }).parse(req.body);

    const year = new Date(data.date).getFullYear();
    const yearStart = new Date(year, 0, 1); const yearEnd = new Date(year, 11, 31);
    const used = await prisma.overtimeRequest.aggregate({
      _sum: { hours: true },
      where: { employeeId: empId, status: 'approved', date: { gte: yearStart, lte: yearEnd } },
    });
    const usedHours = used._sum.hours || 0;
    const cap = saudi.RULES.overtime.yearCapHours;
    if (!data.isEmergency && usedHours + data.hours > cap) {
      return res.status(400).json({ error: `تجاوز سقف العمل الإضافي السنوي (${cap} ساعة) — المستخدم ${usedHours}` });
    }
    const request = await prisma.overtimeRequest.create({
      data: { employeeId: empId, date: new Date(data.date), hours: data.hours, reason: data.reason, isEmergency: !!data.isEmergency, yearCap: cap },
    });
    audit(req, 'overtime.create', { entityType: 'overtime_request', entityId: String(request.id) });
    res.status(201).json({ request, yearUsed: usedHours + data.hours, yearCap: cap });
  } catch (e) { next(e); }
});

router.post('/overtime/:id/decision', requirePerm('overtime.approve'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { decision } = z.object({ decision: z.enum(['approve', 'reject']) }).parse(req.body);
    const row = await prisma.overtimeRequest.findUnique({ where: { id } });
    if (!row || row.status !== 'pending') return res.status(400).json({ error: 'الطلب ليس معلقاً' });
    const updated = await prisma.overtimeRequest.update({
      where: { id },
      data: { status: decision === 'approve' ? 'approved' : 'rejected', approvedById: req.user.id, decidedAt: new Date() },
    });
    audit(req, `overtime.${decision}`, { entityType: 'overtime_request', entityId: String(id) });
    res.json({ request: updated });
  } catch (e) { next(e); }
});

// ============ مخالفات الحضور (تأخر/غياب/انصراف مبكر) ============
router.get('/incidents', requirePerm('attendance.read', 'attendance.incidents.write'), async (req, res, next) => {
  try {
    const where = {};
    if (req.query.employeeId) where.employeeId = String(req.query.employeeId);
    if (req.query.type) where.type = String(req.query.type);
    const incidents = await prisma.attendanceIncident.findMany({ where, orderBy: { date: 'desc' }, take: 300 });
    res.json({ incidents });
  } catch (e) { next(e); }
});

router.post('/incidents', requirePerm('attendance.incidents.write'), async (req, res, next) => {
  try {
    const data = z.object({
      employeeId: z.string().uuid(),
      type: z.enum(['late', 'absence', 'early_leave']),
      date: z.string(), minsLate: z.number().int().optional(),
      hasExcuse: z.boolean().optional(), excuseNote: z.string().max(500).optional(),
    }).parse(req.body);

    // التصعيد عبر المساعد المشترك مع الكشف التلقائي (سلوك واحد)
    const incident = await rules.escalateIncident({
      employeeId: data.employeeId, type: data.type, date: new Date(data.date),
      minsLate: data.minsLate || null, hasExcuse: !!data.hasExcuse, excuseNote: data.excuseNote || null,
      resolvedById: req.user.id,
    });
    audit(req, 'attendance.incident.create', { entityType: 'attendance_incident', entityId: String(incident.id), afterJson: incident });
    res.status(201).json({ incident });
  } catch (e) { next(e); }
});

module.exports = router;
