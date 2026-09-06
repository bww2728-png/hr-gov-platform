/**
 * اختبارات مفسّر المعادلات الهيكلية الآمن (formulaDsl) — تشغيل مباشر: node tests/formulaDsl.test.js
 */
const assert = require('assert');
const { evaluate } = require('../src/utils/formulaDsl');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`PASS  ${name}`); }
  catch (e) { console.error(`FAIL  ${name}: ${e.message}`); process.exitCode = 1; }
}

// F06 نموذج نهاية الخدمة: 5 سنوات نصف شهر، الباقي شهر
const eosTree = {
  t: 'if',
  cond: { t: 'cmp', op: 'lte', a: { t: 'var', k: 'years' }, b: { t: 'num', v: 5 } },
  then: { t: 'op', op: 'round', args: [{ t: 'op', op: 'mul', args: [{ t: 'var', k: 'salary' }, { t: 'op', op: 'div', args: [{ t: 'var', k: 'years' }, { t: 'num', v: 2 }] }] }] },
  else: {
    t: 'op', op: 'round', args: [
      { t: 'op', op: 'add', args: [
        { t: 'op', op: 'mul', args: [{ t: 'var', k: 'salary' }, { t: 'num', v: 2.5 }] },
        { t: 'op', op: 'mul', args: [{ t: 'var', k: 'salary' }, { t: 'op', op: 'sub', args: [{ t: 'var', k: 'years' }, { t: 'num', v: 5 }] }] },
      ] },
    ],
  },
};

test('EOS: 3 سنوات ⇒ 7500', () => {
  assert.strictEqual(evaluate(eosTree, { years: 3, salary: 5000 }), 7500);
});
test('EOS: 12 سنة ⇒ 47500', () => {
  assert.strictEqual(evaluate(eosTree, { years: 12, salary: 5000 }), 47500);
});
test('النسبة: pct(10000, 9.75) = 975', () => {
  assert.strictEqual(evaluate({ t: 'op', op: 'pct', args: [{ t: 'var', k: 'base' }, { t: 'num', v: 9.75 }] }, { base: 10000 }), 975);
});
test('رفض متغير غير مبيّض', () => {
  assert.throws(() => evaluate({ t: 'var', k: 'evil' }, {}), /غير مبيّض/);
});
test('رفض نوع عقدة غير معروف', () => {
  assert.throws(() => evaluate({ t: 'eval', code: 'process.exit()' }, {}), /غير مدعوم/);
});
test('رفض قسمة على صفر', () => {
  assert.throws(() => evaluate({ t: 'op', op: 'div', args: [{ t: 'num', v: 1 }, { t: 'num', v: 0 }] }, {}), /صفر/);
});
test('رفض عمق مفرط', () => {
  let deep = { t: 'num', v: 1 };
  for (let i = 0; i < 40; i++) deep = { t: 'op', op: 'add', args: [deep, { t: 'num', v: 0 }] };
  assert.throws(() => evaluate(deep, {}), /الحد المسموح/);
});
test('min/max و AND/OR', () => {
  assert.strictEqual(evaluate({ t: 'op', op: 'min', args: [{ t: 'num', v: 3 }, { t: 'num', v: 7 }] }, {}), 3);
  assert.strictEqual(evaluate({ t: 'logic', op: 'and', args: [
    { t: 'cmp', op: 'gt', a: { t: 'num', v: 2 }, b: { t: 'num', v: 1 } },
    { t: 'cmp', op: 'eq', a: { t: 'num', v: 4 }, b: { t: 'num', v: 4 } },
  ] }, {}), 1);
});

console.log(`\n${passed} tests passed`);
