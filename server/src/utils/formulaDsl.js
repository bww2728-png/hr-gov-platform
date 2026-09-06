/**
 * formulaDsl — مفسّر شجري آمن للمعادلات الهيكلية (بدون كود).
 * أنواع العقد:
 *  { t:'num', v }                          — ثابت رقمي
 *  { t:'var', k }                          — متغير مبيّض (من variablesJson فقط)
 *  { t:'op', op, args:[...] }              — add|sub|mul|div|pct|min|max|round|abs
 *  { t:'cmp', op, a, b }                   — lt|lte|gt|gte|eq (يُعاد 1/0)
 *  { t:'logic', op, args:[...] }           — and|or (تُعامل بقيم 1/0)
 *  { t:'if', cond, then, else }            — شرط
 * أمان: بدون eval/Function، قائمة عقد مبيّضة، حد عمق 24، أرقام منتهية فقط.
 */
const MAX_DEPTH = 24;

const OP_ARITY = { add: 2, sub: 2, mul: 2, div: 2, pct: 2, min: 2, max: 2, round: 1, abs: 1 };
const CMP_OPS = new Set(['lt', 'lte', 'gt', 'gte', 'eq']);

function assertNumber(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('قيمة رقمية غير صالحة في المعادلة');
  return n;
}

function evalNode(node, vars, depth = 0) {
  if (depth > MAX_DEPTH) throw new Error('عمق المعادلة يتجاوز الحد المسموح');
  if (node === null || node === undefined || typeof node !== 'object' || Array.isArray(node)) {
    throw new Error('عقدة معادلة غير صالحة');
  }
  const t = node.t;
  if (t === 'num') return assertNumber(Number(node.v));
  if (t === 'var') {
    if (typeof node.k !== 'string' || !(node.k in vars)) {
      throw new Error(`متغير غير مبيّض أو مفقود: ${node.k}`);
    }
    return assertNumber(Number(vars[node.k]));
  }
  if (t === 'op') {
    const op = node.op;
    if (!(op in OP_ARITY)) throw new Error(`عملية غير مدعومة: ${op}`);
    const args = Array.isArray(node.args) ? node.args : [];
    if (args.length !== OP_ARITY[op]) throw new Error(`عدد معاملات غير صحيح للعملية: ${op}`);
    const vals = args.map((a) => evalNode(a, vars, depth + 1));
    switch (op) {
      case 'add': return vals[0] + vals[1];
      case 'sub': return vals[0] - vals[1];
      case 'mul': return vals[0] * vals[1];
      case 'div': {
        if (vals[1] === 0) throw new Error('قسمة على صفر');
        return vals[0] / vals[1];
      }
      case 'pct': return (vals[0] * vals[1]) / 100; // النسبة: القيمة × النسبة المئوية
      case 'min': return Math.min(vals[0], vals[1]);
      case 'max': return Math.max(vals[0], vals[1]);
      case 'round': return Math.round((vals[0] + Number.EPSILON) * 100) / 100;
      case 'abs': return Math.abs(vals[0]);
      default: throw new Error(`عملية غير مدعومة: ${op}`);
    }
  }
  if (t === 'cmp') {
    if (!CMP_OPS.has(node.op)) throw new Error(`مقارنة غير مدعومة: ${node.op}`);
    const a = evalNode(node.a, vars, depth + 1);
    const b = evalNode(node.b, vars, depth + 1);
    const res = {
      lt: a < b, lte: a <= b, gt: a > b, gte: a >= b, eq: a === b,
    }[node.op];
    return res ? 1 : 0;
  }
  if (t === 'logic') {
    if (!['and', 'or'].includes(node.op)) throw new Error(`عملية منطقية غير مدعومة: ${node.op}`);
    const args = Array.isArray(node.args) ? node.args : [];
    if (args.length < 2) throw new Error('العملية المنطقية تحتاج معاملين على الأقل');
    const vals = args.map((a) => (evalNode(a, vars, depth + 1) ? 1 : 0));
    return node.op === 'and' ? (vals.every((v) => v === 1) ? 1 : 0) : (vals.some((v) => v === 1) ? 1 : 0);
  }
  if (t === 'if') {
    const cond = evalNode(node.cond, vars, depth + 1);
    return cond ? evalNode(node.then, vars, depth + 1) : evalNode(node.else, vars, depth + 1);
  }
  throw new Error(`نوع عقدة غير مدعوم: ${t}`);
}

/** تنفيذ شجرة معادلة على مدخلات مبيّضة، مع تقريب النتيجة النهائية لخانتين */
function evaluate(logicJson, variables = {}) {
  if (!logicJson || typeof logicJson !== 'object') throw new Error('شجرة المعادلة مفقودة');
  const allowed = new Set(Object.keys(variables || {}));
  // مبيّأة صارمة: لا يمكن استخدام متغير خارج القائمة المسموحة
  const guarded = {};
  for (const k of allowed) guarded[k] = variables[k];
  const result = evalNode(logicJson, guarded, 0);
  return Math.round((result + Number.EPSILON) * 100) / 100;
}

module.exports = { evaluate };
