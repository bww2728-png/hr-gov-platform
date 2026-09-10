/**
 * محرك قواعد نظام العمل السعودي
 * كل القواعد قابلة للتعديل عبر الإعدادات/قاعدة البيانات — القيم الافتراضية حسب
 * نظام العمل السعودي ومخططات المعاملات (الملف المرجعي).
 * GOSI والعمل الإضافي تُقرأ لحظياً من policyStore (مركز السياسات) مع سقوط احتياطي للقيم الصلبة.
 */

const policyStore = require('./policyStore');

const RULES = {
  // الإجازة السنوية: <5 سنوات = 21 يوم، ≥5 سنوات = 30 يوم (معاملة 35)
  annualLeave: {
    belowFiveYears: 21,
    fiveYearsAndAbove: 30,
    accrualMonthlyBelow5: 1.75,
    accrualMonthlyAbove5: 2.5,
    maxCarryOver: 10,
  },
  // الإجازة المرضية: فئات الأجر (معاملة 30)
  sickLeave: {
    tiers: [
      { uptoDays: 30, payPct: 100 },
      { uptoDays: 90, payPct: 75 },
      { uptoDays: 120, payPct: 0 },
    ],
    maxDaysPerYear: 120,
  },
  // إجازات خاصة (معاملات 31-34)
  maternity: { weeksTotal: 10, weeksBeforeBirth: 4, nursingHoursPerDay: 1, payPct: 100 },
  paternity: { days: 3 },
  hajj: { daysMin: 10, daysMax: 15, minServiceYears: 2, oncePerService: true },
  marriage: { days: 5 },
  bereavement: { days: 5 },
  // فترة التجربة (معاملة 23)
  probation: { days: 90, midReviewDay: 45, secondReviewDay: 60 },
  // العمل الإضافي (معاملة 27) — قيم ديناميكية من مركز السياسات
  overtime: {
    get yearCapHours() { return policyStore.get('overtime.yearCapHours'); },
    get multiplier() { return policyStore.get('overtime.multiplier'); },
  },
  // التأمينات الاجتماعية GOSI (معاملة 17, 50) — قيم ديناميكية من مركز السياسات
  gosi: {
    get employeePct() { return policyStore.get('gosi.employeePct'); },
    get employerPct() { return policyStore.get('gosi.employerPct'); },
  },
  // رخصة العمل (معاملة 16)
  workPermitFee: { above50Employees: 9000, upTo50Employees: 7200 },
  // تأشيرة الزيارة العائلية (معاملة 18)
  familyVisa: { minSalary: 5000, minServiceMonths: 6 },
  // الإقامة (معاملة 15)
  iqama: { issueWithinDays: 90, renewalNoticeMonths: 3, passportMinMonths: 6, medicalEveryYears: 2 },
  // الخروج النهائي (معاملة 66)
  finalExit: { validityDays: 60 },
  // نقل الكفالة (معاملة 19)
  kafala: { minServiceMonths: 12, feeMin: 2000, feeMax: 10000, exemptionReasons: ['salary_delay_3m', 'abuse_court'] },
  // رسوم نقل الكفالة التقريبية
  // GAMCA صلاحية (معاملة 14)
  gamca: { validityMonths: 3 },
};

/** سنوات الخدمة حتى تاريخ معين */
function serviceYears(hireDate, asOf = new Date()) {
  if (!hireDate) return 0;
  const ms = new Date(asOf).getTime() - new Date(hireDate).getTime();
  return Math.floor((ms / (365.25 * 24 * 3600 * 1000)) * 100) / 100;
}

/** استحقاق الإجازة السنوية حسب سنوات الخدمة */
function annualEntitlement(hireDate, asOf = new Date()) {
  const years = serviceYears(hireDate, asOf);
  return years >= 5 ? RULES.annualLeave.fiveYearsAndAbove : RULES.annualLeave.belowFiveYears;
}

