/**
 * اختبارات المحرك المالي القانوني — تطابق أمثلة المواصفة التنفيذية حرفياً.
 * تشغيل: node tests/finance.test.js
 */
const assert = require('assert');
const saudi = require('../src/utils/saudiRules');

let passed = 0; let failed = 0;
function eq(name, actual, expected, tol = 0.001) {
  const ok = typeof expected === 'number' ? Math.abs(actual - expected) <= tol : actual === expected;
  if (ok) { passed++; console.log(`PASS | ${name} | ${actual}`); }
  else { failed++; console.log(`FAIL | ${name} | got=${actual} expected=${expected}`); }
}

// ===== GOSI المتدرج (P0-02) =====
// مثال 1: سعودي مسجل 2026، أساسي 5000 + سكن 1500 → خاضع 6500، موظف 10.75% = 698.75، منشأة 12.75% = 828.75
const t1 = saudi.gosiTier({ nationality: 'سعودي', gosiRegistrationDate: '2025-01-01', basicSalary: 5000, housingAllowance: 1500, month: { year: 2026 } });
eq('GOSI-1 wage=6500', t1.wage, 6500);
eq('GOSI-1 employeePct=10.75', t1.employeePct, 10.75);
eq('GOSI-1 employerPct=12.75', t1.employerPct, 12.75);
eq('GOSI-1 employee=698.75', t1.employee, 698.75);
eq('GOSI-1 employer=828.75', t1.employer, 828.75);
eq('GOSI-1 tier=y2026', t1.tier, 'y2026');

// مثال 2: وافد براتب 8000 → موظف 0، منشأة 2% = 160
const t2 = saudi.gosiTier({ nationality: 'هندي', basicSalary: 8000, housingAllowance: 0, month: { year: 2026 } });
eq('GOSI-2 expat employee=0', t2.employee, 0);
eq('GOSI-2 expat employer=160', t2.employer, 160);
eq('GOSI-2 tier=expat', t2.tier, 'expat');

// مثال 3: سقف — أساسي 50000 → الاشتراك على 45000 فقط
const t3 = saudi.gosiTier({ nationality: 'سعودي', gosiRegistrationDate: '2025-06-01', basicSalary: 50000, housingAllowance: 10000, month: { year: 2026 } });
eq('GOSI-3 cap wage=45000', t3.wage, 45000);
eq('GOSI-3 clamped', t3.clamped, true);

// مثال 4: أرضية — أساسي 800 → خاضع 1500
const t4 = saudi.gosiTier({ nationality: 'سعودي', gosiRegistrationDate: '2025-06-01', basicSalary: 800, housingAllowance: 0, month: { year: 2026 } });
eq('GOSI-4 floor wage=1500', t4.wage, 1500);

// مثال 5: مسجل قبل 3 يوليو 2024 → 9.75/11.75
const t5 = saudi.gosiTier({ nationality: 'سعودي', gosiRegistrationDate: '2020-01-01', basicSalary: 5000, housingAllowance: 1500, month: { year: 2026 } });
eq('GOSI-5 old employeePct=9.75', t5.employeePct, 9.75);
eq('GOSI-5 old employerPct=11.75', t5.employerPct, 11.75);

// مثال 6: تدرج مستقبلي — 2028 → 11.75/13.75
const t6 = saudi.gosiTier({ nationality: 'سعودي', gosiRegistrationDate: '2025-06-01', basicSalary: 5000, housingAllowance: 1500, month: { year: 2028 } });
eq('GOSI-6 y2028 employeePct=11.75', t6.employeePct, 11.75);
eq('GOSI-6 y2028 employerPct=13.75', t6.employerPct, 13.75);

// مثال 7: سعودي بلا تاريخ تسجيل → قديم + علم تصحيح البيانات
const t7 = saudi.gosiTier({ nationality: 'سعودي', basicSalary: 5000, housingAllowance: 1500, month: { year: 2026 } });
eq('GOSI-7 no-reg falls to legacy', t7.tier, 'legacy_unknown_reg_date');
eq('GOSI-7 flag=true', t7.needsRegistrationDate, true);

// ===== نهاية الخدمة (P0-03) =====
// مثال A (مواصفة): 5.5 سنة، أجر 7000، استقالة → gross 21,000
// ملاحظة موثقة: مثال القبول في المواصفة طبّق "الثلث" على 5.5 سنة، لكن جدول م85
// في المواصفة نفسها (5 إلى أقل من 10 = ثلثان) والقانون السعودي يعطيان ثلثين = 14,000.
// المحرك يتبع جدول م85 القانوني — لا المثال المتناقض داخلياً.
const a = saudi.calculateEOS({ years: 5.5, wage: 7000, reason: 'resignation' });
eq('EOS-A gross=21000', a.gross, 21000);
eq('EOS-A ratio=2/3 (م85: 5-<10)', a.ratio, 2 / 3, 0.0001);
eq('EOS-A net=14000', a.eosAmount, 14000, 0.01);

