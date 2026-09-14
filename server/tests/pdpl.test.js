/**
 * اختبارات محرك PDPL النقي — مهل DSAR، نافذة سدايا، أهلية الإتلاف، انتقالات الحالة.
 * تشغيل: node tests/pdpl.test.js
 */
const assert = require('assert');
const {
  DSAR_TYPES, ERASURE_FIELDS,
  computeDsarDueDate, computeExtendedDue,
  dsarCanDecide, dsarCanExtend,
  breachSdaiaWindow, erasureEligibility,
} = require('../src/utils/pdpl');

let passed = 0; let failed = 0;
function eq(name, actual, expected, tol = 0.001) {
  const ok = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(actual - expected) <= tol
    : actual === expected;
  if (ok) { passed++; console.log(`PASS | ${name} | ${actual}`); }
  else { failed++; console.log(`FAIL | ${name} | got=${actual} expected=${expected}`); }
}

// ===== مهل DSAR (م12: 30 يوماً + تمديد 30) =====
const submitted = new Date('2026-09-14T10:00:00.000Z');
const due = computeDsarDueDate(submitted, 30);
eq('DSAR dueDate = +30 يوم', due.toISOString(), '2026-10-14T10:00:00.000Z');

const extended = computeExtendedDue(due, null, 30);
eq('DSAR extended من dueDate = +30', extended.toISOString(), '2026-11-13T10:00:00.000Z');

const extendedTwice = computeExtendedDue(due, extended, 30);
eq('DSAR تمديد ثانٍ يُبنى على أحدث مهلة', extendedTwice.toISOString(), '2026-12-13T10:00:00.000Z');

// معامل صفر → لا تغيير
eq('DSAR extensionDays=0 لا يمدد', computeExtendedDue(due, null, 0).getTime(), due.getTime());

// ===== أنواع الطلبات المدعومة =====
eq('DSAR أنواع = 4', DSAR_TYPES.length, 4);
eq('DSAR يحوي erasure', DSAR_TYPES.includes('erasure'), true);
eq('DSAR يحوي portable_copy', DSAR_TYPES.includes('portable_copy'), true);

// ===== انتقالات الحالة =====
eq('decide: submitted مسموح', dsarCanDecide('submitted'), true);
eq('decide: in_progress مسموح', dsarCanDecide('in_progress'), true);
eq('decide: extended مسموح', dsarCanDecide('extended'), true);
eq('decide: completed مرفوض', dsarCanDecide('completed'), false);
eq('decide: rejected مرفوض', dsarCanDecide('rejected'), false);

eq('extend: submitted مسموح', dsarCanExtend('submitted'), true);
eq('extend: extended مسموح', dsarCanExtend('extended'), true);
eq('extend: rejected مرفوض', dsarCanExtend('rejected'), false);
eq('extend: completed مرفوض', dsarCanExtend('completed'), false);

// ===== نافذة سدايا (72 ساعة) =====
const detected = new Date('2026-09-14T00:00:00.000Z');
const w1 = breachSdaiaWindow(detected, new Date('2026-09-14T12:00:00.000Z'), 72);
eq('سدايا deadline = +72 ساعة', w1.deadlineAt, '2026-09-17T00:00:00.000Z');
eq('سدايا متبقٍ 60 ساعة', w1.remainingHours, 60);
eq('سدايا غير متأخرة', w1.overdue, false);
eq('سدايا ليست عاجلة', w1.urgent, false);

const w2 = breachSdaiaWindow(detected, new Date('2026-09-17T01:00:00.000Z'), 72);
eq('سدايا متأخرة بعد انقضاء المهلة', w2.overdue, true);

const w3 = breachSdaiaWindow(detected, new Date('2026-09-17T00:00:00.000Z'), 72);
eq('سدايا الحد بالضبط ليس متأخراً', w3.overdue, false);

const w4 = breachSdaiaWindow(detected, new Date('2026-09-16T15:00:00.000Z'), 72);
eq('سدايا عاجلة (متبقٍ ≤ 12 ساعة)', w4.urgent, true);
eq('سدايا عاجلة متبقٍ 9 ساعات', w4.remainingHours, 9);

// معامل سياسة مختلف (48 ساعة) يُحترم
const w5 = breachSdaiaWindow(detected, new Date('2026-09-15T00:00:00.000Z'), 48);
eq('سدايا معامل 48 ساعة — متبقٍ 24', w5.remainingHours, 24);

// ===== أهلية الإتلاف (م10: استثناء الاحتفاظ النظامي) =====
const now = new Date('2026-09-14T00:00:00.000Z');

const e1 = erasureEligibility({ lastWorkingDate: null, hasFinancialRecords: false, now, personnelYears: 5, financialYears: 10 });
eq('إتلاف: موظف نشط مرفوض', e1.eligible, false);

const e2 = erasureEligibility({ lastWorkingDate: '2023-09-14', hasFinancialRecords: true, now, personnelYears: 5, financialYears: 10 });
eq('إتلاف: 3 سنوات + سجلات مالية (مطلوب 10) مرفوض', e2.eligible, false);

const e3 = erasureEligibility({ lastWorkingDate: '2015-09-14', hasFinancialRecords: true, now, personnelYears: 5, financialYears: 10 });
eq('إتلاف: 11 سنة + سجلات مالية (10) مسموح', e3.eligible, true);

const e4 = erasureEligibility({ lastWorkingDate: '2020-09-14', hasFinancialRecords: false, now, personnelYears: 5, financialYears: 10 });
eq('إتلاف: 6 سنوات بلا سجلات مالية (شخصية 5) مسموح', e4.eligible, true);

const e5 = erasureEligibility({ lastWorkingDate: '2024-09-14', hasFinancialRecords: false, now, personnelYears: 5, financialYears: 10 });
eq('إتلاف: سنتان بلا سجلات مالية مرفوض', e5.eligible, false);

eq('إتلاف: حقول المحو = 11 حقل شخصي', Object.keys(ERASURE_FIELDS).length, 11);
eq('إتلاف: الهوية ضمن حقول المحو', 'nationalId' in ERASURE_FIELDS, true);
eq('إتلاف: IBAN ضمن حقول المحو', 'iban' in ERASURE_FIELDS, true);

console.log(`\nPDPL tests: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