/** الاستحقاق الشهري المتراكم */
function annualAccrualMonthly(hireDate) {
  const years = serviceYears(hireDate);
  return years >= 5 ? RULES.annualLeave.accrualMonthlyAbove5 : RULES.annualLeave.accrualMonthlyBelow5;
}

/**
 * فئة أجر الإجازة المرضية حسب عدد الأيام المستخدمة في السنة.
 * يعيد { payPct, tierIndex, remainingAtFullPct }
 */
function sickPayTier(usedDaysThisYear, requestedDays) {
  const tiers = RULES.sickLeave.tiers;
  let cursor = usedDaysThisYear;
  const segments = [];
  let remaining = requestedDays;
  for (let i = 0; i < tiers.length && remaining > 0; i++) {
    const t = tiers[i];
    const tierCapacity = Math.max(0, t.uptoDays - cursor);
    if (tierCapacity <= 0) continue;
    const take = Math.min(tierCapacity, remaining);
    segments.push({ payPct: t.payPct, days: take });
    cursor += take;
    remaining -= take;
  }
  if (remaining > 0) segments.push({ payPct: 0, days: remaining, overLimit: true });
  return segments;
}

/**
 * GOSI المتدرج (P0-02) — النسب حسب تاريخ أول تسجيل في التأمينات وسنة شهر المسير.
 * - غير سعودي: موظف 0% / صاحب عمل = أخطار مهنية فقط (gosi.expat.employerPct).
 * - مسجل قبل 3 يوليو 2024: النظام القديم 9.75 / 11.75 (gosi.old.*).
 * - مسجل بعدها: تدرج سنوي حتى يوليو 2028: 2025=10.25/12.25, 2026=10.75/12.75,
 *   2027=11.25/13.25, 2028+=11.75/13.75.
 * - الأجر الخاضع = clamp(gosiSubscriptionWage ?? أساسي+سكن, gosi.wageFloor, gosi.wageCap).
 * - سعودي بلا gosiRegistrationDate: يُحسب على القديم (استمرارية، بلا زيادة على الموظف)
 *   مع رفع علم needsRegistrationDate لتصحيح البيانات.
 */
function isSaudi(nationality) {
  const n = String(nationality || '').toLowerCase();
  return n.includes('سعود') || n.includes('saudi');
}

function gosiTier({ nationality, gosiRegistrationDate, basicSalary = 0, housingAllowance = 0, gosiSubscriptionWage = null, month, snap }) {
  const val = (code, fb) => (snap ? policyStore.valueFrom(snap, code) : policyStore.get(code, fb));
  const floor = Number(val('gosi.wageFloor', 1500)) || 1500;
  const cap = Number(val('gosi.wageCap', 45000)) || 45000;
  const rawWage = gosiSubscriptionWage != null ? Number(gosiSubscriptionWage) : (Number(basicSalary) || 0) + (Number(housingAllowance) || 0);
  const wage = Math.min(cap, Math.max(floor, rawWage));
  const out = { wage, wageRaw: rawWage, clamped: rawWage !== wage, employeePct: 0, employerPct: 0, employee: 0, employer: 0, tier: null, needsRegistrationDate: false };

  if (!isSaudi(nationality)) {
    out.employeePct = 0;
    out.employerPct = Number(val('gosi.expat.employerPct', 2)) || 0;
    out.tier = 'expat';
  } else if (!gosiRegistrationDate) {
    out.employeePct = Number(val('gosi.old.employeePct', 9.75));
    out.employerPct = Number(val('gosi.old.employerPct', 11.75));
    out.tier = 'legacy_unknown_reg_date';
    out.needsRegistrationDate = true;
  } else if (new Date(gosiRegistrationDate) < new Date('2024-07-03T00:00:00Z')) {
    out.employeePct = Number(val('gosi.old.employeePct', 9.75));
    out.employerPct = Number(val('gosi.old.employerPct', 11.75));
    out.tier = 'pre_jul2024';
  } else {
    const y = (month && Number(month.year)) || new Date().getFullYear();
    const yy = y <= 2024 ? 2025 : Math.min(y, 2028);
    out.employeePct = Number(val(`gosi.y${yy}.employeePct`, 11.75));
    out.employerPct = Number(val(`gosi.y${yy}.employerPct`, 13.75));
    out.tier = `y${yy}`;
  }
  out.employee = Math.round(wage * out.employeePct) / 100;
  out.employer = Math.round(wage * out.employerPct) / 100;
  return out;
}

