/**
 * Permission catalog - 14 roles, ~215 permissions.
 * Based on spec: انواع المستخدمين وصلاحياتهم + مصفوفة الحوكمة (الوثائق الثلاث).
 */

const ROLES = [
  { code: 'employee',           nameAr: 'موظف',                  nameEn: 'Employee' },
  { code: 'line_manager',       nameAr: 'مدير مباشر',            nameEn: 'Line Manager' },
  { code: 'hr_specialist',      nameAr: 'أخصائي موارد بشرية',    nameEn: 'HR Specialist' },
  { code: 'recruiter',          nameAr: 'مسؤول توظيف',           nameEn: 'Recruiter' },
  { code: 'payroll_officer',    nameAr: 'مسؤول رواتب',           nameEn: 'Payroll Officer' },
  { code: 'ld_specialist',      nameAr: 'مسؤول تعلم وتطوير',     nameEn: 'L&D Specialist' },
  { code: 'hr_director',        nameAr: 'مدير الموارد البشرية',  nameEn: 'HR Director' },
  { code: 'finance_manager',    nameAr: 'المدير المالي',          nameEn: 'Finance Manager' },
  { code: 'ceo',                nameAr: 'المدير التنفيذي',        nameEn: 'CEO / Executive' },
  { code: 'auditor',            nameAr: 'مراقب داخلي',           nameEn: 'Auditor' },
  { code: 'sysadmin',           nameAr: 'مسؤول النظام',          nameEn: 'System Administrator' },
  { code: 'security_admin',     nameAr: 'مسؤول الأمن السيبراني', nameEn: 'Security Admin' },
  { code: 'knowledge_keeper',   nameAr: 'أمين المعرفة',          nameEn: 'Knowledge Keeper' },
  { code: 'compliance_officer', nameAr: 'مسؤول امتثال',          nameEn: 'Compliance Officer' },
];

/**
 * كل دور → قائمة صلاحياته.
 * مبنية حرفياً على ملف "انواع المستخدمين وصلاحياتهم".
 */
