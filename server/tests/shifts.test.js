/**
 * اختبارات محرك الورديات — الدوال المنطقية الخالصة (بلا قاعدة بيانات).
 * تشغيل: node tests/shifts.test.js
 */
const assert = require('assert');
const resolver = require('../src/utils/shiftResolver');

let passed = 0; let failed = 0;
function eq(name, actual, expected, tol = 0) {
  try {
    if (tol > 0) assert.ok(Math.abs(actual - expected) <= tol);
    else assert.deepStrictEqual(actual, expected);
    passed += 1;
  } catch (e) { failed += 1; console.error(`FAIL ${name}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`); }
}

// ===== أيام العمل حسب الوردية (0=الأحد..6=السبت) =====
const morning = { code: 'MORNING', startMin: 480, endMin: 960, graceInMins: 15, workDays: [0, 1, 2, 3, 4], weeklyHourCap: 45, earlyLeaveThresholdMins: 15, allowHolidayCheckIn: false };
eq('WD Sunday is work day', resolver.isWorkDay(morning, new Date('2026-09-06T00:00:00Z')), true);
eq('WD Friday not work day', resolver.isWorkDay(morning, new Date('2026-09-11T00:00:00Z')), false);
const custodial = { code: 'CUST', workDays: [5], startMin: 0, endMin: 480, graceInMins: 0 };
eq('WD Friday IS work day for Friday-shift', resolver.isWorkDay(custodial, new Date('2026-09-11T00:00:00Z')), true);

// ===== الحل بأولوية: موظف ← قسم ← فرع ← افتراضية =====
const eShift = { code: 'EVENING', startMin: 900, endMin: 1380, graceInMins: 15, workDays: [0, 1, 2, 3, 4] };
const dShift = { code: 'DEPT', startMin: 420, endMin: 900, graceInMins: 10, workDays: [0, 1, 2, 3, 4] };
const bShift = { code: 'BRANCH', startMin: 600, endMin: 1080, graceInMins: 20, workDays: [0, 1, 2, 3, 4] };
const d = new Date('2026-09-06T00:00:00Z');
const assignments = [
  { id: 1, scope: 'employee', refId: 'emp-1', startDate: d, endDate: null, shift: eShift },
  { id: 2, scope: 'department', refId: '9', startDate: d, endDate: null, shift: dShift },
  { id: 3, scope: 'branch', refId: '5', startDate: d, endDate: null, shift: bShift },
];
const emp1 = { id: 'emp-1', deptId: 9, branchId: 5 };
const emp2 = { id: 'emp-2', deptId: 9, branchId: 5 };
const emp3 = { id: 'emp-3', deptId: null, branchId: 5 };
const emp4 = { id: 'emp-4', deptId: null, branchId: null };

eq('PICK employee wins', resolver.pickForEmployee(emp1, assignments, d, null).shift.code, 'EVENING');
eq('PICK employee source', resolver.pickForEmployee(emp1, assignments, d, null).source, 'employee');
eq('PICK department second', resolver.pickForEmployee(emp2, assignments, d, null).shift.code, 'DEPT');
eq('PICK department source', resolver.pickForEmployee(emp2, assignments, d, null).source, 'department');
eq('PICK branch third', resolver.pickForEmployee(emp3, assignments, d, null).shift.code, 'BRANCH');
eq('PICK branch source', resolver.pickForEmployee(emp3, assignments, d, null).source, 'branch');
eq('PICK default last', resolver.pickForEmployee(emp4, assignments, d, null).shift.code, 'DEFAULT');
eq('PICK default source', resolver.pickForEmployee(emp4, assignments, d, null).source, 'default');

// ===== الوردية المنتهية لا تسري =====
const expired = [
  { id: 11, scope: 'employee', refId: 'emp-1', startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z'), shift: eShift },
];
eq('PICK expired assignment ignored', resolver.pickForEmployee(emp1, expired, d, null).shift.code, 'DEFAULT');

// ===== الوردية الأحدث تتفوق (القائمة من SQL مرتبة startDate desc — find يعيد الأولى) =====
const two = [
  { id: 22, scope: 'employee', refId: 'emp-1', startDate: new Date('2026-08-01T00:00:00Z'), endDate: null, shift: dShift },
  { id: 23, scope: 'employee', refId: 'emp-1', startDate: new Date('2026-09-01T00:00:00Z'), endDate: null, shift: eShift },
];
eq('PICK newest wins (desc order)', resolver.pickForEmployee(emp1, [two[1], two[0]], d, null).shift.code, 'EVENING');

// ===== رمضان: الشهر 9 الهجري يفعّل وردية رمضان تلقائياً =====
eq('HIJRI month type ok', typeof resolver.hijriMonth(new Date()), 'number');
eq('HIJRI valid range', resolver.hijriMonth(new Date()) >= 1 && resolver.hijriMonth(new Date()) <= 12, true);
const ramadanShift = { code: 'RAMADAN', startMin: 600, endMin: 840, graceInMins: 15, workDays: [0, 1, 2, 3, 4] };
const noAssignments = [];
eq('PICK ramadan auto when hijri=9', resolver.pickForEmployee(emp4, noAssignments, d, ramadanShift).shift.code === (resolver.hijriMonth(d) === 9 ? 'RAMADAN' : 'DEFAULT'), true);

// ===== الافتراضية من مركز المعايير (السماحية تتبع workHours.lateGraceMins القابلة للضبط) =====
const def = resolver.defaultShift();
eq('DEF code=DEFAULT', def.code, 'DEFAULT');
eq('DEF start=8h (480)', def.startMin, 480);
eq('DEF grace = policy value', def.graceInMins, Number(require('../src/utils/policyStore').get('workHours.lateGraceMins')));
eq('DEF workDays Sun..Thu', def.workDays, [0, 1, 2, 3, 4]);
eq('DEF no holiday check-in', def.allowHolidayCheckIn, false);

console.log(`\n===== ${passed} passed, ${failed} failed =====`);
if (failed > 0) process.exit(1);