// مثال B (مواصفة): 7 سنوات، أجر 8000، استقالة → gross 36,000 → ثلثان = 24,000
const b = saudi.calculateEOS({ years: 7, wage: 8000, reason: 'resignation' });
eq('EOS-B gross=36000', b.gross, 36000);
eq('EOS-B net=24000', b.eosAmount, 24000, 0.01);

// مثال C: نفس الحالة إنهاء من صاحب العمل → كامل 36,000
const c = saudi.calculateEOS({ years: 7, wage: 8000, reason: 'termination' });
eq('EOS-C termination full=36000', c.eosAmount, 36000, 0.01);

// مثال D: استقالة <2 سنة → صفر
const d = saudi.calculateEOS({ years: 1.5, wage: 8000, reason: 'resignation' });
eq('EOS-D resignation<2 = 0', d.eosAmount, 0);

// مثال E: 10+ سنوات استقالة → كامل المكافأة (م84: 5×4000 + 7×8000)
const e = saudi.calculateEOS({ years: 12, wage: 8000, reason: 'resignation' });
eq('EOS-E resignation>=10 full=76000', e.eosAmount, 76000, 0.01);
eq('EOS-E ratio=1 (full)', e.ratio, 1, 0.0001);

// مثال F: فصل م80 → صفر
const f = saudi.calculateEOS({ years: 12, wage: 8000, reason: 'article80' });
eq('EOS-F article80 = 0', f.eosAmount, 0);

// مثال G: انتهاء عقد محدد → كامل
const g = saudi.calculateEOS({ years: 3, wage: 6000, reason: 'end_fixed_contract' });
eq('EOS-G fixed-contract full=9000', g.eosAmount, 9000, 0.01);

// مثال H: كسور — 2.4 سنة استقالة → gross=(0.5×2.4)×8000=9600، ثلث=3200
const h = saudi.calculateEOS({ years: 2.4, wage: 8000, reason: 'resignation' });
eq('EOS-H prorated gross=9600', h.gross, 9600, 0.01);
eq('EOS-H net=3200', h.eosAmount, 3200, 0.01);

// توافق التوافقية القديمة: {lastSalary, years, reason:'termination'} (F06 formula)
const compat = saudi.calculateEOS({ lastSalary: 5000, years: 3, reason: 'termination' });
eq('EOS-compat F06 = 7500', compat.eosAmount, 7500, 0.01);

// ===== عداد الخصم النقدي (P0-08) =====
// مثال المواصفة: 15 دقيقة تأخر فعلي، راتب 6000، معامل 1.5 → 9.375
eq('DED 15min×25×1.5=9.375', saudi.lateDeduction(15, 6000, 1.5, 240), 9.375, 0.0001);
eq('DED zero mins = 0', saudi.lateDeduction(0, 6000, 1.5), 0);
eq('DED custom divisor', saudi.lateDeduction(60, 4800, 1, 200), 24, 0.0001);

// حساب السنوات من التواريخ (نهاية خدمة صريحة)
const yrs = saudi.calculateEOS({ hireDate: '2019-03-10', endDate: '2026-06-10', wage: 7000, reason: 'resignation' });
eq('EOS-dateYears≈7.25 ratio=2/3', yrs.ratio, 2 / 3, 0.0001);

// ===== كشف الجنسية ISO (انحدار حي: البيانات تخزن 'SAU' وليس 'saudi') =====
eq('NAT SAU isSaudi', saudi.isSaudi('SAU'), true);
eq('NAT saudi-arabia isSaudi', saudi.isSaudi('saudi arabia'), true);
eq('NAT arabic isSaudi', saudi.isSaudi('سعودي'), true);
eq('NAT EGY not saudi', saudi.isSaudi('EGY'), false);
eq('NAT residentType wins (saudi)', saudi.isSaudi('EGY', 'saudi'), true);
eq('NAT residentType wins (expat)', saudi.isSaudi('SAU', 'expat'), false);

// تدرج GOSI عبر ISO: سعودي SAU مسجل قبل يوليو 2024 → القديم 9.75/11.75
const tIso = saudi.gosiTier({ nationality: 'SAU', gosiRegistrationDate: '2020-01-01', basicSalary: 6000, housingAllowance: 500, month: { year: 2026, month: 9 } });
eq('NAT SAU tier=pre_jul2024', tIso.tier, 'pre_jul2024');
eq('NAT SAU pct 9.75/11.75', tIso.employeePct + '/' + tIso.employerPct, '9.75/11.75');
// وافد SAU-residentType=expat → 0/2
const tExp = saudi.gosiTier({ nationality: 'SAU', residentType: 'expat', basicSalary: 6000, housingAllowance: 500, month: { year: 2026, month: 9 } });
eq('NAT expat override 0/2', tExp.tier, 'expat');
eq('NAT expat employer=2%', tExp.employerPct, 2, 0.0001);

console.log(`\n===== ${passed} passed, ${failed} failed =====`);
if (failed > 0) process.exit(1);