const ROLE_PERMS = {
  // ============ 1. الموظف ============
  employee: [
    'self.profile.read', 'self.profile.write',
    'self.payslip.read', 'self.leave.read', 'self.attendance.read',
    'requests.create', 'requests.read.self',
    'feedback.write.peer',
    'knowledge.doc.read', 'knowledge.policy.read',
    'lnd.catalog.read', 'lnd.enroll.self',
    'surveys.respond',
    'grievances.create', 'grievances.read.self',
    // شفافية المعادلات — الموظف يقرأ كيف تُحسب مستحقاته
    'formulas.read',
  ],

  // ============ 2. المدير المباشر (كل صلاحيات الموظف +) ============
  line_manager: [
    'self.profile.read', 'self.profile.write', 'self.payslip.read', 'self.leave.read', 'self.attendance.read',
    'requests.create', 'requests.read.self', 'feedback.write.peer',
    'knowledge.doc.read', 'knowledge.policy.read', 'lnd.catalog.read', 'lnd.enroll.self', 'surveys.respond',
    'grievances.create', 'grievances.read.self',
    // إدارة الفريق
    'team.employees.read', 'team.salary.read',
    'requests.read.team', 'requests.approve',
    'leaves.approve', 'overtime.approve', 'attendance.incidents.write',
    'perf.review.write', 'perf.okr.write', 'idp.read', 'idp.write',
    'talent.nominate', 'bonuses.nominate',
    'stay_interview.write',
  ],

  // ============ 3. أخصائي HR ============
  hr_specialist: [
    'self.profile.read', 'self.profile.write', 'requests.create', 'requests.read.self', 'surveys.respond',
    'knowledge.doc.read', 'knowledge.policy.read',
    // إدارة بيانات الموظفين كاملة
    'hr.employee.read', 'hr.employee.write', 'hr.employee.read.salary',
    'hr.org.read', 'hr.position.read', 'hr.history.read',
    'hr.documents.read', 'hr.documents.write',
    'hr.certificates.issue',
    // التوظيف
    'lifecycle.posting.read', 'lifecycle.posting.write',
    'lifecycle.candidate.read', 'lifecycle.candidate.write',
    'lifecycle.application.read', 'lifecycle.application.write',
    'lifecycle.interview.write', 'lifecycle.offer.write',
    'lifecycle.onboarding.read', 'lifecycle.onboarding.write',
    'lifecycle.exit.read', 'lifecycle.exit.write',
    'probation.read', 'probation.write',
    // الإجازات والحضور والورديات
    'leaves.read', 'leaves.approve.hr', 'leaves.balances.write',
    'attendance.read', 'attendance.write',
    'shifts.read', 'shifts.write',
    // رواتب (مسودات قبل الاعتماد)
    'payroll.read', 'payroll.prepare',
    // التأمينات والتأمين الصحي
    'gosi.read', 'gosi.write', 'insurance.read', 'insurance.write',
    // سياسات
    'knowledge.policy.write',
    'requests.read.all', 'requests.process',
    // الحوكمة — أخصائي HR مالك معظم الجداول الفرعية (يقترح)
    'governance.read', 'governance.propose',
    'formulas.read', 'formulas.propose',
    'qiwa.read', 'qiwa.write',
  ],

  // ============ 4. مسؤول التوظيف ============
  recruiter: [
    'self.profile.read', 'self.profile.write', 'requests.create', 'requests.read.self', 'surveys.respond',
    'knowledge.doc.read', 'knowledge.policy.read',
    'lifecycle.posting.read', 'lifecycle.posting.write',
    'lifecycle.candidate.read', 'lifecycle.candidate.write',
    'lifecycle.application.read', 'lifecycle.application.write',
    'lifecycle.interview.write', 'lifecycle.offer.write',
    'lifecycle.pipeline.read',
    // إجراءات الوافدين
    'expat.visa.read', 'expat.visa.write',
    'expat.iqama.read', 'expat.iqama.write',
    'expat.gamca.write', 'expat.attestation.write',
    'expat.kafala.read', 'expat.kafala.write',
    'lifecycle.exit.read', // إخلاء الطرف
    'reports.recruitment.read',
  ],

  // ============ 5. مسؤول الرواتب ============
  payroll_officer: [
    'self.profile.read', 'self.profile.write', 'requests.create', 'requests.read.self', 'surveys.respond',
    'knowledge.doc.read', 'knowledge.policy.read',
    'hr.employee.read', 'hr.employee.read.salary',
    'payroll.read', 'payroll.prepare', 'payroll.review',
    'payroll.items.write', 'payroll.payslips.read',
    'wps.read', 'wps.write',
    'loans.read', 'loans.write', 'loans.approve',
    'bonuses.read', 'bonuses.process',
    'eos.calculate', 'eos.read',
    'overtime.read',
    'gosi.read',
    'reports.payroll.read',
    'banks.reconcile',
    // الحوكمة — محاسب الرواتب مالك معادلات الرواتب (يقترح)
    'governance.read', 'governance.propose',
    'formulas.read', 'formulas.propose',
  ],

  // ============ 6. مسؤول التعلم ============
  ld_specialist: [
    'self.profile.read', 'self.profile.write', 'requests.create', 'requests.read.self', 'surveys.respond',
    'knowledge.doc.read', 'knowledge.policy.read',
    'hr.employee.read',
    'lnd.catalog.read', 'lnd.catalog.write',
    'lnd.sessions.read', 'lnd.sessions.write',
    'lnd.enroll.read', 'lnd.enroll.write',
    'lnd.eval.write',
    'idp.read', 'idp.write',
    'lnd.certificates.read', 'lnd.certificates.write',
    'lnd.mentoring.read', 'lnd.mentoring.write',
    'reports.lnd.read',
  ],

  // ============ 7. مدير الموارد البشرية ============
  hr_director: [
    'self.profile.read', 'self.profile.write', 'requests.create', 'requests.read.self', 'surveys.respond',
    // كل صلاحيات أخصائي HR
    'hr.employee.read', 'hr.employee.write', 'hr.employee.read.salary',
    'hr.org.read', 'hr.org.write', 'hr.position.read', 'hr.position.write', 'hr.history.read',
    'hr.documents.read', 'hr.documents.write', 'hr.certificates.issue',
    'lifecycle.posting.read', 'lifecycle.posting.write',
    'lifecycle.candidate.read', 'lifecycle.candidate.write',
    'lifecycle.application.read', 'lifecycle.application.write',
    'lifecycle.interview.write', 'lifecycle.offer.write',
    'lifecycle.onboarding.read', 'lifecycle.onboarding.write',
    'lifecycle.exit.read', 'lifecycle.exit.write',
    'probation.read', 'probation.write',
    'leaves.read', 'leaves.approve.hr', 'leaves.balances.write',
    'attendance.read', 'attendance.write',
    'shifts.read', 'shifts.write',
    'payroll.read', 'payroll.prepare', 'payroll.approve',
    'gosi.read', 'gosi.write', 'insurance.read', 'insurance.write',
    'knowledge.doc.read', 'knowledge.doc.write', 'knowledge.doc.publish',
    'knowledge.policy.read', 'knowledge.policy.write',
    'knowledge.decision.read', 'knowledge.decision.write',
    'requests.read.all', 'requests.process',
    // اعتمادات حصرية
    'hiring.approve', 'termination.approve', 'promotion.approve', 'bonus.approve',
    'succession.read', 'succession.write', 'succession.approve',
    'perf.review.approve', 'pip.read', 'pip.write', 'pip.approve',
    'budget.manage',
    'grievances.read', 'grievances.resolve',
    'disciplinary.read', 'disciplinary.write', 'disciplinary.decide',
    'reports.hr.read',
    'workflow.def.read', 'workflow.instance.read', 'workflow.instance.approve',
    'expat.visa.read', 'expat.iqama.read', 'gosi.read',
    'maturity.read', 'fivewhys.read', 'fivewhys.write', 'risk.read',
    'roadmap.read', 'opex.kpi.read',
    'surveys.read', 'surveys.write',
    'stay_interview.read', 'stay_interview.write',
    'talent.hipo.read', 'talent.hipo.write',
    'retention.read', 'analytics.read',
    // الحوكمة — مدير HR معتمد رئيسي للجداول الفرعية والمعادلات
    'governance.read', 'governance.propose', 'governance.approve',
    'formulas.read', 'formulas.propose', 'formulas.approve',
    'policies.read', 'policies.propose',
    'qiwa.read', 'qiwa.write',
  ],

  // ============ 8. المدير المالي ============
  finance_manager: [
    'self.profile.read', 'self.profile.write', 'surveys.respond',
    'knowledge.doc.read', 'knowledge.policy.read',
    // قراءة مالية شاملة
    'hr.employee.read', 'hr.employee.read.salary', 'hr.org.read', 'hr.position.read',
    'leaves.read', 'attendance.read', 'overtime.read',
    // الرواتب والمستحقات — الاعتماد المالي
    'payroll.read', 'payroll.review', 'payroll.approve', 'payroll.payslips.read',
    'loans.read', 'loans.approve',
    'bonuses.read', 'bonuses.approve',
    'eos.read', 'eos.calculate',
    'wps.read', 'gosi.read', 'insurance.read',
    'banks.reconcile',
    // الميزانية
    'budget.manage', 'budget.approve',
    // التقارير والتحليلات المالية
    'reports.payroll.read', 'reports.hr.read', 'analytics.read',
    // الحوكمة — اعتماد المعادلات المالية والقوائم المرتبطة بالرواتب
    'governance.read', 'governance.approve',
    'formulas.read', 'formulas.approve',
    'policies.read', 'policies.propose',
    'qiwa.read',
  ],

  // ============ 9. المدير التنفيذي (كل صلاحيات مدير HR +) ============
  ceo: [
    'self.profile.read', 'self.profile.write', 'surveys.respond',
    // قراءة شاملة
    'hr.employee.read', 'hr.employee.read.salary', 'hr.org.read', 'hr.position.read', 'hr.history.read',
    'lifecycle.posting.read', 'lifecycle.candidate.read', 'lifecycle.application.read',
    'lifecycle.onboarding.read', 'lifecycle.exit.read',
    'leaves.read', 'attendance.read', 'payroll.read', 'gosi.read', 'insurance.read',
    'knowledge.doc.read', 'knowledge.policy.read', 'knowledge.decision.read', 'knowledge.decision.write',
    'requests.read.all', 'reports.hr.read', 'analytics.read',
    'maturity.read', 'fivewhys.read', 'risk.read', 'risk.write',
    'roadmap.read', 'roadmap.write', 'opex.kpi.read', 'opex.kpi.write',
    'surveys.read', 'stay_interview.read', 'talent.hipo.read',
    'succession.read', 'perf.review.approve', 'pip.read',
    'grievances.read', 'disciplinary.read', 'retention.read',
    'workflow.def.read', 'workflow.instance.read', 'workflow.instance.approve',
    'expat.visa.read', 'expat.iqama.read',
    'probation.read', 'idp.read',
    // اعتمادات استراتيجية حصرية
    'budget.approve', 'leadership.appoint', 'strategy.approve',
    'saudization.approve', 'exceptions.approve', 'contracts.strategic.approve',
    'hiring.approve', 'termination.approve', 'promotion.approve', 'bonus.approve',
    'payroll.approve',
    // الحوكمة — CEO يعتمد هيكل الرواتب والتغييرات الاستراتيجية
    'governance.read', 'governance.approve',
    'formulas.read', 'formulas.approve',
    'policies.read',
    'qiwa.read',
  ],

  // ============ 9. المراقب الداخلي (قراءة فقط لكل شيء) ============
  auditor: [
    'self.profile.read',
    'hr.employee.read', 'hr.employee.read.salary', 'hr.org.read', 'hr.position.read', 'hr.history.read',
    'hr.documents.read',
    'lifecycle.posting.read', 'lifecycle.candidate.read', 'lifecycle.application.read', 'lifecycle.exit.read',
    'leaves.read', 'attendance.read', 'overtime.read',
    'payroll.read', 'payroll.payslips.read', 'loans.read', 'bonuses.read', 'eos.read', 'wps.read',
    'gosi.read', 'insurance.read',
    'knowledge.doc.read', 'knowledge.policy.read', 'knowledge.decision.read',
    'requests.read.all',
    'perf.review.read', 'pip.read', 'idp.read',
    'lnd.catalog.read', 'lnd.sessions.read', 'lnd.enroll.read',
    'succession.read', 'talent.hipo.read', 'surveys.read', 'stay_interview.read', 'retention.read',
    'grievances.read', 'disciplinary.read',
    'expat.visa.read', 'expat.iqama.read', 'expat.kafala.read',
    'probation.read',
    'compliance.rule.read', 'compliance.violation.read', 'compliance.expiry.read',
    'nitaqat.read', 'pdpl.read', 'regulatory.read',
    'maturity.read', 'fivewhys.read', 'risk.read', 'roadmap.read', 'opex.kpi.read',
    'analytics.read', 'reports.hr.read', 'reports.payroll.read', 'reports.recruitment.read', 'reports.lnd.read',
    'admin.audit.read', 'admin.user.read', 'admin.lookup.read',
    'security.events.read',
    // الحوكمة — المراقب يقرأ كل شيء
    'governance.read', 'formulas.read', 'qiwa.read',
  ],

  // ============ 10. مسؤول النظام 👑 ============
  sysadmin: ['*'],

  // ============ 11. مسؤول الأمن السيبراني ============
  security_admin: [
    'self.profile.read', 'self.profile.write',
    'security.events.read', 'security.events.write',
    'security.alerts.manage',
    'security.sessions.read', 'security.sessions.revoke',
    'security.login_attempts.read', 'security.locks.manage',
    'security.mfa.manage',
    'security.dlp.manage', 'security.classification.manage',
    'security.vulnerabilities.manage', 'security.pentest.manage',
    'admin.audit.read', 'admin.user.read',
  ],

  // ============ 12. أمين المعرفة — دور ضيق: إدارة الوثائق والسياسات والقرارات فقط ============
  knowledge_keeper: [
    'self.profile.read', 'self.profile.write',
    'requests.create', 'requests.read.self',
    'knowledge.doc.read', 'knowledge.doc.write', 'knowledge.doc.publish',
    'knowledge.policy.read', 'knowledge.policy.write',
    'knowledge.decision.read', 'knowledge.decision.write',
  ],

  // ============ 13. مسؤول الامتثال ============
  compliance_officer: [
    'self.profile.read', 'self.profile.write',
    'compliance.rule.read', 'compliance.rule.write',
    'compliance.violation.read', 'compliance.violation.resolve',
    'compliance.expiry.read',
    'nitaqat.read', 'nitaqat.write',
    'wps.read', 'pdpl.read', 'pdpl.write',
    'regulatory.read', 'regulatory.write',
    'risk.read', 'risk.write',
    'gosi.read',
    'hr.employee.read',
    'maturity.read',
    'reports.hr.read',
    // الحوكمة — مسؤول الامتثال يؤدي دور Legal في الاعتمادات القانونية
    'governance.read', 'governance.approve',
    'formulas.read', 'qiwa.read',
  ],
};