/**
 * حصص GOSI — التوافق القديم: أساس رقمي + snapshot. يطبق الأرضية والسقف وينبض النسب
 * المتدرجة حسب السياسات (بدون سياق موظف: يفترض القديم — يستخدم في الشروح الاسترشادية فقط).
 */
function gosiShares(salaryBase, snap) {
  const base = Number(salaryBase) || 0;
  const val = (code, fb) => (snap ? policyStore.valueFrom(snap, code) : policyStore.get(code, fb));
  const floor = Number(val('gosi.wageFloor', 1500)) || 1500;
  const cap = Number(val('gosi.wageCap', 45000)) || 45000;
  const wage = Math.min(cap, Math.max(floor, base));
  const employeePct = Number(val('gosi.old.employeePct', 9.75));
  const employerPct = Number(val('gosi.old.employerPct', 11.75));
  return {
    wage, employeePct, employerPct,
    employee: Math.round(wage * employeePct) / 100,
    employer: Math.round(wage * employerPct) / 100,
  };
}

/** عداد الخصم النقدي للتأخر (P0-08): (دقائق/60) × (الأساسي/المقسوم) × المعامل */
function lateDeduction(lateMins, basicSalary, multiplier = 1.5, divisor = 240) {
  const mins = Math.max(0, Number(lateMins) || 0);
  const rate = (Number(basicSalary) || 0) / (Number(divisor) || 240);
  return Math.round((mins / 60) * rate * (Number(multiplier) || 0) * 1000) / 1000;
}

/**
 * مكافأة نهاية الخدمة — القانوني الكامل (المادتان 84 و85) (P0-03):
 * الأجر المعتمد = الأساسي + السكن + البدلات الثابتة المنتظمة (لا عمولات/متغيرة).
 * الاستحقاق الكامل: نصف شهر × أول 5 سنوات + شهر × ما بعدها (الكسور بنسبي الشهور).
 * نسب الاستقطاع للاستقالة في العقد غير المحدد: <2=0 | 2-5=ثلث | 5-10=ثلثان | ≥10=كامل.
 * الاستحقاق بلا استقطاع: إنهاء صاحب العمل، انتهاء عقد محدد، تقاعد، وفاة/عجز، قوة قاهرة.
 * الصفر: فصل فوري بموجب المادة 80.
 */
const EOS_FULL_REASONS = ['termination', 'end_fixed_contract', 'retirement', 'death', 'disability', 'force_majeure', 'employer_bankruptcy'];
const EOS_ZERO_REASONS = ['article80', 'worker_breach'];

