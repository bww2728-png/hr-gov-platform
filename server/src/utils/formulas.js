/**
 * سجل المعادلات الموثقة — 32 معادلة من الوثيقة الأولى (قسم الحسابات والمعادلات).
 * كل معادلة: نص عربي + متغيرات + مثال عددي من الوثيقة + دالة حساب فعلية.
 * القيم الافتراضية مطابقة لنظام العمل السعودي، وتُدار تعديلاتها عبر محرك الحوكمة.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const DAYS_IN_MONTH = 30;
const HOURS_PER_DAY = 8;
const { calculateEOS } = require('./saudiRules');

// ============================================================
// 1) حسابات الرواتب (13 معادلة) F01–F13
// ============================================================
const SALARY = [
  {
    code: 'F01', category: 'salary',
    nameAr: 'إجمالي الراتب', nameEn: 'Gross Salary',
    expressionAr: 'إجمالي الراتب = الراتب الأساسي + بدل السكن + بدل النقل + بدلات أخرى',
    variables: [
      { key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 },
      { key: 'housing', nameAr: 'بدل السكن', example: 1500 },
      { key: 'transport', nameAr: 'بدل النقل', example: 500 },
      { key: 'other', nameAr: 'بدلات أخرى', example: 0 },
    ],
    example: { inputs: { basic: 5000, housing: 1500, transport: 500, other: 0 }, result: 7000 },
    compute: ({ basic = 0, housing = 0, transport = 0, other = 0 }) =>
      round2(+basic + +housing + +transport + +other),
  },
  {
    code: 'F02', category: 'salary',
    nameAr: 'صافي الراتب', nameEn: 'Net Salary',
    expressionAr: 'صافي الراتب = إجمالي الراتب − الخصومات − التأمينات − السلف',
    variables: [
      { key: 'gross', nameAr: 'إجمالي الراتب', example: 7000 },
      { key: 'deductions', nameAr: 'الخصومات', example: 200 },
      { key: 'gosi', nameAr: 'التأمينات (حصة الموظف)', example: 400 },
      { key: 'loans', nameAr: 'أقساط السلف', example: 100 },
    ],
    example: { inputs: { gross: 7000, deductions: 200, gosi: 400, loans: 100 }, result: 6300 },
    compute: ({ gross = 0, deductions = 0, gosi = 0, loans = 0 }) =>
      round2(+gross - +deductions - +gosi - +loans),
  },
  {
    code: 'F03', category: 'salary',
    nameAr: 'الراتب بعد الاستقطاع', nameEn: 'Salary After Deductions',
    expressionAr: 'الراتب بعد الاستقطاع = صافي الراتب − خصومات خاصة (تأخر، غياب)',
    variables: [
      { key: 'net', nameAr: 'صافي الراتب', example: 6300 },
      { key: 'special', nameAr: 'خصومات خاصة', example: 150 },
    ],
    example: { inputs: { net: 6300, special: 150 }, result: 6150 },
    compute: ({ net = 0, special = 0 }) => round2(+net - +special),
  },
  {
    code: 'F04', category: 'salary',
    nameAr: 'راتب الساعة', nameEn: 'Hourly Rate',
    expressionAr: 'راتب الساعة = (الراتب الأساسي ÷ عدد أيام العمل) ÷ 8',
    variables: [
      { key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 },
      { key: 'workingDays', nameAr: 'عدد أيام العمل', example: 30 },
    ],
    example: { inputs: { basic: 5000, workingDays: 30 }, result: 20.83 },
    compute: ({ basic = 0, workingDays = DAYS_IN_MONTH }) =>
      round2(+basic / (+workingDays || DAYS_IN_MONTH) / HOURS_PER_DAY),
  },
  {
    code: 'F05', category: 'salary',
    nameAr: 'راتب اليوم', nameEn: 'Daily Rate',
    expressionAr: 'راتب اليوم = الراتب الأساسي ÷ 30',
    variables: [{ key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 }],
    example: { inputs: { basic: 5000 }, result: 166.67 },
    compute: ({ basic = 0 }) => round2(+basic / DAYS_IN_MONTH),
  },
  {
    code: 'F06', category: 'salary',
    nameAr: 'مكافأة نهاية الخدمة', nameEn: 'End of Service Gratuity',
    expressionAr: 'تُحسب عبر المصدر الموحد saudiRules.calculateEOS (نظام العمل السعودي — حالة إنهاء العقد)',
    variables: [
      { key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 },
      { key: 'years', nameAr: 'سنوات الخدمة', example: 3 },
    ],
    example: { inputs: { basic: 5000, years: 3 }, result: 7500 },
    compute: ({ basic = 0, years = 0 }) =>
      round2(calculateEOS({ lastSalary: +basic, years: +years, reason: 'termination' }).eosAmount),
  },
  {
    code: 'F07', category: 'salary',
    nameAr: 'تكلفة الموظف الشهرية', nameEn: 'Monthly Employee Cost',
    expressionAr: 'تكلفة الموظف = إجمالي الراتب + حصة الشركة في التأمينات + تكاليف أخرى',
    variables: [
      { key: 'gross', nameAr: 'إجمالي الراتب', example: 7000 },
      { key: 'companyGosi', nameAr: 'حصة الشركة في التأمينات', example: 500 },
      { key: 'otherCosts', nameAr: 'تكاليف أخرى', example: 200 },
    ],
    example: { inputs: { gross: 7000, companyGosi: 500, otherCosts: 200 }, result: 7700 },
    compute: ({ gross = 0, companyGosi = 0, otherCosts = 0 }) =>
      round2(+gross + +companyGosi + +otherCosts),
  },
  {
    code: 'F08', category: 'salary',
    nameAr: 'بدل الإجازة السنوي', nameEn: 'Annual Leave Allowance',
    expressionAr: 'بدل الإجازة = (الراتب الأساسي ÷ 30) × 21 يوم',
    variables: [
      { key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 },
      { key: 'days', nameAr: 'أيام الاستحقاق', example: 21 },
    ],
    example: { inputs: { basic: 5000, days: 21 }, result: 3500 },
    compute: ({ basic = 0, days = 21 }) => round2((+basic / DAYS_IN_MONTH) * +days),
  },
  {
    code: 'F09', category: 'salary',
    nameAr: 'خصم الغياب', nameEn: 'Absence Deduction',
    expressionAr: 'خصم الغياب = راتب اليوم × عدد أيام الغياب',
    variables: [
      { key: 'daily', nameAr: 'راتب اليوم', example: 166.67 },
      { key: 'absentDays', nameAr: 'أيام الغياب', example: 2 },
    ],
    example: { inputs: { daily: 166.67, absentDays: 2 }, result: 333.34 },
    compute: ({ daily = 0, absentDays = 0 }) => round2(+daily * +absentDays),
  },
  {
    code: 'F10', category: 'salary',
    nameAr: 'خصم التأخر بالساعة', nameEn: 'Late Hour Deduction',
    expressionAr: 'خصم التأخر = راتب الساعة × عدد ساعات التأخر',
    variables: [
      { key: 'hourly', nameAr: 'راتب الساعة', example: 20.83 },
      { key: 'lateHours', nameAr: 'ساعات التأخر', example: 3 },
    ],
    example: { inputs: { hourly: 20.83, lateHours: 3 }, result: 62.49 },
    compute: ({ hourly = 0, lateHours = 0 }) => round2(+hourly * +lateHours),
  },
  {
    code: 'F11', category: 'salary',
    nameAr: 'العمل الإضافي 150%', nameEn: 'Overtime 150%',
    expressionAr: 'العمل الإضافي = راتب الساعة × 1.5 × ساعات الإضافي',
    variables: [
      { key: 'hourly', nameAr: 'راتب الساعة', example: 20.83 },
      { key: 'hours', nameAr: 'ساعات الإضافي', example: 10 },
    ],
    example: { inputs: { hourly: 20.83, hours: 10 }, result: 312.45 },
    compute: ({ hourly = 0, hours = 0 }) => round2(+hourly * 1.5 * +hours),
  },
  {
    code: 'F12', category: 'salary',
    nameAr: 'العمل الإضافي 200% (عطل)', nameEn: 'Holiday Overtime 200%',
    expressionAr: 'العمل الإضافي = راتب الساعة × 2 × ساعات الإضافي',
    variables: [
      { key: 'hourly', nameAr: 'راتب الساعة', example: 20.83 },
      { key: 'hours', nameAr: 'ساعات الإضافي', example: 10 },
    ],
    example: { inputs: { hourly: 20.83, hours: 10 }, result: 416.6 },
    compute: ({ hourly = 0, hours = 0 }) => round2(+hourly * 2 * +hours),
  },
  {
    code: 'F13', category: 'salary',
    nameAr: 'ساعات العمل الشهرية', nameEn: 'Monthly Working Hours',
    expressionAr: 'ساعات العمل = عدد أيام العمل × 8 ساعات',
    variables: [
      { key: 'workingDays', nameAr: 'أيام العمل', example: 22 },
      { key: 'hoursPerDay', nameAr: 'ساعات اليوم', example: 8 },
    ],
    example: { inputs: { workingDays: 22, hoursPerDay: 8 }, result: 176 },
    compute: ({ workingDays = 22, hoursPerDay = HOURS_PER_DAY }) => round2(+workingDays * +hoursPerDay),
  },
];

// ============================================================
// 2) حسابات مدة الخدمة (6 معادلات) F14–F19
// ============================================================
const dayDiff = (from, to = new Date()) =>
  Math.max(0, Math.floor((new Date(to) - new Date(from)) / (24 * 3600 * 1000)));

const SERVICE = [
  {
    code: 'F14', category: 'service',
    nameAr: 'مدة الخدمة بالأيام', nameEn: 'Service Days',
    expressionAr: 'مدة الخدمة بالأيام = تاريخ اليوم − تاريخ المباشرة',
    variables: [
      { key: 'startDate', nameAr: 'تاريخ المباشرة', example: '2024-01-15', type: 'date' },
      { key: 'endDate', nameAr: 'تاريخ اليوم', example: '2026-08-27', type: 'date' },
    ],
    example: { inputs: { startDate: '2024-01-15', endDate: '2026-08-27' }, result: 955 },
    compute: ({ startDate, endDate = new Date() }) => dayDiff(startDate, endDate),
  },
  {
    code: 'F15', category: 'service',
    nameAr: 'مدة الخدمة بالأشهر', nameEn: 'Service Months',
    expressionAr: 'مدة الخدمة بالأشهر = الفرق بالأشهر بين تاريخي البداية والنهاية',
    variables: [
      { key: 'startDate', nameAr: 'تاريخ البداية', example: '2024-01-15', type: 'date' },
      { key: 'endDate', nameAr: 'تاريخ النهاية', example: '2026-08-27', type: 'date' },
    ],
    example: { inputs: { startDate: '2024-01-15', endDate: '2026-08-27' }, result: 31 },
    compute: ({ startDate, endDate = new Date() }) => Math.floor(dayDiff(startDate, endDate) / 30.4375),
  },
  {
    code: 'F16', category: 'service',
    nameAr: 'مدة الخدمة بالسنوات', nameEn: 'Service Years',
    expressionAr: 'مدة الخدمة بالسنوات = الفرق بالسنوات بين تاريخي البداية والنهاية',
    variables: [
      { key: 'startDate', nameAr: 'تاريخ البداية', example: '2024-01-15', type: 'date' },
      { key: 'endDate', nameAr: 'تاريخ النهاية', example: '2026-08-27', type: 'date' },
    ],
    example: { inputs: { startDate: '2024-01-15', endDate: '2026-08-27' }, result: 2.62 },
    compute: ({ startDate, endDate = new Date() }) => round2(dayDiff(startDate, endDate) / 365.25),
  },
  {
    code: 'F17', category: 'service',
    nameAr: 'العمر', nameEn: 'Age',
    expressionAr: 'العمر = تاريخ اليوم − تاريخ الميلاد',
    variables: [
      { key: 'birthDate', nameAr: 'تاريخ الميلاد', example: '1990-01-01', type: 'date' },
      { key: 'asOf', nameAr: 'تاريخ اليوم', example: '2026-08-27', type: 'date' },
    ],
    example: { inputs: { birthDate: '1990-01-01', asOf: '2026-08-27' }, result: 36 },
    compute: ({ birthDate, asOf = new Date() }) => Math.floor(dayDiff(birthDate, asOf) / 365.25),
  },
  {
    code: 'F18', category: 'service',
    nameAr: 'السنوات المتبقية للعقد', nameEn: 'Remaining Contract Days',
    expressionAr: 'المدة المتبقية = تاريخ نهاية العقد − تاريخ اليوم',
    variables: [
      { key: 'endDate', nameAr: 'نهاية العقد', example: '2027-01-15', type: 'date' },
      { key: 'asOf', nameAr: 'تاريخ اليوم', example: '2026-08-27', type: 'date' },
    ],
    example: { inputs: { endDate: '2027-01-15', asOf: '2026-08-27' }, result: 141 },
    compute: ({ endDate, asOf = new Date() }) =>
      Math.max(0, Math.ceil((new Date(endDate) - new Date(asOf)) / (24 * 3600 * 1000))),
  },
  {
    code: 'F19', category: 'service',
    nameAr: 'أيام التجربة المتبقية', nameEn: 'Remaining Probation Days',
    expressionAr: 'أيام التجربة المتبقية = 90 − مدة الخدمة بالأيام (إذا كانت < 90)',
    variables: [
      { key: 'serviceDays', nameAr: 'مدة الخدمة بالأيام', example: 45 },
      { key: 'probationDays', nameAr: 'فترة التجربة', example: 90 },
    ],
    example: { inputs: { serviceDays: 45, probationDays: 90 }, result: 45 },
    compute: ({ serviceDays = 0, probationDays = 90 }) => Math.max(0, +probationDays - +serviceDays),
  },
];

// ============================================================
// 3) حسابات الإجازات (6 معادلات) F20–F25
// ============================================================
const LEAVE = [
  {
    code: 'F20', category: 'leave',
    nameAr: 'رصيد الإجازة السنوي', nameEn: 'Annual Leave Balance',
    expressionAr: 'رصيد الإجازة = 21 يوم (أقل من 5 سنوات) أو 30 يوم (5 سنوات فأكثر)',
    variables: [{ key: 'serviceYears', nameAr: 'سنوات الخدمة', example: 3 }],
    example: { inputs: { serviceYears: 3 }, result: 21 },
    compute: ({ serviceYears = 0 }) => (+serviceYears >= 5 ? 30 : 21),
  },
  {
    code: 'F21', category: 'leave',
    nameAr: 'الرصيد المتبقي', nameEn: 'Remaining Leave Balance',
    expressionAr: 'الرصيد المتبقي = رصيد أول المدة − المستخدم − المرحَّل',
    variables: [
      { key: 'opening', nameAr: 'رصيد أول المدة', example: 21 },
      { key: 'used', nameAr: 'المستخدم', example: 5 },
      { key: 'carried', nameAr: 'المرحَّل', example: 0 },
    ],
    example: { inputs: { opening: 21, used: 5, carried: 0 }, result: 16 },
    compute: ({ opening = 0, used = 0, carried = 0 }) => round2(+opening + +carried - +used),
  },
  {
    code: 'F22', category: 'leave',
    nameAr: 'مدة الإجازة بالأيام', nameEn: 'Leave Duration in Days',
    expressionAr: 'مدة الإجازة = تاريخ النهاية − تاريخ البداية + 1',
    variables: [
      { key: 'startDate', nameAr: 'تاريخ البداية', example: '2026-08-30', type: 'date' },
      { key: 'endDate', nameAr: 'تاريخ النهاية', example: '2026-09-05', type: 'date' },
    ],
    example: { inputs: { startDate: '2026-08-30', endDate: '2026-09-05' }, result: 7 },
    compute: ({ startDate, endDate }) => dayDiff(startDate, endDate) + 1,
  },
  {
    code: 'F23', category: 'leave',
    nameAr: 'قيمة الإجازة المالية', nameEn: 'Leave Value',
    expressionAr: 'قيمة الإجازة = (الراتب الأساسي ÷ 30) × عدد الأيام',
    variables: [
      { key: 'basic', nameAr: 'الراتب الأساسي', example: 5000 },
      { key: 'days', nameAr: 'عدد الأيام', example: 7 },
    ],
    example: { inputs: { basic: 5000, days: 7 }, result: 1166.67 },
    compute: ({ basic = 0, days = 0 }) => round2((+basic / DAYS_IN_MONTH) * +days),
  },
  {
    code: 'F24', category: 'leave',
    nameAr: 'تأثير الإجازة على الراتب', nameEn: 'Leave Impact on Salary',
    expressionAr: 'لا تأثير — الإجازة السنوية مدفوعة الأجر بالكامل',
    variables: [{ key: 'salary', nameAr: 'الراتب الشهري', example: 7000 }],
    example: { inputs: { salary: 7000 }, result: 7000 },
    compute: ({ salary = 0 }) => round2(+salary),
  },
  {
    code: 'F25', category: 'leave',
    nameAr: 'بدل إجازة نهاية الخدمة', nameEn: 'EOS Leave Allowance',
    expressionAr: 'بدل إجازة نهاية الخدمة = الرصيد غير المستخدم × راتب اليوم',
    variables: [
      { key: 'unusedBalance', nameAr: 'الرصيد غير المستخدم', example: 16 },
      { key: 'daily', nameAr: 'راتب اليوم', example: 166.67 },
    ],
    example: { inputs: { unusedBalance: 16, daily: 166.67 }, result: 2666.72 },
    compute: ({ unusedBalance = 0, daily = 0 }) => round2(+unusedBalance * +daily),
  },
];

// ============================================================
// 4) مؤشرات الأداء KPIs (7 معادلات) F26–F32
// ============================================================
const KPI = [
  {
    code: 'F26', category: 'kpi',
    nameAr: 'معدل دوران الموظفين', nameEn: 'Employee Turnover Rate',
    expressionAr: 'معدل الدوران = (عدد منتهي الخدمة ÷ متوسط عدد الموظفين) × 100',
    variables: [
      { key: 'terminated', nameAr: 'عدد منتهي الخدمة', example: 15 },
      { key: 'avgHeadcount', nameAr: 'متوسط عدد الموظفين', example: 200 },
    ],
    example: { inputs: { terminated: 15, avgHeadcount: 200 }, result: 7.5 },
    compute: ({ terminated = 0, avgHeadcount = 1 }) => round2((+terminated / (+avgHeadcount || 1)) * 100),
  },
  {
    code: 'F27', category: 'kpi',
    nameAr: 'نسبة الغياب', nameEn: 'Absence Rate',
    expressionAr: 'نسبة الغياب = (أيام الغياب ÷ أيام العمل الإجمالية) × 100',
    variables: [
      { key: 'absentDays', nameAr: 'أيام الغياب', example: 120 },
      { key: 'totalWorkDays', nameAr: 'أيام العمل الإجمالية', example: 4400 },
    ],
    example: { inputs: { absentDays: 120, totalWorkDays: 4400 }, result: 2.73 },
    compute: ({ absentDays = 0, totalWorkDays = 1 }) => round2((+absentDays / (+totalWorkDays || 1)) * 100),
  },
  {
    code: 'F28', category: 'kpi',
    nameAr: 'متوسط مدة الخدمة', nameEn: 'Average Service Duration',
    expressionAr: 'متوسط الخدمة = مجموع سنوات خدمة الموظفين ÷ عددهم',
    variables: [
      { key: 'sumYears', nameAr: 'مجموع سنوات الخدمة', example: 450 },
      { key: 'count', nameAr: 'عدد الموظفين', example: 200 },
    ],
    example: { inputs: { sumYears: 450, count: 200 }, result: 2.25 },
    compute: ({ sumYears = 0, count = 1 }) => round2(+sumYears / (+count || 1)),
  },
  {
    code: 'F29', category: 'kpi',
    nameAr: 'نسبة السعودة (نطاقات)', nameEn: 'Saudization Rate',
    expressionAr: 'نسبة السعودة = (عدد السعوديين ÷ إجمالي الموظفين) × 100',
    variables: [
      { key: 'saudi', nameAr: 'عدد السعوديين', example: 75 },
      { key: 'total', nameAr: 'إجمالي الموظفين', example: 200 },
    ],
    example: { inputs: { saudi: 75, total: 200 }, result: 37.5 },
    compute: ({ saudi = 0, total = 1 }) => round2((+saudi / (+total || 1)) * 100),
  },
  {
    code: 'F30', category: 'kpi',
    nameAr: 'تكلفة الرواتب الشهرية', nameEn: 'Monthly Payroll Cost',
    expressionAr: 'تكلفة الرواتب = مجموع الرواتب الأساسية + البدلات لكل الموظفين',
    variables: [{ key: 'totalSalaries', nameAr: 'مجموع الرواتب والبدلات', example: 1400000 }],
    example: { inputs: { totalSalaries: 1400000 }, result: 1400000 },
    compute: ({ totalSalaries = 0 }) => round2(+totalSalaries),
  },
  {
    code: 'F31', category: 'kpi',
    nameAr: 'نسبة العمل الإضافي', nameEn: 'Overtime Rate',
    expressionAr: 'نسبة الإضافي = (ساعات الإضافي ÷ ساعات العمل العادية) × 100',
    variables: [
      { key: 'overtimeHours', nameAr: 'ساعات الإضافي', example: 350 },
      { key: 'regularHours', nameAr: 'ساعات العمل العادية', example: 35200 },
    ],
    example: { inputs: { overtimeHours: 350, regularHours: 35200 }, result: 0.99 },
    compute: ({ overtimeHours = 0, regularHours = 1 }) => round2((+overtimeHours / (+regularHours || 1)) * 100),
  },
  {
    code: 'F32', category: 'kpi',
    nameAr: 'معدل استخدام الإجازات', nameEn: 'Leave Usage Rate',
    expressionAr: 'معدل الاستخدام = (الإجازات المستخدمة ÷ الرصيد الكلي) × 100',
    variables: [
      { key: 'usedLeaves', nameAr: 'الإجازات المستخدمة', example: 420 },
      { key: 'totalBalance', nameAr: 'الرصيد الكلي', example: 4200 },
    ],
    example: { inputs: { usedLeaves: 420, totalBalance: 4200 }, result: 10 },
    compute: ({ usedLeaves = 0, totalBalance = 1 }) => round2((+usedLeaves / (+totalBalance || 1)) * 100),
  },
];

const ALL = [...SALARY, ...SERVICE, ...LEAVE, ...KPI];
const BY_CODE = Object.fromEntries(ALL.map((f) => [f.code, f]));

/** تنفيذ معادلة برمزها مع مدخلات، يعيد { result, formula } — يتجاوز لشجرة logicJson من قاعدة البيانات عند وجودها */
function simulate(code, inputs = {}) {
  const f = BY_CODE[code];
  if (!f) throw new Error(`معادلة غير معروفة: ${code}`);
  return { result: f.compute(inputs), formula: { code: f.code, nameAr: f.nameAr, expressionAr: f.expressionAr } };
}

