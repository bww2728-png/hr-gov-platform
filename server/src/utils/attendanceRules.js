/**
 * attendanceRules — قواعد الحضور المشتركة (المسارات + كشف الغياب التلقائي).
 * كل الأوقات بتوقيت الرياض (UTC+3 ثابت — السعودية بلا توقيت صيفي)، مستقلة عن توقيت الخادم.
 * مصادر القيم: مركز المعايير والقواعد (policyStore) مع احتياطي القيم المدمجة.
 */
const prisma = require('../prisma');
const policyStore = require('./policyStore');

function intOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** نافذة الدوام الحالية من مركز المعايير (مع تعقيم الحدود) */
function getWorkWindow() {
  return {
    startHour: Math.min(23, Math.max(0, intOr(policyStore.get('workHours.startHour'), policyStore.SEED_DEFAULTS['workHours.startHour']))),
    endHour: Math.min(23, Math.max(0, intOr(policyStore.get('workHours.endHour'), policyStore.SEED_DEFAULTS['workHours.endHour']))),
    lateGraceMins: Math.min(120, Math.max(0, intOr(policyStore.get('workHours.lateGraceMins'), policyStore.SEED_DEFAULTS['workHours.lateGraceMins']))),
    absenceAfterHours: Math.min(12, Math.max(0, intOr(policyStore.get('workHours.absenceAfterHours'), policyStore.SEED_DEFAULTS['workHours.absenceAfterHours']))),
  };
}

/** أجزاء التاريخ/الوقت بتوقيت الرياض لأي لحظة (مستقلة عن TZ الخادم) */
function riyadhParts(d) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of fmt.formatToParts(d)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: +(p.hour === '24' ? 0 : p.hour), mm: +p.minute };
}

/** بداية "اليوم" بتوقيت الرياض كـ Date (منتصف ليل الرياض = 21:00 UTC من الأمس) */
function riyadhDayStart(d = new Date()) {
  const { y, m, d: dd } = riyadhParts(d);
  return new Date(Date.UTC(y, m - 1, dd));
}

/** دقائق اليوم (من منتصف الليل) لتوقيت الرياض */
function riyadhMinutesOfDay(d) {
  const { hh, mm } = riyadhParts(d);
  return hh * 60 + mm;
}

/** دقائق التأخير: تجاوز (بداية الدوام + السماحية) — صفر ضمن السماحية */
function computeLateMins(checkIn, win = getWorkWindow()) {
  if (!checkIn) return 0;
  const startMins = win.startHour * 60 + win.lateGraceMins;
  return Math.max(0, riyadhMinutesOfDay(checkIn) - startMins);
}

/** دقائق الانصراف المبكر قبل نهاية الدوام (للعرض) */
function computeEarlyMins(checkOut, win = getWorkWindow()) {
  if (!checkOut) return 0;
  const endMins = win.endHour * 60;
  return Math.max(0, endMins - riyadhMinutesOfDay(checkOut));
}

/**
 * تصعيد مخالفة الحضور — نفس سلم النظام: 1st إنذار → 2nd إنذار → 3rd+ خصم.
 * المشترك بين التسجيل اليدوي والكشف التلقائي لضمان سلوك واحد.
 */
async function escalateIncident({ employeeId, type, date, minsLate = null, hasExcuse = false, excuseNote = null, resolvedById = null }) {
  const count = await prisma.attendanceIncident.count({ where: { employeeId, type } });
  const occurrence = count + 1;
  let action = 'none';
  if (!hasExcuse) {
    if (occurrence >= 3) action = 'deduction';
    else if (occurrence === 2) action = 'warning_2';
    else action = 'warning_1';
  }
  return prisma.attendanceIncident.create({
    data: {
      employeeId, type, date,
      minsLate: minsLate || null, hasExcuse: !!hasExcuse, excuseNote: excuseNote || null,
      action, occurrence, resolvedById,
    },
  });
}

/**
 * مسح الغياب التلقائي لليوم الحالي بتوقيت الرياض.
 * Idempotent بطبيعته: لا يلمس إلا من ليس له سجل حضور اليوم — إعادة التشغيل لا تكرر شيئاً.
 * يعيد ملخصاً: { date, cutoffAt, createdAbsent, createdLeave, skipped }
 */
async function runAbsenceSweep({ actorId = null } = {}) {
  const win = getWorkWindow();
  if (win.absenceAfterHours <= 0) {
    return { skipped: 'disabled', reason: 'workHours.absenceAfterHours = 0' };
  }
  const now = new Date();
  const dayStart = riyadhDayStart(now);
  const dow = dayStart.getUTCDay();
  if (dow === 5 || dow === 6) {
    return { skipped: 'weekend', reason: 'الجمعة/السبت راحة أسبوعية' };
  }
  // لحظة القص بتوقيت الرياض: (بداية الدوام + N ساعة) — الرياض = UTC+3
  const cutoff = new Date(dayStart.getTime() + (win.startHour + win.absenceAfterHours - 3) * 3600000);
  if (now < cutoff) {
    return { skipped: 'before-cutoff', cutoffAt: cutoff.toISOString() };
  }

  const activeEmployees = await prisma.employee.findMany({
    where: { employmentStatus: 'active', hireDate: { lte: dayStart } },
    select: { id: true },
  });
  const existing = await prisma.attendanceRecord.findMany({
    where: { date: dayStart, employeeId: { in: activeEmployees.map((e) => e.id) } },
    select: { employeeId: true },
  });
  const hasRecord = new Set(existing.map((r) => r.employeeId));
  const missing = activeEmployees.filter((e) => !hasRecord.has(e.id));
  if (!missing.length) return { date: dayStart.toISOString(), cutoffAt: cutoff.toISOString(), createdAbsent: 0, createdLeave: 0 };

  // إجازات معتمدة تغطي اليوم → سجل "إجازة" بلا مخالفة
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      startDate: { lte: dayStart },
      endDate: { gte: dayStart },
      employeeId: { in: missing.map((e) => e.id) },
    },
    select: { employeeId: true },
  });
  const onLeave = new Set(leaves.map((l) => l.employeeId));

  let createdAbsent = 0; let createdLeave = 0;
  for (const emp of missing) {
    if (onLeave.has(emp.id)) {
      await prisma.attendanceRecord.create({
        data: { employeeId: emp.id, date: dayStart, method: 'auto', status: 'leave', notes: 'كشف تلقائي: إجازة معتمدة' },
      });
      createdLeave += 1;
      continue;
    }
    await prisma.attendanceRecord.create({
      data: { employeeId: emp.id, date: dayStart, method: 'auto', status: 'absent', notes: `كشف تلقائي: لم يسجل حضوراً حتى ${win.startHour + win.absenceAfterHours}:00` },
    });
    const incident = await escalateIncident({ employeeId: emp.id, type: 'absence', date: dayStart, resolvedById: actorId });
    await prisma.auditLog.create({
      data: {
        userId: actorId ?? null, action: 'attendance.auto_absence',
        entityType: 'attendance_record', entityId: String(incident.id),
        afterJson: { employeeId: emp.id, date: dayStart.toISOString(), occurrence: incident.occurrence, action: incident.action },
        reason: 'كشف الغياب التلقائي (node-cron)',
      },
    }).catch(() => {});
    createdAbsent += 1;
  }
  return { date: dayStart.toISOString(), cutoffAt: cutoff.toISOString(), createdAbsent, createdLeave, totalMissing: missing.length };
}

module.exports = { getWorkWindow, riyadhParts, riyadhDayStart, riyadhMinutesOfDay, computeLateMins, computeEarlyMins, escalateIncident, runAbsenceSweep };
