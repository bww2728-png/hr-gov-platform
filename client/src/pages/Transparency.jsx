import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

// سجل المعادلات الـ 32 (نسخة منفردة للواجهة — لا تعتمد على الباك إند كي تعمل دائماً)
const FORMULAS = [
  // ===== 1) حسابات الرواتب (13) F01-F13 =====
  { code: 'F01', cat: 'salary', nameAr: 'إجمالي الراتب', expr: 'إجمالي الراتب = الأساسي + بدل السكن + بدل النقل + بدلات أخرى',
    vars: [{ k: 'basic', label: 'الراتب الأساسي' }, { k: 'housing', label: 'بدل السكن' }, { k: 'transport', label: 'بدل النقل' }, { k: 'other', label: 'بدلات أخرى' }],
    calc: ({ basic=0, housing=0, transport=0, other=0 }) => (+basic) + (+housing) + (+transport) + (+other),
    owner: 'محاسب الرواتب', approver: 'مدير HR + المدير المالي', src: 'ملف سياسات الرواتب' },
  { code: 'F02', cat: 'salary', nameAr: 'صافي الراتب', expr: 'صافي الراتب = الإجمالي − الخصومات − التأمينات − السلف',
    vars: [{ k: 'gross', label: 'الإجمالي' }, { k: 'deductions', label: 'الخصومات' }, { k: 'gosi', label: 'التأمينات (حصة الموظف)' }, { k: 'loans', label: 'أقساط السلف' }],
    calc: ({ gross=0, deductions=0, gosi=0, loans=0 }) => (+gross) - (+deductions) - (+gosi) - (+loans),
    owner: 'محاسب الرواتب', approver: 'مدير HR + المدير المالي', src: 'نظام العمل السعودي' },
  { code: 'F03', cat: 'salary', nameAr: 'الراتب بعد الاستقطاع', expr: 'الراتب بعد الاستقطاع = الصافي − خصومات خاصة (تأخر/غياب)',
    vars: [{ k: 'net', label: 'الصافي' }, { k: 'special', label: 'خصومات خاصة' }],
    calc: ({ net=0, special=0 }) => (+net) - (+special),
    owner: 'محاسب الرواتب', approver: 'مدير HR', src: 'سياسة الشركة' },
  { code: 'F04', cat: 'salary', nameAr: 'العمل الإضافي بالنهار (150%)', expr: 'العمل النهاري = (الراتب / 30 / 8) × ساعات × 1.5',
    vars: [{ k: 'salary', label: 'الراتب' }, { k: 'hours', label: 'ساعات العمل الإضافي' }],
    calc: ({ salary=0, hours=0 }) => ((+salary) / 30 / 8) * (+hours) * 1.5,
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'نظام العمل السعودي مادة 107' },
  { code: 'F05', cat: 'salary', nameAr: 'العمل الإضافي بالليل (200%)', expr: 'العمل الليلي = (الراتب / 30 / 8) × ساعات × 2.0',
    vars: [{ k: 'salary', label: 'الراتب' }, { k: 'hours', label: 'ساعات العمل الليلي' }],
    calc: ({ salary=0, hours=0 }) => ((+salary) / 30 / 8) * (+hours) * 2.0,
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'نظام العمل السعودي مادة 107' },
  { code: 'F06', cat: 'salary', nameAr: 'تكلفة الموظف', expr: 'تكلفة الموظف = الراتب + التأمينات (حصة صاحب العمل) + بدلات + إجازات + تدريب',
    vars: [{ k: 'salary', label: 'الراتب' }, { k: 'gosiEmployer', label: 'التأمينات (صاحب العمل)' }, { k: 'benefits', label: 'بدلات' }, { k: 'leave', label: 'إجازات' }, { k: 'training', label: 'تدريب' }],
    calc: ({ salary=0, gosiEmployer=0, benefits=0, leave=0, training=0 }) => (+salary) + (+gosiEmployer) + (+benefits) + (+leave) + (+training),
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'ميزانية الشركة' },
  { code: 'F07', cat: 'salary', nameAr: 'GOSI الموظف (9.75%)', expr: 'حصة الموظف = الأساس × 9.75%',
    vars: [{ k: 'base', label: 'الراتب الأساسي' }],
    calc: ({ base=0 }) => (+base) * 0.0975,
    owner: 'محاسب الرواتب', approver: 'مدير HR', src: 'نظام التأمينات الاجتماعية' },
  { code: 'F08', cat: 'salary', nameAr: 'GOSI صاحب العمل (11.75%)', expr: 'حصة صاحب العمل = الأساس × 11.75%',
    vars: [{ k: 'base', label: 'الراتب الأساسي' }],
    calc: ({ base=0 }) => (+base) * 0.1175,
    owner: 'محاسب الرواتب', approver: 'مدير HR', src: 'نظام التأمينات الاجتماعية' },
  { code: 'F09', cat: 'salary', nameAr: 'بدل السكن (25%)', expr: 'بدل السكن = الراتب × 25%',
    vars: [{ k: 'salary', label: 'الراتب' }],
    calc: ({ salary=0 }) => (+salary) * 0.25,
    owner: 'مدير النظام', approver: 'مدير HR + المالي', src: 'سياسة الشركة' },
  { code: 'F10', cat: 'salary', nameAr: 'بدل النقل (10%)', expr: 'بدل النقل = الراتب × 10%',
    vars: [{ k: 'salary', label: 'الراتب' }],
    calc: ({ salary=0 }) => (+salary) * 0.10,
    owner: 'مدير النظام', approver: 'مدير HR + المالي', src: 'سياسة الشركة' },
  { code: 'F11', cat: 'salary', nameAr: 'بدل طبيعة عمل', expr: 'بدل طبيعة العمل = مبلغ ثابت حسب الوظيفة',
    vars: [{ k: 'amount', label: 'مبلغ البدل' }],
    calc: ({ amount=0 }) => +amount,
    owner: 'مدير النظام', approver: 'مدير HR + المالي', src: 'هيكل الرواتب' },
  { code: 'F12', cat: 'salary', nameAr: 'خصم تأخر (نصف يوم)', expr: 'خصم التأخر = (الراتب / 30) × 0.5 × دقائق / 240',
    vars: [{ k: 'salary', label: 'الراتب' }, { k: 'minutes', label: 'دقائق التأخر' }],
    calc: ({ salary=0, minutes=0 }) => ((+salary) / 30) * 0.5 * ((+minutes) / 240),
    owner: 'محاسب الرواتب', approver: 'مدير HR', src: 'سياسة الشركة' },
  { code: 'F13', cat: 'salary', nameAr: 'خصم غياب يوم كامل', expr: 'خصم الغياب = الراتب / 30 × أيام الغياب',
    vars: [{ k: 'salary', label: 'الراتب' }, { k: 'days', label: 'أيام الغياب' }],
    calc: ({ salary=0, days=0 }) => ((+salary) / 30) * (+days),
    owner: 'محاسب الرواتب', approver: 'مدير HR', src: 'نظام العمل السعودي' },

  // ===== 2) مدة الخدمة (6) F14-F19 =====
  { code: 'F14', cat: 'service', nameAr: 'مدة الخدمة بالأيام', expr: 'أيام = (تاريخ النهاية − تاريخ الالتحاق)',
    vars: [{ k: 'hireDate', label: 'تاريخ الالتحاق', type: 'date' }, { k: 'endDate', label: 'تاريخ النهاية', type: 'date' }],
    calc: ({ hireDate, endDate }) => hireDate && endDate ? Math.floor((new Date(endDate) - new Date(hireDate)) / 86400000) : 0,
    owner: 'مدير النظام', approver: '—', src: 'حساب تاريخي' },
  { code: 'F15', cat: 'service', nameAr: 'مدة الخدمة بالشهور', expr: 'شهور = أيام ÷ 30.4',
    vars: [{ k: 'hireDate', label: 'تاريخ الالتحاق', type: 'date' }],
    calc: ({ hireDate }) => hireDate ? Math.floor(((Date.now() - new Date(hireDate).getTime()) / 86400000) / 30.4) : 0,
    owner: 'مدير النظام', approver: '—', src: 'حساب تاريخي' },
  { code: 'F16', cat: 'service', nameAr: 'مدة الخدمة بالسنوات', expr: 'سنوات = أيام ÷ 365.25',
    vars: [{ k: 'hireDate', label: 'تاريخ الالتحاق', type: 'date' }],
    calc: ({ hireDate }) => hireDate ? Math.floor(((Date.now() - new Date(hireDate).getTime()) / 86400000) / 365.25) : 0,
    owner: 'مدير النظام', approver: '—', src: 'حساب تاريخي' },
  { code: 'F17', cat: 'service', nameAr: 'نهاية الخدمة — استقالة', expr: '<2 سنوات=0 | 2-5=نصف شهر×سنوات | 5-10=نصف×5 + شهر×الباقي | >10=نصف×5 + شهر×5 + 1.5×الباقي',
    vars: [{ k: 'years', label: 'سنوات الخدمة' }, { k: 'salary', label: 'الراتب الأخير' }],
    calc: ({ years=0, salary=0 }) => {
      const y = +years, s = +salary, half = s / 2;
      if (y < 2) return 0;
      if (y < 5) return half * y;
      if (y <= 10) return half * 5 + s * (y - 5);
      return half * 5 + s * 5 + s * 1.5 * (y - 10);
    },
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'نظام العمل السعودي مادة 84' },
  { code: 'F18', cat: 'service', nameAr: 'نهاية الخدمة — إنهاء', expr: '<2=0 | 2-5=نصف شهر×سنوات | >5=نصف×5 + شهر×الباقي',
    vars: [{ k: 'years', label: 'سنوات الخدمة' }, { k: 'salary', label: 'الراتب الأخير' }],
    calc: ({ years=0, salary=0 }) => {
      const y = +years, s = +salary, half = s / 2;
      if (y < 2) return 0;
      if (y <= 5) return half * y;
      return half * 5 + s * (y - 5);
    },
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'نظام العمل السعودي مادة 84' },
  { code: 'F19', cat: 'service', nameAr: 'نهاية الخدمة — تقاعد', expr: 'استحقاق كامل = نصف شهر × أول 5 سنوات + شهر × الباقي',
    vars: [{ k: 'years', label: 'سنوات الخدمة' }, { k: 'salary', label: 'الراتب الأخير' }],
    calc: ({ years=0, salary=0 }) => {
      const y = +years, s = +salary, half = s / 2;
      const first5 = Math.min(y, 5);
      const rest = Math.max(0, y - 5);
      return half * first5 + s * rest;
    },
    owner: 'محاسب الرواتب', approver: 'المدير المالي', src: 'نظام العمل السعودي مادة 84' },

  // ===== 3) الإجازات (6) F20-F25 =====
  { code: 'F20', cat: 'leave', nameAr: 'استحقاق الإجازة السنوية', expr: '<5 سنوات=21 يوم | ≥5 سنوات=30 يوم',
    vars: [{ k: 'years', label: 'سنوات الخدمة' }],
    calc: ({ years=0 }) => (+years) >= 5 ? 30 : 21,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 109' },
  { code: 'F21', cat: 'leave', nameAr: 'الإجازة المرضية بفئات', expr: '30 يوم=100% | 60 يوم=75% | 30 يوم=0% (حد 120 يوم/سنة)',
    vars: [{ k: 'usedDays', label: 'الأيام المستخدمة' }, { k: 'salary', label: 'الراتب اليومي' }],
    calc: ({ usedDays=0, salary=0 }) => {
      const u = +usedDays, s = +salary;
      const tier1 = Math.min(u, 30) * 1.00;
      const tier2 = Math.min(Math.max(0, u - 30), 60) * 0.75;
      const tier3 = Math.min(Math.max(0, u - 90), 30) * 0.00;
      return (tier1 + tier2 + tier3) * s;
    },
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 113' },
  { code: 'F22', cat: 'leave', nameAr: 'إجازة الأمومة', expr: '10 أسابيع مدفوعة 100% (4 قبل + 6 بعد الولادة)',
    vars: [],
    calc: () => 70,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 151' },
  { code: 'F23', cat: 'leave', nameAr: 'إجازة الأبوة', expr: '3 أيام مدفوعة',
    vars: [],
    calc: () => 3,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 152' },
  { code: 'F24', cat: 'leave', nameAr: 'إجازة الحج', expr: '10-15 يوم، مرة واحدة طوال الخدمة، بعد سنتين خدمة',
    vars: [{ k: 'years', label: 'سنوات الخدمة' }, { k: 'usedBefore', label: 'استخدمها سابقاً (0/1)' }],
    calc: ({ years=0, usedBefore=0 }) => (+years) >= 2 && !+usedBefore ? 15 : 0,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 115' },
  { code: 'F25', cat: 'leave', nameAr: 'بدل الإجازة', expr: 'البدل = الراتب اليومي × أيام الإجازة (فقط للمسافرين)',
    vars: [{ k: 'daily', label: 'الراتب اليومي' }, { k: 'days', label: 'الأيام' }],
    calc: ({ daily=0, days=0 }) => (+daily) * (+days),
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'نظام العمل السعودي مادة 114' },

  // ===== 4) المؤشرات (7) F26-F32 =====
  { code: 'F26', cat: 'kpi', nameAr: 'نسبة السعودة', expr: 'السعودة = (السعوديون ÷ الإجمالي) × 100',
    vars: [{ k: 'saudi', label: 'السعوديون' }, { k: 'total', label: 'الإجمالي' }],
    calc: ({ saudi=0, total=1 }) => ((+saudi) / (+total || 1)) * 100,
    owner: 'مدير النظام', approver: 'مدير HR', src: 'وزارة الموارد البشرية' },
  { code: 'F27', cat: 'kpi', nameAr: 'نطاق النطاقات', expr: '≥40=بلاتيني | ≥30=أخضر عالي | ≥22=أخضر وسط | ≥15=أخضر منخفض | ≥8=أصفر | <8=أحمر',
    vars: [{ k: 'pct', label: 'نسبة السعودة' }],
    calc: ({ pct=0 }) => {
      const p = +pct;
      if (p >= 40) return 'بلاتيني';
      if (p >= 30) return 'أخضر عالي';
      if (p >= 22) return 'أخضر وسط';
      if (p >= 15) return 'أخضر منخفض';
      if (p >= 8) return 'أصفر';
      return 'أحمر';
    },
    owner: 'مدير النظام', approver: 'مدير HR', src: 'منصة نطاقات' },
  { code: 'F28', cat: 'kpi', nameAr: 'معدل الدوران', expr: 'الدوران = (المنتهية ÷ المتوسط) × 100',
    vars: [{ k: 'exits', label: 'المنتهية خدماتهم' }, { k: 'avg', label: 'متوسط الموظفين' }],
    calc: ({ exits=0, avg=1 }) => ((+exits) / (+avg || 1)) * 100,
    owner: 'محلل بيانات', approver: 'مدير HR', src: 'مؤشرات SHRM' },
  { code: 'F29', cat: 'kpi', nameAr: 'معدل الغياب', expr: 'الغياب = أيام الغياب ÷ أيام العمل الفعلية × 100',
    vars: [{ k: 'absent', label: 'أيام الغياب' }, { k: 'worked', label: 'أيام العمل' }],
    calc: ({ absent=0, worked=1 }) => ((+absent) / (+worked || 1)) * 100,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'سياسة الشركة' },
  { code: 'F30', cat: 'kpi', nameAr: 'نسبة التأخر', expr: 'التأخر = دقائق التأخر ÷ ساعات العمل الفعلية × 100',
    vars: [{ k: 'lateMin', label: 'دقائق التأخر' }, { k: 'workedHr', label: 'ساعات العمل' }],
    calc: ({ lateMin=0, workedHr=1 }) => ((+lateMin) / 60) / (+workedHr || 1) * 100,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'سياسة الشركة' },
  { code: 'F31', cat: 'kpi', nameAr: 'eNPS', expr: 'eNPS = %المروجين − %المنتقدين (المدى −100 إلى +100)',
    vars: [{ k: 'promoters', label: 'المروجون' }, { k: 'detractors', label: 'المنتقدون' }, { k: 'total', label: 'المجموع' }],
    calc: ({ promoters=0, detractors=0, total=1 }) => (((+promoters) - (+detractors)) / (+total || 1)) * 100,
    owner: 'محلل بيانات', approver: 'مدير HR', src: 'منهجية Bain & Co' },
  { code: 'F32', cat: 'kpi', nameAr: 'نسبة الاستفادة من الإجازات', expr: 'الاستفادة = أيام الإجازات المستخدمة ÷ إجمالي الرصيد × 100',
    vars: [{ k: 'usedLeaves', label: 'الأيام المستخدمة' }, { k: 'totalBalance', label: 'إجمالي الرصيد' }],
    calc: ({ usedLeaves=0, totalBalance=1 }) => ((+usedLeaves) / (+totalBalance || 1)) * 100,
    owner: 'أخصائي HR', approver: 'مدير HR', src: 'سياسة الشركة' },
];

const SAUDI_RULES = [
  { code: 'R-ANNUAL', nameAr: 'الإجازة السنوية', rule: '21 يوم لمن أقل من 5 سنوات، 30 يوم لمن 5 سنوات فأكثر' },
  { code: 'R-SICK', nameAr: 'الإجازة المرضية', rule: '30 يوم بأجر كامل، 60 يوم بـ75%، 30 يوم بدون أجر (حد 120 يوم/سنة)' },
  { code: 'R-MATERNITY', nameAr: 'إجازة الأمومة', rule: '10 أسابيع مدفوعة (4 قبل + 6 بعد الولادة)' },
  { code: 'R-PATERNITY', nameAr: 'إجازة الأبوة', rule: '3 أيام مدفوعة من تاريخ الولادة' },
  { code: 'R-EOS', nameAr: 'مكافأة نهاية الخدمة', rule: 'تختلف حسب السبب: استقالة/إنهاء/تقاعد (انظر F17/F18/F19)' },
  { code: 'R-GOSI', nameAr: 'التأمينات الاجتماعية', rule: 'الموظف 9.75%، صاحب العمل 11.75%' },
  { code: 'R-WORK-PERMIT', nameAr: 'رسوم رخصة العمل', rule: 'حتى 50 موظف = 7200 ر.س/سنوياً، أكثر من 50 = 9000 ر.س/سنوياً' },
  { code: 'R-FAMILY-VISA', nameAr: 'تأشيرة الزيارة العائلية', rule: 'راتب > 5000 ر.س + خدمة 6 أشهر فأكثر' },
  { code: 'R-IQAMA', nameAr: 'إصدار الإقامة', rule: 'خلال 90 يوم من الدخول، تجديد قبل 3 أشهر من الانتهاء' },
  { code: 'R-KAFALA', nameAr: 'نقل الكفالة', rule: 'بعد سنة خدمة، رسوم 2000-10000 ر.س حسب القطاع' },
  { code: 'R-PROBATION', nameAr: 'فترة التجربة', rule: '90 يوم، تقييمان: في اليوم 45 وفي اليوم 60' },
];

const CATEGORIES = {
  salary: { nameAr: 'الرواتب والبدلات', color: 'bg-primary-50 text-primary-700' },
  service: { nameAr: 'مدة الخدمة ونهاية الخدمة', color: 'bg-violet-50 text-violet-700' },
  leave: { nameAr: 'الإجازات', color: 'bg-green-50 text-success-600' },
  kpi: { nameAr: 'المؤشرات', color: 'bg-amber-50 text-warn-600' },
};

export default function Transparency() {
  const { has } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('rules');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [audit, setAudit] = useState([]);

  useEffect(() => {
    if (!has('formulas.read')) return;
    client.get('/formulas').catch(() => {});
    client.get('/governance/audit?limit=20').then(({ data }) => setAudit(data.entries || [])).catch(() => {});
  }, [has]);

  const filtered = FORMULAS.filter((f) => {
    if (cat && f.cat !== cat) return false;
    if (search && !f.nameAr.includes(search) && !f.code.includes(search.toUpperCase())) return false;
    return true;
  });

  function openFormula(f) {
    setSelected(f);
    setHistory([]);
    if (has('formulas.read')) {
      client.get(`/formulas/${f.code}`).then(({ data }) => setHistory(data.history || [])).catch(() => {});
    }
  }

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">مركز الشفافية — الناضج</h1>
        <p className="muted text-sm">عرض شامل لكل المعادلات والقواعد السعودية المستخدمة في النظام، مع مالك كل معادلة والمُعتمد المطلوب لتعديلها.</p>
      </div>

      <div className="flex gap-2 border-b border-ink-200">
        <button onClick={() => setTab('rules')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'rules' ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-ink-600'}`}>القواعد السعودية (11)</button>
        <button onClick={() => setTab('formulas')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'formulas' ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-ink-600'}`}>المعادلات (32)</button>
        <button onClick={() => setTab('audit')} className={`px-3 py-2 text-sm border-b-2 ${tab === 'audit' ? 'border-primary-600 text-primary-700 font-medium' : 'border-transparent text-ink-600'}`}>آخر التغييرات ({audit.length})</button>
      </div>

      {tab === 'rules' && (
        <div className="space-y-2">
          {SAUDI_RULES.map((r) => (
            <div key={r.code} className="card-padded">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-ink-400">{r.code}</span>
                <h3 className="font-semibold">{r.nameAr}</h3>
              </div>
              <p className="text-sm text-ink-700 mt-1">{r.rule}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'formulas' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المعادلات..." className="input w-64" />
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="input w-48">
              <option value="">كل الفئات</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.nameAr}</option>)}
            </select>
            <span className="badge-primary self-center">{filtered.length} معادلة</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map((f) => (
              <button key={f.code} onClick={() => openFormula(f)} className="card-padded text-start hover:bg-ink-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-400">{f.code}</span>
                      <h4 className="font-semibold">{f.nameAr}</h4>
                    </div>
                    <p className="text-xs text-ink-600 mt-1 line-clamp-2">{f.expr}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${CATEGORIES[f.cat].color}`}>{CATEGORIES[f.cat].nameAr}</span>
                </div>
                <div className="text-xs text-ink-500 mt-2">مالك: {f.owner} | مُعتمد: {f.approver}</div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="fixed inset-0 bg-ink-900/50 z-40 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
              <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-ink-100 sticky top-0 bg-white flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-400">{selected.code}</span>
                      <h2 className="h3">{selected.nameAr}</h2>
                    </div>
                    <p className="text-sm text-ink-600 mt-1">المالك: <strong>{selected.owner}</strong> | المُعتمد: <strong>{selected.approver}</strong></p>
                    <p className="text-xs text-ink-500 mt-1">المصدر: {selected.src}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-ink-500 hover:text-ink-900">إغلاق</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-ink-700 mb-2">الصيغة الرياضية</div>
                    <div className="bg-ink-50 rounded-lg p-3 font-mono text-sm">{selected.expr}</div>
                  </div>
                  {selected.vars.length > 0 && (
                    <FormulaSimulator formula={selected} />
                  )}
                  {history.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-ink-700 mb-2">سجل آخر تغييرات على هذه المعادلة</div>
                      <div className="space-y-1">
                        {history.slice(0, 5).map((h) => (
                          <div key={h.id} className="text-xs bg-ink-50 rounded p-2">
                            <div className="font-medium">{h.actorName} — {fmtDate(h.createdAt)}</div>
                            <div className="text-ink-600">{h.action}: {h.summary || h.reason || '—'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'audit' && (
        <div>
          {audit.length === 0 ? (
            <div className="card-padded text-ink-500 text-sm">لا توجد تغييرات مسجلة بعد</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>السبب</th></tr></thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id}>
                      <td className="text-xs">{fmtDate(a.createdAt)}</td>
                      <td className="text-xs">{a.actorName}</td>
                      <td><span className="badge-ink text-xs">{a.action}</span></td>
                      <td className="text-xs">{a.entityType}{a.entityCode ? ` #${a.entityCode}` : ''}</td>
                      <td className="text-xs">{a.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FormulaSimulator({ formula }) {
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  function run() {
    try {
      const r = formula.calc(inputs);
      setResult(typeof r === 'number' ? Math.round(r * 100) / 100 : r);
    } catch (e) {
      setResult('خطأ: ' + e.message);
    }
  }
  return (
    <div className="bg-primary-50/30 rounded-lg p-3 border border-primary-100">
      <div className="text-sm font-medium text-ink-700 mb-2">احسب مثالاً حياً</div>
      <div className="grid grid-cols-2 gap-2">
        {formula.vars.map((v) => (
          <div key={v.k}>
            <label className="text-xs text-ink-600 block mb-1">{v.label}</label>
            {v.type === 'date' ? (
              <input type="date" value={inputs[v.k] || ''} onChange={(e) => setInputs({ ...inputs, [v.k]: e.target.value })} className="input w-full text-sm" />
            ) : (
              <input type="number" value={inputs[v.k] || ''} onChange={(e) => setInputs({ ...inputs, [v.k]: e.target.value })} className="input w-full text-sm" placeholder="0" />
            )}
          </div>
        ))}
      </div>
      <button onClick={run} className="btn-primary text-sm mt-3">احسب</button>
      {result !== null && (
        <div className="mt-3 bg-white rounded p-2 text-sm">
          <span className="text-ink-500">النتيجة: </span>
          <strong className="text-primary-700 font-mono">{String(result)}</strong>
        </div>
      )}
    </div>
  );
}