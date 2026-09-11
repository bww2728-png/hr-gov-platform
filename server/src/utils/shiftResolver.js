/**
 * shiftResolver — حل الوردية الفعّالة لموظف في تاريخ معين (P0-01/07).
 * ترتيب الأولوية: تعيين موظف ← تعيين قسم ← تعيين فرع ← وردية رمضان (تلقائياً في الشهر 9 الهجري) ← افتراضية من مركز المعايير.
 * كل الأوقات دقائق من منتصف الليل بتوقيت الرياض (حساب الأيام UTC آمن لأن المنطقة ثابتة UTC+3).
 */
const prisma = require('../prisma');
const policyStore = require('./policyStore');

function intOr(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/** افتراضية من مركز المعايير — نفس نافذة workHours المعمول بها قبل الورديات */
function defaultShift() {
  const win = {
    startHour: intOr(policyStore.get('workHours.startHour'), policyStore.SEED_DEFAULTS['workHours.startHour']),
    endHour: intOr(policyStore.get('workHours.endHour'), policyStore.SEED_DEFAULTS['workHours.endHour']),
    lateGraceMins: intOr(policyStore.get('workHours.lateGraceMins'), policyStore.SEED_DEFAULTS['workHours.lateGraceMins']),
  };
  return {
    code: 'DEFAULT', nameAr: 'الوردية الافتراضية', nameEn: 'Default',
    startMin: win.startHour * 60, endMin: win.endHour === 0 ? 1440 : win.endHour * 60,
    graceInMins: win.lateGraceMins,
    earlyLeaveThresholdMins: 15, checkInWindowBeforeMins: 60, checkInWindowAfterMins: 120,
    workDays: [0, 1, 2, 3, 4], // الأحد..الخميس
    allowHolidayCheckIn: false,
    lateDeductionMultiplier: policyStore.get('attendance.lateDeductionMultiplier', 1.5),
    weeklyHourCap: 45, isRamadan: false,
  };
}

/** الشهر الهجري (أم القرى) لأي لحظة بتوقيت الرياض — 1..12 أو null عند فشل التنسيق */
function hijriMonth(d = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { timeZone: 'Asia/Riyadh', month: 'numeric' });
    const m = Number(fmt.format(d).replace(/[^0-9]/g, ''));
    return m >= 1 && m <= 12 ? m : null;
  } catch { return null; }
}

/** نفس شرط السريان في الاستعلامات: startDate <= date <= (endDate أو مفتوح) */
function activeAt(a, date) {
  return a.startDate <= date && (!a.endDate || a.endDate >= date);
}

/** تحميل كل التعيينات السارية في التاريخ مع الورديات — دفعة واحدة (للمسارات والحلقة) */
async function loadActiveAssignments(date) {
  const rows = await prisma.shiftAssignment.findMany({
    where: { startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }] },
    include: { shift: true },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
  });
  return rows.filter((r) => r.shift.active);
}

/**
 * حل الوردية لموظف واحد.
 * @param employee {id, deptId, branchId}
 * @returns {shift, source: 'employee'|'department'|'branch'|'ramadan'|'default'}
 */
function pickForEmployee(employee, assignments, date, ramadanShift) {
  const scopes = [
    ['employee', String(employee.id), 'employee'],
    ['department', String(employee.deptId), 'department'],
    ['branch', String(employee.branchId), 'branch'],
  ];
  for (const [scope, refId, source] of scopes) {
    if (refId === 'null' || refId === 'undefined') continue;
    const hit = assignments.find((a) => a.scope === scope && a.refId === refId && activeAt(a, date));
    if (hit) return { shift: hit.shift, source, assignmentId: hit.id };
  }
  if (ramadanShift && hijriMonth(date) === 9) return { shift: ramadanShift, source: 'ramadan' };
  return { shift: defaultShift(), source: 'default' };
}

async function resolveShift(employee, date = rulesDayStart(new Date())) {
  const assignments = await loadActiveAssignments(date);
  const ramadanShift = (await prisma.workShift.findFirst({ where: { isRamadan: true, active: true } })) || null;
  return pickForEmployee(employee, assignments, date, ramadanShift);
}

/** حل جماعي لكل الموظفين — يستخدمه كشف الغياب (استعلامات ثابتة مهما كان العدد) */
async function resolveShiftsBulk(employees, date) {
  const [assignments, ramadanShift] = await Promise.all([
    loadActiveAssignments(date),
    prisma.workShift.findFirst({ where: { isRamadan: true, active: true } }),
  ]);
  const map = new Map();
  for (const emp of employees) map.set(emp.id, pickForEmployee(emp, assignments, date, ramadanShift || null));
  return map;
}

function rulesDayStart(d) {
  const { riyadhDayStart } = require('./attendanceRules');
  return riyadhDayStart(d);
}

/** قاعدة اليوم: يوم عمل حسب وردية الموظف؟ (0=الأحد..6=السبت) */
function isWorkDay(shift, date) {
  const dow = date.getUTCDay();
  return Array.isArray(shift.workDays) ? shift.workDays.includes(dow) : true;
}

/** عطلة رسمية تغطي التاريخ (منتصف ليل الرياض كحدود) */
async function officialHoliday(date) {
  return prisma.officialHoliday.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } });
}

module.exports = { resolveShift, resolveShiftsBulk, defaultShift, hijriMonth, isWorkDay, officialHoliday, loadActiveAssignments, pickForEmployee };