function calculateEOS({ hireDate, endDate = new Date(), lastSalary, reason = 'termination', years: yearsInput, wage: wageInput }) {
  // سنوات خدمة كسرية دقيقة (النسبي بالشهور للكسور)
  let years;
  if (yearsInput !== undefined) years = Number(yearsInput);
  else if (hireDate && endDate) {
    const start = new Date(hireDate); const end = new Date(endDate);
    const totalDays = Math.max(0, (end - start) / 86400000);
    years = totalDays / 365.25;
  } else years = 0;
  years = Math.max(0, years);

  const wage = Number(wageInput ?? lastSalary) || 0;
  const first5 = Math.min(years, 5);
  const rest = Math.max(0, years - 5);
  const s1 = (wage / 2) * first5;
  const s2 = wage * rest;
  const gross = s1 + s2;

  const breakdown = { years: Math.round(years * 100) / 100, reason, wage, segments: [], gross: Math.round(gross * 100) / 100, ratio: 1, eosAmount: 0 };
  if (first5 > 0) breakdown.segments.push({ note: `نصف شهر × ${+first5.toFixed(2)} سنة`, amount: Math.round(s1 * 100) / 100 });
  if (rest > 0) breakdown.segments.push({ note: `شهر × ${+rest.toFixed(2)} سنة`, amount: Math.round(s2 * 100) / 100 });

  if (EOS_ZERO_REASONS.includes(reason)) {
    breakdown.segments.push({ note: 'فصل فوري — المادة 80: لا مكافأة', amount: 0 });
    breakdown.eosAmount = 0;
    return breakdown;
  }
  if (EOS_FULL_REASONS.includes(reason)) {
    breakdown.eosAmount = breakdown.gross;
    return breakdown;
  }
  if (reason === 'resignation') {
    let ratio = 0;
    if (years < 2) { ratio = 0; breakdown.segments.push({ note: 'استقالة قبل سنتين — لا استحقاق (م85)', amount: 0 }); }
    else if (years < 5) { ratio = 1 / 3; breakdown.segments.push({ note: 'استقالة 2-5 سنوات: ثلث المكافأة (م85)', amount: 0 }); }
    else if (years < 10) { ratio = 2 / 3; breakdown.segments.push({ note: 'استقالة 5-10 سنوات: ثلثا المكافأة (م85)', amount: 0 }); }
    else { ratio = 1; breakdown.segments.push({ note: 'استقالة 10+ سنوات: كامل المكافأة (م85)', amount: 0 }); }
    breakdown.ratio = ratio;
    breakdown.eosAmount = Math.round(gross * ratio * 100) / 100;
    return breakdown;
  }
  // سبب غير معروف: الأصل الاستحقاق الكامل (منع خصم غير مبرر)
  breakdown.segments.push({ note: 'استحقاق كامل (سبب غير مقيد بالاستقطاع)', amount: 0 });
  breakdown.eosAmount = breakdown.gross;
  return breakdown;
}

/** رسوم رخصة العمل حسب حجم المنشأة */
function workPermitFee(totalEmployees) {
  return totalEmployees > 50 ? RULES.workPermitFee.above50Employees : RULES.workPermitFee.upTo50Employees;
}

/** أهلية تأشيرة الزيارة العائلية */
function familyVisaEligible({ salary, hireDate }) {
  const months = serviceYears(hireDate) * 12;
  return {
    eligible: Number(salary) > RULES.familyVisa.minSalary && months >= RULES.familyVisa.minServiceMonths,
    salaryOk: Number(salary) > RULES.familyVisa.minSalary,
    tenureOk: months >= RULES.familyVisa.minServiceMonths,
    monthsServed: Math.floor(months),
  };
}

/** شروط إصدار الإقامة — خلال 90 يوم من الدخول */
function iqamaDeadline(arrivalDate) {
  if (!arrivalDate) return null;
  const d = new Date(arrivalDate);
  d.setDate(d.getDate() + RULES.iqama.issueWithinDays);
  return d;
}

/** أهلية إجازة الحج */
function hajjEligible(hireDate, usedBefore = false) {
  return serviceYears(hireDate) >= RULES.hajj.minServiceYears && !usedBefore;
}

/** نطاقات — تصنيف تقريبي حسب نسبة التوطين */
function nitaqatBand(saudizationPct) {
  if (saudizationPct >= 40) return 'platinum';
  if (saudizationPct >= 30) return 'green_high';
  if (saudizationPct >= 22) return 'green_mid';
  if (saudizationPct >= 15) return 'green_low';
  if (saudizationPct >= 8) return 'yellow';
  return 'red';
}

module.exports = {
  RULES,
  serviceYears,
  annualEntitlement,
  annualAccrualMonthly,
  sickPayTier,
  isSaudi,
  gosiTier,
  gosiShares,
  lateDeduction,
  EOS_FULL_REASONS,
  EOS_ZERO_REASONS,
  calculateEOS,
  workPermitFee,
  familyVisaEligible,
  iqamaDeadline,
  hajjEligible,
  nitaqatBand,
};