// دور محلل البيانات أُدمج في المراقب الداخلي (auditor) — يُبقى كاسم بديل للتوافق مع الحسابات القديمة حتى إعادة تعيينها
ROLE_PERMS.data_analyst = ROLE_PERMS.auditor;

// ============================================================
// Permission catalog grouped by module (للعرض في صفحة الأدوار)
// ============================================================
const PERMISSIONS = {
  self: {
    nameAr: 'الخدمة الذاتية', nameEn: 'Self Service',
    actions: {
      'profile.read': 'قراءة الملف الشخصي', 'profile.write': 'تعديل الملف',
      'payslip.read': 'قراءة قسيمة الراتب', 'leave.read': 'قراءة إجازاته', 'attendance.read': 'قراءة حضوره',
    },
  },
  team: {
    nameAr: 'الفريق', nameEn: 'Team',
    actions: { 'employees.read': 'قراءة بيانات الفريق', 'salary.read': 'قراءة رواتب الفريق' },
  },
  requests: {
    nameAr: 'مركز الطلبات', nameEn: 'Requests Center',
    actions: {
      'create': 'تقديم طلب', 'read.self': 'قراءة طلباته', 'read.team': 'قراءة طلبات الفريق',
      'read.all': 'قراءة كل الطلبات', 'approve': 'اعتماد كمدير', 'process': 'معالجة HR',
    },
  },
  hr: {
    nameAr: 'الموارد البشرية', nameEn: 'HR Core',
    actions: {
      'employee.read': 'قراءة الموظفين', 'employee.write': 'تعديل الموظفين', 'employee.delete': 'حذف موظف',
      'employee.read.salary': 'قراءة الرواتب', 'employee.read.self': 'قراءة بياناته',
      'org.read': 'قراءة الهيكل', 'org.write': 'تعديل الهيكل',
      'position.read': 'قراءة المناصب', 'position.write': 'تعديل المناصب',
      'history.read': 'سجل التغييرات', 'documents.read': 'قراءة الوثائق', 'documents.write': 'إدارة الوثائق',
      'certificates.issue': 'إصدار إفادات وشهادات',
    },
  },
  lifecycle: {
    nameAr: 'دورة حياة الموظف', nameEn: 'Lifecycle',
    actions: {
      'posting.read': 'قراءة الوظائف', 'posting.write': 'إدارة الإعلانات',
      'candidate.read': 'قراءة المرشحين', 'candidate.write': 'إدارة المرشحين',
      'application.read': 'قراءة الطلبات', 'application.write': 'إدارة الطلبات',
      'interview.write': 'تنسيق المقابلات', 'offer.write': 'إصدار العروض',
      'onboarding.read': 'قراءة التأهيل', 'onboarding.write': 'إدارة التأهيل',
      'exit.read': 'قراءة الخروج', 'exit.write': 'إجراءات الخروج',
      'pipeline.read': 'خط أنابيب المرشحين',
    },
  },
  probation: { nameAr: 'فترة التجربة', nameEn: 'Probation', actions: { 'read': 'قراءة', 'write': 'إدارة تقييمات التجربة' } },
  leaves: {
    nameAr: 'الإجازات', nameEn: 'Leaves',
    actions: {
      'read': 'قراءة الطلبات', 'approve': 'اعتماد كمدير', 'approve.hr': 'اعتماد HR', 'balances.write': 'إدارة الأرصدة',
    },
  },
  attendance: {
    nameAr: 'الحضور', nameEn: 'Attendance',
    actions: { 'read': 'قراءة السجلات', 'write': 'تسجيل/تعديل', 'incidents.write': 'معالجة تأخر/غياب' },
  },
  shifts: {
    nameAr: 'الورديات', nameEn: 'Shifts',
    actions: { 'read': 'قراءة الورديات والتعيينات', 'write': 'إدارة الورديات والتعيينات' },
  },
  overtime: { nameAr: 'العمل الإضافي', nameEn: 'Overtime', actions: { 'read': 'قراءة', 'approve': 'اعتماد' } },
  payroll: {
    nameAr: 'الرواتب', nameEn: 'Payroll',
    actions: {
      'read': 'قراءة المسيرات', 'prepare': 'إعداد المسير', 'review': 'مراجعة', 'approve': 'اعتماد الصرف',
      'items.write': 'تعديل البنود', 'payslips.read': 'قراءة القسائم',
    },
  },
  loans: { nameAr: 'السلف والقروض', nameEn: 'Loans', actions: { 'read': 'قراءة', 'write': 'إدارة', 'approve': 'اعتماد' } },
  bonuses: { nameAr: 'المكافآت', nameEn: 'Bonuses', actions: { 'read': 'قراءة', 'nominate': 'ترشيح', 'process': 'معالجة', 'approve': 'اعتماد' } },
  eos: { nameAr: 'نهاية الخدمة', nameEn: 'EOS', actions: { 'read': 'قراءة', 'calculate': 'حساب المكافأة' } },
  wps: { nameAr: 'حماية الأجور', nameEn: 'WPS', actions: { 'read': 'قراءة', 'write': 'توليد ورفع ملفات' } },
  gosi: { nameAr: 'التأمينات', nameEn: 'GOSI', actions: { 'read': 'قراءة', 'write': 'تسجيل/إدارة' } },
  insurance: { nameAr: 'التأمين الصحي', nameEn: 'Health Insurance', actions: { 'read': 'قراءة', 'write': 'إدارة الوثائق والأعضاء' } },
  perf: {
    nameAr: 'إدارة الأداء', nameEn: 'Performance',
    actions: { 'okr.write': 'إدارة الأهداف', 'review.read': 'قراءة التقييمات', 'review.write': 'كتابة التقييمات', 'review.approve': 'اعتماد نهائي' },
  },
  feedback: { nameAr: 'التغذية الراجعة', nameEn: 'Feedback', actions: { 'write.peer': 'تقييم الأقران' } },
  pip: { nameAr: 'خطط التحسين', nameEn: 'PIP', actions: { 'read': 'قراءة', 'write': 'إنشاء', 'approve': 'اعتماد' } },
  idp: { nameAr: 'خطط التطوير الفردية', nameEn: 'IDP', actions: { 'read': 'قراءة', 'write': 'إدارة' } },
  lnd: {
    nameAr: 'التعلم والتطوير', nameEn: 'L&D',
    actions: {
      'catalog.read': 'قراءة الكتالوج', 'catalog.write': 'إدارة الكتالوج',
      'sessions.read': 'قراءة الجلسات', 'sessions.write': 'جدولة البرامج',
      'enroll.self': 'الاشتراك', 'enroll.read': 'قراءة التسجيلات', 'enroll.write': 'تسجيل الموظفين',
      'eval.write': 'تقييم الأثر', 'certificates.read': 'قراءة الشهادات', 'certificates.write': 'إدارة الشهادات',
      'mentoring.read': 'قراءة الإرشاد', 'mentoring.write': 'إدارة الإرشاد',
    },
  },
  succession: { nameAr: 'التعاقب', nameEn: 'Succession', actions: { 'read': 'قراءة', 'write': 'إدارة الخطط', 'approve': 'اعتماد' } },
  talent: { nameAr: 'المواهب', nameEn: 'Talent', actions: { 'nominate': 'ترشيح', 'hipo.read': 'قراءة HiPo', 'hipo.write': 'إدارة HiPo' } },
  surveys: { nameAr: 'الاستطلاعات', nameEn: 'Surveys', actions: { 'respond': 'الإجابة', 'read': 'قراءة النتائج', 'write': 'إنشاء وإدارة' } },
  stay_interview: { nameAr: 'مقابلات البقاء', nameEn: 'Stay Interviews', actions: { 'read': 'قراءة', 'write': 'إجراء وتوثيق' } },
  retention: { nameAr: 'الاحتفاظ', nameEn: 'Retention', actions: { 'read': 'قراءة مؤشرات الاحتفاظ' } },
  grievances: {
    nameAr: 'التظلمات', nameEn: 'Grievances',
    actions: { 'create': 'تقديم شكوى', 'read.self': 'متابعة شكواه', 'read': 'قراءة الكل', 'resolve': 'حل التظلمات' },
  },
  disciplinary: {
    nameAr: 'الإجراءات التأديبية', nameEn: 'Disciplinary',
    actions: { 'read': 'قراءة', 'write': 'فتح قضية', 'decide': 'اتخاذ القرار' },
  },
  expat: {
    nameAr: 'شؤون المقيمين', nameEn: 'Expat Services',
    actions: {
      'visa.read': 'قراءة التأشيرات', 'visa.write': 'إصدار تأشيرات',
      'iqama.read': 'قراءة الإقامات', 'iqama.write': 'إدارة الإقامات',
      'gamca.write': 'تسجيل فحوصات', 'attestation.write': 'متابعة التوثيق',
      'kafala.read': 'قراءة نقل الكفالة', 'kafala.write': 'إدارة نقل الكفالة',
      'huroob.write': 'إدارة بلاغات الهروب',
    },
  },
  compliance: {
    nameAr: 'الامتثال', nameEn: 'Compliance',
    actions: {
      'rule.read': 'قراءة القواعد', 'rule.write': 'إدارة القواعد',
      'violation.read': 'قراءة المخالفات', 'violation.resolve': 'حل المخالفات', 'expiry.read': 'تنبيهات الانتهاء',
    },
  },
  nitaqat: { nameAr: 'نطاقات', nameEn: 'Nitaqat', actions: { 'read': 'قراءة', 'write': 'تسجيل اللقطات' } },
  pdpl: { nameAr: 'حماية البيانات', nameEn: 'PDPL', actions: { 'read': 'قراءة', 'write': 'إدارة الامتثال' } },
  regulatory: { nameAr: 'التقارير التنظيمية', nameEn: 'Regulatory Reports', actions: { 'read': 'قراءة', 'write': 'إعداد وتقديم' } },
  knowledge: {
    nameAr: 'إدارة المعرفة', nameEn: 'Knowledge',
    actions: {
      'doc.read': 'قراءة الوثائق', 'doc.write': 'كتابة الوثائق', 'doc.publish': 'نشر الوثائق',
      'decision.read': 'قراءة القرارات', 'decision.write': 'كتابة القرارات',
      'policy.read': 'قراءة السياسات', 'policy.write': 'تعديل السياسات',
    },
  },
  workflow: {
    nameAr: 'سير العمل', nameEn: 'Workflow',
    actions: {
      'def.read': 'قراءة التعريفات', 'def.write': 'إدارة التعريفات',
      'instance.read': 'قراءة الطلبات', 'instance.approve': 'اعتماد', 'instance.create': 'بدء طلب',
    },
  },
  maturity: { nameAr: 'قياس النضج', nameEn: 'Maturity', actions: { 'read': 'قراءة', 'write': 'تقييم' } },
  fivewhys: { nameAr: '5 Whys', nameEn: '5 Whys', actions: { 'read': 'قراءة', 'write': 'كتابة' } },
  risk: { nameAr: 'المخاطر', nameEn: 'Risks', actions: { 'read': 'قراءة', 'write': 'إدارة' } },
  roadmap: { nameAr: 'خارطة الطريق', nameEn: 'Roadmap', actions: { 'read': 'قراءة', 'write': 'تعديل' } },
  opex: { nameAr: 'التميز التشغيلي', nameEn: 'OpEx', actions: { 'kpi.read': 'قراءة المؤشرات', 'kpi.write': 'إدارة المؤشرات' } },
  analytics: {
    nameAr: 'التحليلات', nameEn: 'Analytics',
    actions: {
      'read': 'قراءة', 'custom.write': 'تقارير مخصصة', 'dashboards.write': 'لوحات معلومات',
      'predict': 'تنبؤات', 'export': 'تصدير',
    },
  },
  reports: {
    nameAr: 'التقارير', nameEn: 'Reports',
    actions: { 'hr.read': 'تقارير HR', 'payroll.read': 'تقارير الرواتب', 'recruitment.read': 'تقارير التوظيف', 'lnd.read': 'تقارير التدريب' },
  },
  hiring: { nameAr: 'اعتماد التوظيف', nameEn: 'Hiring Approval', actions: { 'approve': 'اعتماد قرارات التوظيف' } },
  termination: { nameAr: 'اعتماد الإنهاء', nameEn: 'Termination Approval', actions: { 'approve': 'اعتماد إنهاء الخدمة' } },
  promotion: { nameAr: 'اعتماد الترقيات', nameEn: 'Promotion Approval', actions: { 'approve': 'اعتماد الترقيات' } },
  bonus: { nameAr: 'اعتماد المكافآت', nameEn: 'Bonus Approval', actions: { 'approve': 'اعتماد المكافآت' } },
  budget: { nameAr: 'الميزانية', nameEn: 'Budget', actions: { 'manage': 'إدارة الميزانية', 'approve': 'اعتماد الميزانية الشاملة' } },
  leadership: { nameAr: 'المناصب القيادية', nameEn: 'Leadership', actions: { 'appoint': 'اعتماد التعيينات القيادية' } },
  strategy: { nameAr: 'الاستراتيجية', nameEn: 'Strategy', actions: { 'approve': 'اعتماد القرارات الاستراتيجية' } },
  saudization: { nameAr: 'التوطين', nameEn: 'Saudization', actions: { 'approve': 'اعتماد خطط التوطين' } },
  exceptions: { nameAr: 'الاستثناءات', nameEn: 'Exceptions', actions: { 'approve': 'اعتماد الاستثناءات الكبرى' } },
  contracts: { nameAr: 'العقود الاستراتيجية', nameEn: 'Strategic Contracts', actions: { 'strategic.approve': 'اعتماد العقود والشراكات' } },
  banks: { nameAr: 'البنوك', nameEn: 'Banks', actions: { 'reconcile': 'مطابقة الأرصدة البنكية' } },
  security: {
    nameAr: 'الأمن السيبراني', nameEn: 'Security',
    actions: {
      'events.read': 'قراءة الأحداث الأمنية', 'events.write': 'تسجيل أحداث',
      'alerts.manage': 'إدارة التنبيهات', 'sessions.read': 'قراءة الجلسات', 'sessions.revoke': 'إنهاء جلسات',
      'login_attempts.read': 'محاولات الدخول', 'locks.manage': 'إدارة الأقفال', 'mfa.manage': 'إدارة MFA',
      'dlp.manage': 'سياسات DLP', 'classification.manage': 'تصنيف البيانات',
      'vulnerabilities.manage': 'إدارة الثغرات', 'pentest.manage': 'اختبار الاختراق',
    },
  },
  admin: {
    nameAr: 'إدارة النظام', nameEn: 'System Administration',
    actions: {
      'user.read': 'قراءة المستخدمين', 'user.write': 'إدارة المستخدمين',
      'role.read': 'قراءة الأدوار', 'role.write': 'إدارة الأدوار',
      'scope.write': 'إدارة النطاقات', 'lookup.read': 'قراءة القوائم', 'lookup.write': 'إدارة القوائم',
      'integration.read': 'قراءة التكاملات', 'integration.write': 'إدارة التكاملات',
      'audit.read': 'سجل التدقيق',
      'sessions.manage': 'إدارة الجلسات', 'softdelete.restore': 'استعادة المحذوف',
      'override': 'تجاوز الموافقات', 'backup.manage': 'النسخ الاحتياطية',
      'settings.write': 'الإعدادات العامة', 'maintenance.run': 'تنفيذ الصيانة',
      'workflow.simulate': 'محاكاة سير العمل', 'secrets.manage': 'إدارة الأسرار',
    },
  },
  governance: {
    nameAr: 'حوكمة القوائم والتغييرات', nameEn: 'Governance',
    actions: {
      'read': 'قراءة طلبات التغيير والسجل',
      'propose': 'اقتراح تغيير على القوائم/المعادلات',
      'approve': 'اعتماد طلبات التغيير',
    },
  },
  formulas: {
    nameAr: 'مركز المعادلات', nameEn: 'Formulas Center',
    actions: {
      'read': 'قراءة المعادلات ومحاكاتها (شفافية)',
      'propose': 'اقتراح تعديل معادلة',
      'approve': 'اعتماد تعديل معادلة',
    },
  },
  policies: {
    nameAr: 'مركز قواعد وسياسات العمل', nameEn: 'Policies Center',
    actions: {
      'read': 'قراءة معايير السياسات وقيمها',
      'propose': 'اقتراح تعديل معامل سياسة',
    },
  },
  qiwa: {
    nameAr: 'منصة قوى', nameEn: 'Qiwa',
    actions: { 'read': 'قراءة طلبات قوى', 'write': 'رفع ومعالجة طلبات قوى' },
  },
};

function listAllCodes() {
  const codes = [];
  for (const [module, def] of Object.entries(PERMISSIONS)) {
    for (const action of Object.keys(def.actions)) codes.push(`${module}.${action}`);
  }
  return codes;
}

// مسؤول النظام: صلاحيات صريحة كاملة من الكتالوج بدل wildcard '*' (مبدأ الامتياز الأدنى وقابلية التدقيق)
ROLE_PERMS.sysadmin = listAllCodes();

function getDef(code) {
  const [module, action] = code.split('.');
  return PERMISSIONS[module]?.actions?.[action] || null;
}

/** صلاحيات دور معين (مسؤول النظام يحصل على القائمة الصريحة الكاملة) */
function permissionsFor(roleCode) {
  return ROLE_PERMS[roleCode] || [];
}

module.exports = { ROLES, ROLE_PERMS, PERMISSIONS, listAllCodes, getDef, permissionsFor };