/** تنفيذ عبر محرك القواعد الديناميكي: إن وُجدت شجرة logicJson في DB تُنفَّذ، وإلا الدالة الصلبة احتياطاً */
async function simulateDynamic(code, inputs = {}) {
  const prisma = require('../prisma');
  const dsl = require('./formulaDsl');
  const f = BY_CODE[code];
  if (!f) throw new Error(`معادلة غير معروفة: ${code}`);
  const def = await prisma.formulaDefinition.findUnique({
    where: { code },
    select: { logicJson: true, variablesJson: true, expressionAr: true, nameAr: true },
  });
  if (def?.logicJson) {
    const allowed = {};
    for (const v of Array.isArray(def.variablesJson) ? def.variablesJson : []) {
      if (v && v.key && inputs[v.key] !== undefined) allowed[v.key] = inputs[v.key];
    }
    const result = dsl.evaluate(def.logicJson, allowed);
    return { result, formula: { code, nameAr: def.nameAr, expressionAr: def.expressionAr, engine: 'logicJson' } };
  }
  return { ...simulate(code, inputs), engine: 'code' };
}

/** تعريفات قابلة للزرع في formula_definitions (بدون الدالة) */
function seedDefinitions() {
  return ALL.map(({ compute, ...rest }) => rest);
}

module.exports = { ALL, BY_CODE, simulate, simulateDynamic, seedDefinitions, round2 };
