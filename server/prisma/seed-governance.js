/**
 * بذر طبقة الحوكمة والمواءمة مع الوثائق الثلاث:
 * - مصفوفة الجداول الفرعية الـ 21 (المالك/المعتمد) حرفياً من تعليمات الإدارة.
 * - 32 تعريف معادلة من الوثيقة الأولى.
 * - قيم القوائم الجديدة (فئات وظيفية، كفلاء، تأشيرات، حالات، أسباب، إجراءات، جهات...).
 * - أقسام، عقود، تحويلات، ترقيات، طلبات قوى تجريبية.
 * - إعدادات هوية شركة الناضج.
 */
const { seedDefinitions } = require('../src/utils/formulas');

/** مصفوفة حوكمة الجداول الفرعية الـ 21 — كما وردت في التعليمات حرفياً */
const LOOKUP_CATEGORIES = [
  { code: 'nationality',        nameAr: 'الجنسيات',           source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'مرتبطة بالإقامة والتأشيرات' },
  { code: 'branch',             nameAr: 'الفروع',             source: 'table', sourceTable: 'branches',     ownerRoles: ['sysadmin'],                          approverRoles: [],                                     requiresApproval: false, notes: 'تغيير الفروع حساس ويؤثر على كل الهيكل' },
  { code: 'department',         nameAr: 'الإدارات',           source: 'table', sourceTable: 'departments',  ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'الهيكل التنظيمي قرار استراتيجي' },
  { code: 'section',            nameAr: 'الأقسام',            source: 'table', sourceTable: 'sections',     ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'يتبع الإدارات' },
  { code: 'position',           nameAr: 'المسميات الوظيفية',  source: 'table', sourceTable: 'positions',    ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'مرتبطة بالرواتب والوصف الوظيفي' },
  { code: 'job_category',       nameAr: 'الفئات الوظيفية',    source: 'lookup', ownerRoles: ['hr_specialist', 'payroll_officer'], approverRoles: ['hr_director', 'finance_manager'],       requiresApproval: true, sensitive: true, notes: 'مرتبطة بهيكل الرواتب' },
  { code: 'contract_type',      nameAr: 'أنواع العقود',       source: 'lookup', ownerRoles: ['sysadmin', 'hr_director'],          approverRoles: [],                                     requiresApproval: false, notes: 'عقود قانونية تحتاج حذراً' },
  { code: 'sponsor',            nameAr: 'الكفلاء',            source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'مرتبط بالجوازات' },
  { code: 'visa_type',          nameAr: 'أنواع التأشيرات',    source: 'lookup', ownerRoles: ['sysadmin'],                          approverRoles: [],                                     requiresApproval: false, notes: 'تنظيم حكومي ثابت غالباً' },
  { code: 'employee_status',    nameAr: 'حالات الموظفين',     source: 'lookup', ownerRoles: ['sysadmin'],                          approverRoles: [],                                     requiresApproval: false, notes: 'حالات أساسية ثابتة' },
  { code: 'request_status',     nameAr: 'حالات الطلبات',      source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'workflow أساسي' },
  { code: 'education_level',    nameAr: 'المؤهلات',           source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'مرتبطة بالتوظيف' },
  { code: 'eos_reason',         nameAr: 'أسباب نهاية الخدمة', source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director', 'compliance_officer'],    requiresApproval: true, sensitive: true, notes: 'قانونية — مدير HR + Legal' },
  { code: 'request_reason',     nameAr: 'أسباب الطلبات',      source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: [],                                     requiresApproval: false, notes: 'مرنة' },
  { code: 'action_type',        nameAr: 'أنواع الإجراءات',    source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'workflow' },
  { code: 'action_result',      nameAr: 'نتائج الإجراءات',    source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: [],                                     requiresApproval: false, notes: 'مرنة' },
  { code: 'qiwa_change_type',   nameAr: 'أنواع التغيرات (قوى)', source: 'lookup', ownerRoles: ['sysadmin'],                        approverRoles: [],                                     requiresApproval: false, notes: 'متعلقة بمنصة قوى' },
  { code: 'classification_type', nameAr: 'أنواع التصنيف',     source: 'lookup', ownerRoles: ['hr_specialist'],                    approverRoles: [],                                     requiresApproval: false, notes: 'مرنة' },
  { code: 'request_type',       nameAr: 'أنواع الطلبات',      source: 'table', sourceTable: 'request_types', ownerRoles: ['hr_specialist'],                   approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'workflow' },
  { code: 'entity',             nameAr: 'الجهات',             source: 'lookup', ownerRoles: ['sysadmin'],                          approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'جهات حكومية ورسمية' },
  { code: 'employees',          nameAr: 'جدول الموظفين',      source: 'table', sourceTable: 'employees',    ownerRoles: ['hr_specialist'],                    approverRoles: ['hr_director'],                          requiresApproval: true,  notes: 'كل تعديل موثق في audit log' },
];

/** قيم القوائم الجديدة */
const NEW_LOOKUP_VALUES = [
  // الفئات الوظيفية
  { category: 'job_category', code: 'JC-EXEC', valueAr: 'قيادية تنفيذية', valueEn: 'Executive', sortOrder: 1 },
  { category: 'job_category', code: 'JC-MGR', valueAr: 'إشرافية إدارية', valueEn: 'Managerial', sortOrder: 2 },
  { category: 'job_category', code: 'JC-PRO', valueAr: 'مهنية تخصصية', valueEn: 'Professional', sortOrder: 3 },
  { category: 'job_category', code: 'JC-OPS', valueAr: 'تشغيلية فنية', valueEn: 'Operational', sortOrder: 4 },
  { category: 'job_category', code: 'JC-SUP', valueAr: 'مساندة', valueEn: 'Support', sortOrder: 5 },
  // الكفلاء
  { category: 'sponsor', code: 'SP-COMP', valueAr: 'المنشأة الأم', valueEn: 'Parent Company' },
  { category: 'sponsor', code: 'SP-BR1', valueAr: 'فرع الرياض', valueEn: 'Riyadh Branch' },
  { category: 'sponsor', code: 'SP-INDV', valueAr: 'كفيل فرد', valueEn: 'Individual Sponsor' },
  // أنواع التأشيرات
  { category: 'visa_type', code: 'VT-WORK', valueAr: 'تأشيرة عمل', valueEn: 'Work Visa' },
  { category: 'visa_type', code: 'VT-EXITRE', valueAr: 'خروج وعودة', valueEn: 'Exit Re-Entry' },
  { category: 'visa_type', code: 'VT-FINAL', valueAr: 'خروج نهائي', valueEn: 'Final Exit' },
  { category: 'visa_type', code: 'VT-FAMILY', valueAr: 'زيارة عائلية', valueEn: 'Family Visit' },
  // حالات الموظفين
  { category: 'employee_status', code: 'ES-ACTIVE', valueAr: 'على رأس العمل', valueEn: 'Active' },
  { category: 'employee_status', code: 'ES-LEAVE', valueAr: 'في إجازة', valueEn: 'On Leave' },
  { category: 'employee_status', code: 'ES-SUSP', valueAr: 'موقوف', valueEn: 'Suspended' },
  { category: 'employee_status', code: 'ES-NOTICE', valueAr: 'في فترة الإشعار', valueEn: 'Notice Period' },
  { category: 'employee_status', code: 'ES-TERM', valueAr: 'منتهية خدمته', valueEn: 'Terminated' },
  // حالات الطلبات
  { category: 'request_status', code: 'RS-DRAFT', valueAr: 'مسودة', valueEn: 'Draft' },
  { category: 'request_status', code: 'RS-PEND', valueAr: 'قيد الانتظار', valueEn: 'Pending' },
  { category: 'request_status', code: 'RS-MGR', valueAr: 'بانتظار المدير', valueEn: 'Manager Review' },
  { category: 'request_status', code: 'RS-HR', valueAr: 'بانتظار HR', valueEn: 'HR Review' },
  { category: 'request_status', code: 'RS-APPR', valueAr: 'معتمد', valueEn: 'Approved' },
  { category: 'request_status', code: 'RS-REJ', valueAr: 'مرفوض', valueEn: 'Rejected' },
  // أسباب نهاية الخدمة
  { category: 'eos_reason', code: 'EOS-RESIGN', valueAr: 'استقالة', valueEn: 'Resignation' },
  { category: 'eos_reason', code: 'EOS-TERM', valueAr: 'إنهاء من صاحب العمل', valueEn: 'Termination' },
  { category: 'eos_reason', code: 'EOS-RETIRE', valueAr: 'تقاعد', valueEn: 'Retirement' },
  { category: 'eos_reason', code: 'EOS-CONTRACT', valueAr: 'انتهاء العقد', valueEn: 'Contract End' },
  { category: 'eos_reason', code: 'EOS-MUTUAL', valueAr: 'اتفاق الطرفين', valueEn: 'Mutual Agreement' },
  // أسباب الطلبات
  { category: 'request_reason', code: 'RR-PERSONAL', valueAr: 'ظروف شخصية', valueEn: 'Personal' },
  { category: 'request_reason', code: 'RR-FAMILY', valueAr: 'ظروف عائلية', valueEn: 'Family' },
  { category: 'request_reason', code: 'RR-MEDICAL', valueAr: 'أسباب صحية', valueEn: 'Medical' },
  { category: 'request_reason', code: 'RR-WORK', valueAr: 'متطلبات عمل', valueEn: 'Work Requirements' },
  // أنواع الإجراءات
  { category: 'action_type', code: 'AT-HIRE', valueAr: 'تعيين', valueEn: 'Hire' },
  { category: 'action_type', code: 'AT-PROMOTE', valueAr: 'ترقية', valueEn: 'Promotion' },
  { category: 'action_type', code: 'AT-TRANSFER', valueAr: 'نقل/تحويل', valueEn: 'Transfer' },
  { category: 'action_type', code: 'AT-SUSPEND', valueAr: 'إيقاف', valueEn: 'Suspension' },
  { category: 'action_type', code: 'AT-TERMINATE', valueAr: 'إنهاء خدمة', valueEn: 'Termination' },
  { category: 'action_type', code: 'AT-CONFIRM', valueAr: 'تثبيت', valueEn: 'Confirmation' },
  // نتائج الإجراءات
  { category: 'action_result', code: 'AR-SUCCESS', valueAr: 'تم بنجاح', valueEn: 'Succeeded' },
  { category: 'action_result', code: 'AR-PENDING', valueAr: 'قيد المراجعة', valueEn: 'Under Review' },
  { category: 'action_result', code: 'AR-REJECTED', valueAr: 'مرفوض', valueEn: 'Rejected' },
  { category: 'action_result', code: 'AR-POSTPONED', valueAr: 'مؤجل', valueEn: 'Postponed' },
  // أنواع التغيرات على قوى
  { category: 'qiwa_change_type', code: 'QC-DATA', valueAr: 'تغيير بيانات موظف', valueEn: 'Employee Data Change' },
  { category: 'qiwa_change_type', code: 'QC-CONTRACT', valueAr: 'توثيق عقد', valueEn: 'Contract Authentication' },
  { category: 'qiwa_change_type', code: 'QC-TRANSFER', valueAr: 'نقل خدمات', valueEn: 'Service Transfer' },
  { category: 'qiwa_change_type', code: 'QC-TERMINATE', valueAr: 'إنهاء علاقة عمل', valueEn: 'Work Relation End' },
  { category: 'qiwa_change_type', code: 'QC-INQUIRY', valueAr: 'استعلام عن موظف', valueEn: 'Employee Inquiry' },
  // أنواع التصنيف
  { category: 'classification_type', code: 'CT-SKILL', valueAr: 'تصنيف مهاري', valueEn: 'Skill Classification' },
  { category: 'classification_type', code: 'CT-PROF', valueAr: 'تصنيف مهني (سعودي)', valueEn: 'Saudi Prof. Classification' },
  { category: 'classification_type', code: 'CT-INTL', valueAr: 'تصنيف دولي ISCO', valueEn: 'ISCO Classification' },
  // الجهات
  { category: 'entity', code: 'EN-QIWA', valueAr: 'منصة قوى', valueEn: 'Qiwa Platform' },
  { category: 'entity', code: 'EN-MOL', valueAr: 'مكتب العمل', valueEn: 'Labor Office' },
  { category: 'entity', code: 'EN-JAWAZAT', valueAr: 'المديرية العامة للجوازات', valueEn: 'Passports (Jawazat)' },
  { category: 'entity', code: 'EN-GOSI', valueAr: 'التأمينات الاجتماعية', valueEn: 'GOSI' },
  { category: 'entity', code: 'EN-MUQEEM', valueAr: 'منصة مقيم', valueEn: 'Muqeem' },
  { category: 'entity', code: 'EN-ABSHER', valueAr: 'أبشر', valueEn: 'Absher' },
  { category: 'entity', code: 'EN-COUNCIL', valueAr: 'مجلس التأمين الصحي', valueEn: 'Health Insurance Council' },
];

/** مالكو/معتمدو مجموعات المعادلات الـ 11 من التعليمات */
const FORMULA_GOVERNANCE = {
  salary_financial: { ownerRoles: ['payroll_officer'], approverRoles: ['hr_director', 'finance_manager'] }, // رواتب/إجمالي/صافي/إضافي
  eos:              { ownerRoles: ['payroll_officer'], approverRoles: ['finance_manager'] },                // نهاية الخدمة
  service:          { ownerRoles: ['sysadmin'],        approverRoles: [] },                                 // مدة الخدمة ثابتة
  leave:            { ownerRoles: ['hr_specialist'],   approverRoles: ['hr_director'] },                    // الإجازات
  attendance:       { ownerRoles: ['hr_specialist'],   approverRoles: ['hr_director'] },                    // تأخر/غياب/حضور
  overtime:         { ownerRoles: ['payroll_officer'], approverRoles: ['finance_manager'] },                // إضافي 150/200
  cost:             { ownerRoles: ['payroll_officer'], approverRoles: ['finance_manager'] },                // تكلفة الموظف
  kpi:              { ownerRoles: ['sysadmin'],        approverRoles: ['hr_director'] },                    // KPIs
};

// ربط كل معادلة F01..F32 بمجموعة حوكمتها
const FORMULA_GROUP = {
  F01: 'salary_financial', F02: 'salary_financial', F03: 'salary_financial', F04: 'salary_financial', F05: 'salary_financial',
  F06: 'eos', F07: 'cost', F08: 'leave', F09: 'attendance', F10: 'attendance', F11: 'overtime', F12: 'overtime', F13: 'attendance',
  F14: 'service', F15: 'service', F16: 'service', F17: 'service', F18: 'service', F19: 'service',
  F20: 'leave', F21: 'leave', F22: 'leave', F23: 'leave', F24: 'leave', F25: 'eos',
  F26: 'kpi', F27: 'kpi', F28: 'kpi', F29: 'kpi', F30: 'kpi', F31: 'kpi', F32: 'kpi',
};

const BRAND_SETTINGS = [
  { key: 'org.name_ar', value: 'شركة الناضج' },
  { key: 'org.name_en', value: 'Alnadij Company' },
  { key: 'org.brand_ar', value: 'الناضج' },
  { key: 'org.brand_en', value: 'Alnadij' },
  { key: 'org.full_name_ar', value: 'شركة الناضج — منصة إدارة الموارد البشرية' },
  { key: 'org.vision_ar', value: 'أن نكون الشركة الرائدة في حوكمة الموارد البشرية بالمملكة' },
];

async function seedGovernance({ prisma, users, employees, positions, departments }) {
  // 1) مصفوفة الفئات الـ 21
  console.log('[seed-gov] lookup categories (21)…');
  for (const c of LOOKUP_CATEGORIES) {
    await prisma.lookupCategory.create({ data: c });
  }

  // 2) قيم القوائم الجديدة
  console.log('[seed-gov] new lookup values…');
  for (const v of NEW_LOOKUP_VALUES) {
    await prisma.lookup.create({ data: v });
  }

  // 3) تعريفات المعادلات الـ 32 مع حوكمتها
  console.log('[seed-gov] formula definitions (32)…');
  for (const def of seedDefinitions()) {
    const group = FORMULA_GROUP[def.code] || 'service';
    const govDef = FORMULA_GOVERNANCE[group];
    await prisma.formulaDefinition.create({
      data: {
        code: def.code,
        category: def.category,
        nameAr: def.nameAr,
        nameEn: def.nameEn,
        expressionAr: def.expressionAr,
        variablesJson: def.variables,
        exampleJson: def.example,
        ownerRoles: govDef.ownerRoles,
        approverRoles: govDef.approverRoles,
        requiresCeo: false,
        notes: `مجموعة: ${group}`,
      },
    });
  }
  // هيكل الرواتب بالكامل (F01) يتطلب CEO ضمن سلسلته — نمثله بعلم مستقل على F01
  await prisma.formulaDefinition.update({
    where: { code: 'F01' },
    data: { requiresCeo: true, approverRoles: ['hr_director', 'finance_manager', 'ceo'], notes: 'هيكل الرواتب — قرار استراتيجي يتطلب CEO' },
  });

  // 4) أقسام تتبع الإدارات
  console.log('[seed-gov] sections…');
  const deptList = await prisma.department.findMany({ take: 6 });
  const SECTIONS = [
    { code: 'SEC-REC', nameAr: 'قسم الاستقطاب', deptCode: 'HR' },
    { code: 'SEC-PAY', nameAr: 'قسم الرواتب', deptCode: 'HR' },
    { code: 'SEC-REL', nameAr: 'قسم علاقات الموظفين', deptCode: 'HR' },
    { code: 'SEC-ACC', nameAr: 'قسم الحسابات', deptCode: 'FIN' },
    { code: 'SEC-BUD', nameAr: 'قسم الميزانية', deptCode: 'FIN' },
    { code: 'SEC-ITD', nameAr: 'قسم تطوير الأنظمة', deptCode: 'IT' },
  ];
  const sections = {};
  for (const s of SECTIONS) {
    const dept = deptList.find((d) => d.code === s.deptCode);
    if (!dept) continue;
    sections[s.code] = await prisma.section.create({
      data: { code: s.code, nameAr: s.nameAr, nameEn: s.code, deptId: dept.id },
    });
  }

  // 5) عقود للموظفين النشطين (من بياناتهم الحالية)
  console.log('[seed-gov] contracts…');
  const activeEmps = await prisma.employee.findMany({ where: { deletedAt: null }, take: 25 });
  for (const e of activeEmps) {
    const start = e.hireDate || new Date();
    const end = e.contractEndDate || new Date(start.getTime() + 365 * 24 * 3600 * 1000);
    await prisma.contract.create({
      data: {
        employeeId: e.id,
        contractNo: `CON-${e.employeeNumber}`,
        type: e.contractType || 'full_time',
        startDate: start,
        endDate: end,
        basicSalary: e.salary || 0,
        housing: e.housingAllowance || 0,
        transport: e.transportAllowance || 0,
        otherAllowances: e.otherAllowances || 0,
        status: 'active',
      },
    });
  }

  // 6) تحويلان + ترقية + طلبا قوى (بيانات تجريبية)
  console.log('[seed-gov] transfers/promotions/qiwa samples…');
  const emps = activeEmps.slice(0, 4);
  if (emps[0]) {
    await prisma.transfer.create({
      data: {
        employeeId: emps[0].id,
        fromBranchId: emps[0].branchId, fromDeptId: emps[0].deptId, fromPositionId: emps[0].positionId,
        toBranchId: emps[1]?.branchId || emps[0].branchId, toDeptId: emps[1]?.deptId || emps[0].deptId, toPositionId: emps[0].positionId,
        transferDate: new Date(), memo: 'تحويل تنظيمي', status: 'executed', executedAt: new Date(),
        requestedBy: users['hrmgr']?.id, approvedBy: users['hrdir']?.id,
      },
    });
  }
  if (emps[1]) {
    await prisma.promotion.create({
      data: {
        employeeId: emps[1].id,
        fromPositionId: emps[1].positionId, toPositionId: emps[2]?.positionId || emps[1].positionId,
        fromCategory: 'JC-PRO', toCategory: 'JC-MGR',
        fromSalary: emps[1].salary, toSalary: Math.round((Number(emps[1].salary) || 0) * 1.15),
        effectiveDate: new Date(), reason: 'تقييم أداء متميز', status: 'applied', appliedAt: new Date(),
        proposedBy: users['manager']?.id, approvedBy: users['hrdir']?.id,
      },
    });
  }
  if (emps[2]) {
    await prisma.qiwaRequest.create({
      data: {
        requestNo: `QW-${new Date().getFullYear()}-00001`,
        employeeId: emps[2].id, changeType: 'QC-CONTRACT', status: 'completed',
        payloadJson: { contractNo: `CON-${emps[2].employeeNumber}` },
        responseJson: { simulated: true, qiwaRef: 'QW-REF-1001' },
        raisedBy: users['hrmgr']?.id, raisedAt: new Date(), completedAt: new Date(),
      },
    });
  }
  if (emps[3]) {
    await prisma.qiwaRequest.create({
      data: {
        requestNo: `QW-${new Date().getFullYear()}-00002`,
        employeeId: emps[3].id, changeType: 'QC-DATA', status: 'raised',
        payloadJson: { field: 'nationality' },
        raisedBy: users['hrmgr']?.id, raisedAt: new Date(),
      },
    });
  }

  // 7) هوية الناضج
  console.log('[seed-gov] Alnadij brand settings…');
  for (const s of BRAND_SETTINGS) {
    await prisma.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  return { sections };
}

module.exports = { seedGovernance, LOOKUP_CATEGORIES, FORMULA_GOVERNANCE, BRAND_SETTINGS };
