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
  // ==== P0-02: التأمينات المتدرجة (المسجل بعد 3 يوليو 2024 يتدرج حتى يوليو 2028) ====
  'gosi.old.employeePct': 9.75,      // مسجل قبل 3 يوليو 2024
  'gosi.old.employerPct': 11.75,
  'gosi.y2025.employeePct': 10.25,
  'gosi.y2025.employerPct': 12.25,
  'gosi.y2026.employeePct': 10.75,   // السارية حالياً (2026)
  'gosi.y2026.employerPct': 12.75,
  'gosi.y2027.employeePct': 11.25,
  'gosi.y2027.employerPct': 13.25,
  'gosi.y2028.employeePct': 11.75,
  'gosi.y2028.employerPct': 13.75,
  'gosi.expat.employerPct': 2,       // الوافد: أخطار مهنية فقط
  'gosi.wageFloor': 1500,
  'gosi.wageCap': 45000,
  // ==== P0-08: عداد الخصم النقدي ====
  'payroll.hourlyDivisor': 240,
  'attendance.lateDeductionMultiplier': 1.5,
  // ==== P0-10: عقود مرنة/جزئية ====
  'flexible.maxMonthlyHours': 95,    // تعارض موثق: صفحة HRSD الرسمية 160 — قابل للضبط
  'flexible.hourlyMinWage': 20,
  // ==== P0-04: حماية الأجور (مواعيد قابلة للضبط — المصادر تختلف 7/10) ====
  'wps.payByDay': 7,
  'wps.uploadByDay': 10,
  // ==== P0-06: PDPL ====
  'dsar.responseDays': 30,
  'dsar.extensionDays': 30,
  'breach.sdaiaHours': 72,
  'retention.personnelYears': 5,
  'retention.financialYears': 10,
  'retention.candidateMonths': 6,
  // ==== P1-01: نطاقات المطور — ثوابت المعادلة حسب النشاط تُدخل إدارياً ====
  'nitaqat.lnM': 0,
  'nitaqat.lnC': 0,
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
    // ==== P0-02: التأمينات المتدرجة ====
    { code: 'gosi.old.employeePct', category: 'gosi', nameAr: 'GOSI موظف — مسجل قبل 3 يوليو 2024', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.old.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — مسجل قبل 3 يوليو 2024', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2025.employeePct', category: 'gosi', nameAr: 'GOSI موظف — نظام 2025', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2025.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — نظام 2025', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2026.employeePct', category: 'gosi', nameAr: 'GOSI موظف — نظام 2026 (السارية)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2026.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — نظام 2026 (السارية)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2027.employeePct', category: 'gosi', nameAr: 'GOSI موظف — نظام 2027', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2027.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — نظام 2027', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2028.employeePct', category: 'gosi', nameAr: 'GOSI موظف — نظام 2028 (النهائية)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.y2028.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — نظام 2028 (النهائية)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.expat.employerPct', category: 'gosi', nameAr: 'GOSI صاحب عمل — وافد (أخطار مهنية فقط)', valueType: 'percent', unitAr: '%', minValue: 0, maxValue: 50, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.wageFloor', category: 'gosi', nameAr: 'أدنى أجر خاضع للاشتراك', valueType: 'number', unitAr: 'ريال', minValue: 0, maxValue: 10000, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'gosi.wageCap', category: 'gosi', nameAr: 'سقف الأجر الخاضع للاشتراك', valueType: 'number', unitAr: 'ريال', minValue: 1000, maxValue: 100000, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    // ==== P0-08: عداد الخصم النقدي ====
    { code: 'payroll.hourlyDivisor', category: 'payroll', nameAr: 'مقسوم أجر الساعة (الأساسي ÷ المقسوم)', valueType: 'number', unitAr: 'ساعة', minValue: 120, maxValue: 480, ownerRoles: ['hr_director', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'attendance.lateDeductionMultiplier', category: 'attendance', nameAr: 'معامل خصم التأخر النقدي', valueType: 'number', unitAr: '×', minValue: 0, maxValue: 3, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    // ==== P0-10: عقود مرنة/جزئية ====
    { code: 'flexible.maxMonthlyHours', category: 'flexible', nameAr: 'سقف ساعات العمل المرن شهرياً (HRSD الرسمية: 160)', valueType: 'hours', unitAr: 'ساعة', minValue: 40, maxValue: 200, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'flexible.hourlyMinWage', category: 'flexible', nameAr: 'الحد الأدنى لأجر ساعة العمل المرن', valueType: 'number', unitAr: 'ريال', minValue: 10, maxValue: 50, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    // ==== P0-04: حماية الأجور ====
    { code: 'wps.payByDay', category: 'wps', nameAr: 'آخر يوم صرف الرواتب (من الشهر التالي)', valueType: 'number', unitAr: 'يوم', minValue: 1, maxValue: 28, ownerRoles: ['finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'wps.uploadByDay', category: 'wps', nameAr: 'آخر يوم رفع ملف حماية الأجور (من الشهر التالي)', valueType: 'number', unitAr: 'يوم', minValue: 1, maxValue: 28, ownerRoles: ['finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    // ==== P0-06: PDPL ====
    { code: 'dsar.responseDays', category: 'pdpl', nameAr: 'مدة الاستجابة لطلبات أصحاب البيانات', valueType: 'number', unitAr: 'يوم', minValue: 5, maxValue: 90, ownerRoles: ['dpo'], approverRoles: ['dpo', 'ceo'], requiresApproval: true },
    { code: 'dsar.extensionDays', category: 'pdpl', nameAr: 'أقصى تمديد للاستجابة (بإشعار مسبب)', valueType: 'number', unitAr: 'يوم', minValue: 0, maxValue: 60, ownerRoles: ['dpo'], approverRoles: ['dpo', 'ceo'], requiresApproval: true },
    { code: 'breach.sdaiaHours', category: 'pdpl', nameAr: 'مهلة الإبلاغ لسدايا عن تسرب البيانات', valueType: 'number', unitAr: 'ساعة', minValue: 24, maxValue: 168, ownerRoles: ['dpo'], approverRoles: ['dpo', 'ceo'], requiresApproval: true },
    { code: 'retention.personnelYears', category: 'pdpl', nameAr: 'احتفاظ بيانات الموظفين بعد انتهاء العلاقة', valueType: 'number', unitAr: 'سنة', minValue: 1, maxValue: 15, ownerRoles: ['dpo'], approverRoles: ['dpo', 'ceo'], requiresApproval: true },
    { code: 'retention.financialYears', category: 'pdpl', nameAr: 'احتفاظ البيانات المالية والرواتب', valueType: 'number', unitAr: 'سنة', minValue: 5, maxValue: 20, ownerRoles: ['dpo', 'finance_manager'], approverRoles: ['finance_manager', 'ceo'], requiresApproval: true },
    { code: 'retention.candidateMonths', category: 'pdpl', nameAr: 'احتفاظ بيانات المرشحين غير المقبولين', valueType: 'number', unitAr: 'شهر', minValue: 1, maxValue: 24, ownerRoles: ['dpo'], approverRoles: ['dpo', 'ceo'], requiresApproval: true },
    // ==== P1-01: نطاقات المطور ====
    { code: 'nitaqat.lnM', category: 'nitaqat', nameAr: 'ثابت m في معادلة نطاقات (y = m·ln(n)+c) — حسب النشاط من الدليل الإجرائي', valueType: 'number', unitAr: '', minValue: -50, maxValue: 50, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
    { code: 'nitaqat.lnC', category: 'nitaqat', nameAr: 'ثابت c في معادلة نطاقات — حسب النشاط من الدليل الإجرائي', valueType: 'number', unitAr: '', minValue: -50, maxValue: 50, ownerRoles: ['hr_director'], approverRoles: ['hr_director', 'ceo'], requiresApproval: true },
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
