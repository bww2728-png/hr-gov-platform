/**
 * محرك قواعد نظام العمل السعودي
 * كل القواعد قابلة للتعديل عبر الإعدادات/قاعدة البيانات — القيم الافتراضية حسب
 * نظام العمل السعودي ومخططات المعاملات (الملف المرجعي).
 */

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
  // العمل الإضافي (معاملة 27)
  overtime: { yearCapHours: 720, multiplier: 1.5 },
  // التأمينات الاجتماعية GOSI (معاملة 17, 50)
  gosi: { employeePct: 9.75, employerPct: 11.75 },
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
 * حساب مكافأة نهاية الخدمة — صيغة المعاملة 56:
 * استقالة: <2 = 0 | 2-5 = نصف شهر×السنوات | 5-10 = نصف×5 + شهر×الباقي | >10 = نصف×5 + شهر×5 + 1.5×الباقي
 * إنهاء مشروع: <2 = 0 | 2-5 = نصف×السنوات | >5 = شهر×السنوات
 * تقاعد: استحقاق كامل (نصف×5 + شهر×الباقي)
 */
function calculateEOS({ hireDate, endDate = new Date(), lastSalary, reason, years: yearsInput }) {
  const years = yearsInput !== undefined ? Number(yearsInput) : serviceYears(hireDate, endDate);
  const salary = Number(lastSalary) || 0;
  const half = salary / 2;
  let eos = 0;
  const breakdown = { years, reason, segments: [] };

  if (reason === 'resignation') {
    if (years < 2) { eos = 0; breakdown.segments.push({ note: 'أقل من سنتين — لا استحقاق', amount: 0 }); }
    else if (years < 5) { eos = half * years; breakdown.segments.push({ note: `نصف شهر × ${years} سنة`, amount: eos }); }
    else if (years <= 10) {
      const s1 = half * 5; const s2 = salary * (years - 5);
      eos = s1 + s2;
      breakdown.segments.push({ note: 'نصف شهر × 5 سنوات', amount: s1 }, { note: `شهر × ${+(years - 5).toFixed(2)}`, amount: s2 });
    } else {
      const s1 = half * 5; const s2 = salary * 5; const s3 = salary * 1.5 * (years - 10);
      eos = s1 + s2 + s3;
      breakdown.segments.push({ note: 'نصف شهر × 5', amount: s1 }, { note: 'شهر × 5', amount: s2 }, { note: `1.5 شهر × ${+(years - 10).toFixed(2)}`, amount: s3 });
    }
  } else if (reason === 'termination') {
    if (years < 2) { eos = 0; breakdown.segments.push({ note: 'أقل من سنتين — لا استحقاق', amount: 0 }); }
    else if (years <= 5) { eos = half * years; breakdown.segments.push({ note: `نصف شهر × ${years} سنة`, amount: eos }); }
    else {
      const s1 = half * 5; const s2 = salary * (years - 5);
      eos = s1 + s2;
      breakdown.segments.push({ note: 'نصف شهر × 5 سنوات', amount: s1 }, { note: `شهر × ${+(years - 5).toFixed(2)}`, amount: s2 });
    }
  } else { // retirement — استحقاق كامل
    const first5 = Math.min(years, 5);
    const rest = Math.max(0, years - 5);
    const s1 = half * first5; const s2 = salary * rest;
    eos = s1 + s2;
    breakdown.segments.push({ note: `نصف شهر × ${first5} سنوات`, amount: s1 }, { note: `شهر × ${+rest.toFixed(2)}`, amount: s2 });
  }

  breakdown.eosAmount = Math.round(eos * 100) / 100;
  return breakdown;
}

/** حساب حصص GOSI */
function gosiShares(salaryBase) {
  const base = Number(salaryBase) || 0;
  return {
    employee: Math.round(base * RULES.gosi.employeePct) / 100,
    employer: Math.round(base * RULES.gosi.employerPct) / 100,
  };
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
  calculateEOS,
  gosiShares,
  workPermitFee,
  familyVisaEligible,
  iqamaDeadline,
  hajjEligible,
  nitaqatBand,
};