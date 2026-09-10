/**
 * policyStore — مخزن معايير السياسات اللحظي.
 * يحمّل معايير السياسات من قاعدة البيانات إلى الذاكرة، وينعكس أي تعديل معتمد
 * فوراً بدون إعادة نشر (refresh عند apply + بث Socket.IO + endpoint يدوي للنظام).
 * القيم الافتراضية (SEED) مطابقة لسعودي رولز — تُستخدم احتياطاً فقط عند غياب المعامل.
 */
const prisma = require('../prisma');

const SEED_DEFAULTS = {
  // التأمينات الاجتماعية (مالية — تُثبّت snapshot على المسير)
  'gosi.employeePct': 9.75,
  'gosi.employerPct': 11.75,
  // العمل الإضافي (مالية)
  'overtime.multiplier': 1.5,
  'overtime.yearCapHours': 720,
  // خصم الغياب: معدل اليوم = الأساسي ÷ المقسوم
  'absence.dailyDivisor': 30,
  // ساعات الدوام
  'workHours.weeklyLimit': 45,
  'workHours.ramadanDailyHours': 6,
  'workHours.startHour': 8,
  'workHours.endHour': 17,
  'workHours.lateGraceMins': 0,
  'workHours.absenceAfterHours': 4,
};

const FINANCIAL_CODES = ['gosi.employeePct', 'gosi.employerPct', 'overtime.multiplier', 'absence.dailyDivisor'];

let cache = new Map(); // code -> { value, version, effectiveFrom }
let loadedAt = 0;
let loading = null;

/** زرع المعاملات الافتراضية الناقصة (idempotent لكل كود) */
async function ensureSeeded() {
  const defs = [
    { code: 'gosi.employeePct', category: 'gosi', nameAr: 'نسبة استقطاع المؤمن عليه (GOSI)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.employerPct', category: 'gosi', nameAr: 'نسبة حصة صاحب العمل (GOSI)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'overtime.multiplier', category: 'overtime', nameAr: 'معامل أجر العمل الإضافي', valueType: 'number', unitAr: '×', minValue: 1, maxValue: 3, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'overtime.yearCapHours', category: 'overtime', nameAr: 'سقف ساعات الإضافي سنوياً', valueType: 'hours', unitAr: 'ساعة', minValue: 0, maxValue: 2000, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'absence.dailyDivisor', category: 'absence', nameAr: 'مقسوم معدل يوم الغياب', valueType: 'number', unitAr: 'يوم', minValue: 20, maxValue: 40, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'workHours.weeklyLimit', category: 'workHours', nameAr: 'حد ساعات الدوام الأسبوعي', valueType: 'hours', unitAr: 'ساعة', minValue: 30, maxValue: 48, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'workHours.ramadanDailyHours', category: 'workHours', nameAr: 'ساعات العمل اليومية في رمضان', valueType: 'hours', unitAr: 'ساعة', minValue: 4, maxValue: 8, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'workHours.startHour', category: 'workHours', nameAr: 'ساعة بداية الدوام اليومي', valueType: 'number', unitAr: 'ساعة', minValue: 0, maxValue: 23, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'workHours.endHour', category: 'workHours', nameAr: 'ساعة نهاية الدوام اليومي', valueType: 'number', unitAr: 'ساعة', minValue: 0, maxValue: 23, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'workHours.lateGraceMins', category: 'workHours', nameAr: 'سماحية التأخير (دقائق)', valueType: 'number', unitAr: 'دقيقة', minValue: 0, maxValue: 120, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'workHours.absenceAfterHours', category: 'workHours', nameAr: 'ساعة كشف الغياب التلقائي (بعد بداية الدوام) — صفر يعطّل الكشف', valueType: 'number', unitAr: 'ساعة', minValue: 0, maxValue: 12, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
  ];
  // زرع المعاملات الناقصة فقط (idempotent) — يعمل مع قاعدة بيانات موجودة
  let created = 0;
  for (const def of defs) {
    const exists = await prisma.policyParameter.findUnique({ where: { code: def.code }, select: { code: true } });
    if (exists) continue;
    await prisma.policyParameter.create({ data: { ...def } });
    await prisma.policyParameterVersion.create({
      data: {
        parameterCode: def.code,
        version: 1,
        valueJson: SEED_DEFAULTS[def.code],
        effectiveFrom: new Date(0),
        reason: 'تهيئة أولية من قيم نظام العمل السعودي المدمجة',
        createdBy: 'system-seed',
      },
    });
    created += 1;
  }
  return created;
}

/** تحميل/إعادة تحميل الكاش من قاعدة البيانات */
async function load() {
  if (!loading) {
    loading = (async () => {
      await ensureSeeded();
      const params = await prisma.policyParameter.findMany({
        where: { isActive: true },
        include: { versions: { orderBy: { version: 'desc' } } },
      });
      const now = new Date();
      const next = new Map();
      for (const p of params) {
        const v = p.versions.find((x) => new Date(x.effectiveFrom) <= now);
        if (v) next.set(p.code, { value: v.valueJson, version: v.version, effectiveFrom: v.effectiveFrom });
      }
      cache = next;
      loadedAt = Date.now();
    })().finally(() => { loading = null; });
  }
  return loading;
}

/** قراءة متزامنة (بعد التحميل) مع احتياطي الافتراضي */
function get(code) {
  const hit = cache.get(code);
  if (hit !== undefined) return hit.value;
  if (code in SEED_DEFAULTS) return SEED_DEFAULTS[code];
  return undefined;
}

/** snapshot للمعاملات المالية عند نقطة زمنية — يُثبّت على المسير لإعادة الإنتاج */
async function snapshot(anchor = new Date()) {
  const codes = Object.keys(SEED_DEFAULTS);
  const params = await prisma.policyParameter.findMany({
    where: { code: { in: codes }, isActive: true },
    include: { versions: { where: { effectiveFrom: { lte: anchor } }, orderBy: { version: 'desc' } } },
  });
  const out = { anchor: anchor.toISOString(), values: {} };
  for (const code of codes) {
    const p = params.find((x) => x.code === code);
    const v = p?.versions?.[0];
    out.values[code] = {
      value: v ? v.valueJson : SEED_DEFAULTS[code],
      version: v ? v.version : 0,
      source: v ? 'db' : 'seed',
    };
  }
  return out;
}

function valueFrom(snap, code) {
  return snap?.values?.[code]?.value ?? SEED_DEFAULTS[code];
}

module.exports = { load, get, snapshot, valueFrom, SEED_DEFAULTS, FINANCIAL_CODES };
