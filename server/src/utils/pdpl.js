/**
 * PDPL pure helpers — حسابات المهل والانتقالات والاحتفاظ.
 * دوال نقية بلا قاعدة بيانات — قابلة للاختبار مباشرة (tests/pdpl.test.js).
 * المصادر: المادة (12) من نظام حماية البيانات الشخصية + اللائحة التنفيذية (م33 RoPA)
 * + معاملات مركز المعايير (dsar.responseDays / dsar.extensionDays / breach.sdaiaHours / retention.*).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** إضافة أيام إلى تاريخ (يعيد Date جديد) */
function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

/** مهلة الاستجابة: التقديم + dsar.responseDays (م12: 30 يوماً) */
function computeDsarDueDate(submittedAt, responseDays) {
  return addDays(submittedAt, Number(responseDays) || 30);
}

/**
 * مهلة التمديد: من أحدث مهلة سارية (extendedDueDate إن وجد وإلا dueDate)
 * + dsar.extensionDays (بإشعار مسبب — السبب شرط قبل الاستدعاء).
 */
function computeExtendedDue(currentDueDate, extendedDueDate, extensionDays) {
  const base = extendedDueDate || currentDueDate;
  return addDays(base, Number(extensionDays) || 0);
}

/** حالات يُقبل فيها البت (تنفيذ/رفض): قبل الإغلاق فقط */
function dsarCanDecide(status) {
  return ['submitted', 'in_progress', 'extended'].includes(status);
}

/** حالات يُقبل فيها التمديد: غير المنتهية فقط */
function dsarCanExtend(status) {
  return ['submitted', 'in_progress', 'extended'].includes(status);
}

/** أنواع طلبات أصحاب البيانات المدعومة */
const DSAR_TYPES = ['access', 'portable_copy', 'rectification', 'erasure'];

/**
 * نافذة الإبلاغ لسدايا: اكتشاف + breach.sdaiaHours (72 ساعة افتراضياً).
 * يعيد: deadlineAt, remainingHours, overdue, urgent (أقل من 12 ساعة متبقية).
 */
function breachSdaiaWindow(detectedAt, now, sdaiaHours) {
  const detected = new Date(detectedAt).getTime();
  const deadline = detected + (Number(sdaiaHours) || 72) * HOUR_MS;
  const remainingMs = deadline - new Date(now).getTime();
  return {
    deadlineAt: new Date(deadline).toISOString(),
    remainingHours: Math.round((remainingMs / HOUR_MS) * 10) / 10,
    remainingMins: Math.round(remainingMs / (60 * 1000)),
    overdue: remainingMs < 0,
    urgent: remainingMs >= 0 && remainingMs <= 12 * HOUR_MS,
  };
}

/**
 * أهلية الإتلاف (م10: الاستثناء النظامي للاحتفاظ).
 * الإتلاف الفعلي للبيانات الشخصية لا يجوز أثناء العلاقة الوظيفية،
 * ولا قبل انقضاء مدة الاحتفاظ النظامية: مالية 10 سنوات عند وجود سجلات
 * مالية/رواتب، وإلا شخصية 5 سنوات من آخر يوم عمل.
 */
function erasureEligibility({ lastWorkingDate, hasFinancialRecords, now, personnelYears, financialYears }) {
  if (!lastWorkingDate) {
    return { eligible: false, reason: 'الموظف نشط — لا يجوز الإتلاف أثناء العلاقة الوظيفية' };
  }
  const end = new Date(lastWorkingDate).getTime();
  const elapsedYears = (new Date(now).getTime() - end) / (365.25 * DAY_MS);
  const requiredYears = hasFinancialRecords ? (Number(financialYears) || 10) : (Number(personnelYears) || 5);
  const remainingYears = Math.round((requiredYears - elapsedYears) * 100) / 100;
  if (remainingYears > 0) {
    return {
      eligible: false,
      reason: `مدة الاحتفاظ النظامية لم تنتهِ — المطلوب ${requiredYears} سنة (${hasFinancialRecords ? 'مالية: توجد سجلات رواتب' : 'شخصية'})، المتبقي ~${remainingYears} سنة`,
    };
  }
  return { eligible: true, reason: `انقضت مدة الاحتفاظ (${requiredYears} سنة ${hasFinancialRecords ? 'مالية' : 'شخصية'})` };
}

/** حقول الموظف الشخصية التي يُمحى محتواها عند الإتلاف المؤهل (تبقى القشرة الوظيفية/المالية للسجلات النظامية) */
const ERASURE_FIELDS = {
  nationalId: null, dobHijri: null, dobGregorian: null, email: null,
  phone: null, address: null, gender: null, maritalStatus: null,
  bankName: null, bankAccount: null, iban: null,
};

module.exports = {
  DAY_MS, HOUR_MS, DSAR_TYPES, ERASURE_FIELDS,
  addDays, computeDsarDueDate, computeExtendedDue,
  dsarCanDecide, dsarCanExtend,
  breachSdaiaWindow, erasureEligibility,
};
