/**
 * HR Governance Platform - Comprehensive seed
 * Creates: 8 roles, 8 users, 3 regions, 8 branches, 12 departments, 25 positions,
 *          25 employees, 10 job postings, 30 candidates, 5 onboarding flows,
 *          15 knowledge documents, 5 decision records, 8 policies, 3 workflow defs,
 *          5 compliance rules, 15 risks (C01-C15), 52 roadmap items, 42 maturity dimensions,
 *          5 process KPIs, 4 Five Whys analyses, comprehensive lookups.
 *
 * Idempotent: wipes business data first, then re-injects.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ============================================================
// Permission catalog — 13 roles, ~150 permissions (from src/permissions.js)
// ============================================================
const { ROLES: ROLE_DEFS, permissionsFor } = require('../src/permissions');

// ============================================================
// Seed helpers
// ============================================================
function hi(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const parts = fmt.formatToParts(now);
  const dd = parts.find(p => p.type === 'day').value;
  const mm = parts.find(p => p.type === 'month').value;
  const yy = parts.find(p => p.type === 'year').value;
  return `${dd}/${mm}/${yy}H`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysAhead(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  console.log('[seed] wiping business data…');
  // Order matters due to FKs
  const tables = [
    'auditLog', 'userSession', 'userScope', 'securityEvent',
    'workflowStep', 'workflowInstance', 'workflowDefinition',
    'complianceViolation', 'complianceRule', 'documentExpiry',
    'maturityAssessment', 'maturityDimension',
    'fiveWhysAnalysis', 'processKPI',
    'roadmapItem', 'risk',
    'analyticsEvent',
    // المحركات الجديدة (الترتيب مهم بسبب FK)
    'surveyResponse', 'surveyQuestion', 'survey', 'stayInterview',
    'successionCandidate', 'successionPlan', 'hipoMember',
    'feedbackEntry', 'perfReview', 'keyResult', 'objective', 'perfCycle', 'pip',
    'enrollment', 'courseSession', 'course', 'certificate', 'idp', 'mentoringPair',
    'payrollItem', 'payrollRun', 'loan', 'bonus', 'eosCalculation', 'wpsFile',
    'leaveBalance', 'leaveRequest', 'leaveType', 'officialHoliday',
    'attendanceIncident', 'overtimeRequest', 'attendanceRecord',
    'disciplinaryCase', 'grievance',
    'insuranceMember', 'insurancePolicy',
    'visa', 'iqamaRecord', 'gosiRecord', 'gamcaRecord', 'attestation', 'kafalaTransfer', 'huroobReport',
    'employeeDocument', 'probationReview', 'nitaqatSnapshot', 'regulatoryReport',
    'employeeRequest', 'requestType',
    'onboardingTask', 'exitInterview', 'offer', 'interview',
    'application', 'candidate', 'jobPosting',
    'employeeHistory', 'employee', 'position', 'department',
    'section', 'transfer', 'promotion', 'qiwaRequest',
    'formulaDefinition', 'changeRequest',
    'lookupCategory',
    'branch', 'region',
    'policy', 'decisionRecord', 'knowledgeDocument',
    'integrationLog', 'integrationEndpoint',
    'user', 'role', 'lookup', 'setting',
  ];
  for (const t of tables) {
    try { await prisma[t].deleteMany({}); }
    catch (e) { console.log('  skip', t, '(table not in client yet)'); }
  }
  console.log('[seed] wipe done');

  // ============================================================
  // ROLES — 13 role من src/permissions.js
  // ============================================================
  console.log('[seed] roles (13)…');
  const roles = {};
  for (const r of ROLE_DEFS) {
    const row = await prisma.role.create({
      data: { ...r, description: r.nameEn, isSystem: true, permissions: permissionsFor(r.code) },
    });
    roles[r.code] = row;
  }

  // ============================================================
  // LOOKUPS - master dropdowns
  // ============================================================
  console.log('[seed] lookups…');
  const LOOKUPS = [
    // Countries
    { category: 'country', code: 'SA', valueAr: 'المملكة العربية السعودية', valueEn: 'Saudi Arabia' },
    { category: 'country', code: 'AE', valueAr: 'الإمارات العربية المتحدة', valueEn: 'United Arab Emirates' },
    { category: 'country', code: 'EG', valueAr: 'جمهورية مصر العربية', valueEn: 'Egypt' },
    { category: 'country', code: 'JO', valueAr: 'المملكة الأردنية الهاشمية', valueEn: 'Jordan' },
    { category: 'country', code: 'KW', valueAr: 'دولة الكويت', valueEn: 'Kuwait' },
    { category: 'country', code: 'BH', valueAr: 'مملكة البحرين', valueEn: 'Bahrain' },
    { category: 'country', code: 'OM', valueAr: 'سلطنة عُمان', valueEn: 'Oman' },
    { category: 'country', code: 'QA', valueAr: 'دولة قطر', valueEn: 'Qatar' },
    // Saudi cities (parent=SA)
    { category: 'city', code: 'RYD', valueAr: 'الرياض', valueEn: 'Riyadh', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'JED', valueAr: 'جدة', valueEn: 'Jeddah', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'DMM', valueAr: 'الدمام', valueEn: 'Dammam', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'MKN', valueAr: 'مكة المكرمة', valueEn: 'Makkah', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'MDN', valueAr: 'المدينة المنورة', valueEn: 'Madinah', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'TIF', valueAr: 'الطائف', valueEn: 'Taif', parentCategory: 'country', parentCode: 'SA' },
    { category: 'city', code: 'ABH', valueAr: 'أبها', valueEn: 'Abha', parentCategory: 'country', parentCode: 'SA' },
    // Nationalities
    { category: 'nationality', code: 'SAU', valueAr: 'سعودي', valueEn: 'Saudi' },
    { category: 'nationality', code: 'EGY', valueAr: 'مصري', valueEn: 'Egyptian' },
    { category: 'nationality', code: 'JOR', valueAr: 'أردني', valueEn: 'Jordanian' },
    { category: 'nationality', code: 'IND', valueAr: 'هندي', valueEn: 'Indian' },
    { category: 'nationality', code: 'PHI', valueAr: 'فلبيني', valueEn: 'Filipino' },
    { category: 'nationality', code: 'PAK', valueAr: 'باكستاني', valueEn: 'Pakistani' },
    { category: 'nationality', code: 'YEM', valueAr: 'يمني', valueEn: 'Yemeni' },
    { category: 'nationality', code: 'SUD', valueAr: 'سوداني', valueEn: 'Sudanese' },
    // Gender
    { category: 'gender', code: 'M', valueAr: 'ذكر', valueEn: 'Male' },
    { category: 'gender', code: 'F', valueAr: 'أنثى', valueEn: 'Female' },
    // Marital status
    { category: 'marital_status', code: 'single', valueAr: 'أعزب', valueEn: 'Single' },
    { category: 'marital_status', code: 'married', valueAr: 'متزوج', valueEn: 'Married' },
    { category: 'marital_status', code: 'divorced', valueAr: 'مطلق', valueEn: 'Divorced' },
    { category: 'marital_status', code: 'widowed', valueAr: 'أرمل', valueEn: 'Widowed' },
    // Contract types
    { category: 'contract_type', code: 'full_time', valueAr: 'دوام كامل', valueEn: 'Full Time' },
    { category: 'contract_type', code: 'part_time', valueAr: 'دوام جزئي', valueEn: 'Part Time' },
    { category: 'contract_type', code: 'contract', valueAr: 'عقد محدد', valueEn: 'Fixed Term' },
    { category: 'contract_type', code: 'intern', valueAr: 'متدرّب', valueEn: 'Intern' },
    // Candidate sources
    { category: 'candidate_source', code: 'portal', valueAr: 'البوابة الإلكترونية', valueEn: 'Web Portal' },
    { category: 'candidate_source', code: 'referral', valueAr: 'إحالة موظف', valueEn: 'Employee Referral' },
    { category: 'candidate_source', code: 'agency', valueAr: 'مكتب توظيف', valueEn: 'Recruitment Agency' },
    { category: 'candidate_source', code: 'social', valueAr: 'وسائل التواصل', valueEn: 'Social Media' },
    { category: 'candidate_source', code: 'linkedin', valueAr: 'لينكدإن', valueEn: 'LinkedIn' },
    // Education levels
    { category: 'education_level', code: 'high_school', valueAr: 'ثانوي', valueEn: 'High School' },
    { category: 'education_level', code: 'diploma', valueAr: 'دبلوم', valueEn: 'Diploma' },
    { category: 'education_level', code: 'bachelor', valueAr: 'بكالوريوس', valueEn: 'Bachelor' },
    { category: 'education_level', code: 'master', valueAr: 'ماجستير', valueEn: 'Master' },
    { category: 'education_level', code: 'phd', valueAr: 'دكتوراه', valueEn: 'PhD' },
    // Document types
    { category: 'document_type', code: 'national_id', valueAr: 'الهوية الوطنية', valueEn: 'National ID' },
    { category: 'document_type', code: 'iqama', valueAr: 'الإقامة', valueEn: 'Iqama' },
    { category: 'document_type', code: 'passport', valueAr: 'جواز السفر', valueEn: 'Passport' },
    { category: 'document_type', code: 'contract', valueAr: 'العقد', valueEn: 'Contract' },
    { category: 'document_type', code: 'gosi', valueAr: 'التأمينات', valueEn: 'GOSI' },
    // Workflow step types
    { category: 'workflow_step', code: 'manager_approval', valueAr: 'موافقة المدير المباشر', valueEn: 'Manager Approval' },
    { category: 'workflow_step', code: 'hr_review', valueAr: 'مراجعة HR', valueEn: 'HR Review' },
    { category: 'workflow_step', code: 'final_approval', valueAr: 'موافقة نهائية', valueEn: 'Final Approval' },
    // Risk categories
    { category: 'risk_category', code: 'operational', valueAr: 'تشغيلي', valueEn: 'Operational' },
    { category: 'risk_category', code: 'strategic', valueAr: 'استراتيجي', valueEn: 'Strategic' },
    { category: 'risk_category', code: 'financial', valueAr: 'مالي', valueEn: 'Financial' },
    { category: 'risk_category', code: 'compliance', valueAr: 'امتثال', valueEn: 'Compliance' },
    { category: 'risk_category', code: 'security', valueAr: 'أمني', valueEn: 'Security' },
    // Compliance severity
    { category: 'severity', code: 'info', valueAr: 'معلومة', valueEn: 'Info' },
    { category: 'severity', code: 'warning', valueAr: 'تحذير', valueEn: 'Warning' },
    { category: 'severity', code: 'critical', valueAr: 'حرج', valueEn: 'Critical' },
  ];
  for (const l of LOOKUPS) {
    await prisma.lookup.create({ data: l });
  }

  // ============================================================
  // REGIONS + BRANCHES + DEPARTMENTS + POSITIONS
  // ============================================================
  console.log('[seed] regions/branches/departments/positions…');
  const REGIONS = [
    { code: 'CENTRAL', nameAr: 'المنطقة الوسطى', nameEn: 'Central Region', countryCode: 'SA' },
    { code: 'WESTERN', nameAr: 'المنطقة الغربية', nameEn: 'Western Region', countryCode: 'SA' },
    { code: 'EASTERN', nameAr: 'المنطقة الشرقية', nameEn: 'Eastern Region', countryCode: 'SA' },
  ];
  const regions = {};
  for (const r of REGIONS) regions[r.code] = await prisma.region.upsert({
    where: { code: r.code },
    update: { nameAr: r.nameAr, nameEn: r.nameEn, countryCode: r.countryCode },
    create: r,
  });

  const BRANCHES = [
    { code: 'HQ-RYD',  nameAr: 'المقر الرئيسي - الرياض',   nameEn: 'HQ Riyadh',      regionCode: 'CENTRAL' },
    { code: 'OPS-RYD', nameAr: 'مركز العمليات - الرياض',    nameEn: 'Ops Center',     regionCode: 'CENTRAL' },
    { code: 'TRD-JED', nameAr: 'فرع جدة التجاري',          nameEn: 'Jeddah Trade',   regionCode: 'WESTERN' },
    { code: 'MFG-JED', nameAr: 'مصنع جدة',                 nameEn: 'Jeddah Plant',   regionCode: 'WESTERN' },
    { code: 'LOG-DMM', nameAr: 'مركز لوجستيات الدمام',      nameEn: 'Dammam Logistics', regionCode: 'EASTERN' },
    { code: 'RTL-DMM', nameAr: 'متجر الدمام',              nameEn: 'Dammam Retail',  regionCode: 'EASTERN' },
    { code: 'OPS-MKN', nameAr: 'فرع مكة التشغيلي',          nameEn: 'Makkah Ops',     regionCode: 'WESTERN' },
    { code: 'HQ-ABH',  nameAr: 'مكتب أبها الإقليمي',       nameEn: 'Abha Regional',  regionCode: 'WESTERN' },
  ];
  const branches = {};
  for (const b of BRANCHES) {
    branches[b.code] = await prisma.branch.upsert({
      where: { code: b.code },
      update: { nameAr: b.nameAr, nameEn: b.nameEn, regionId: regions[b.regionCode].id },
      create: { code: b.code, nameAr: b.nameAr, nameEn: b.nameEn, regionId: regions[b.regionCode].id },
    });
  }

  const DEPTS = [
    { code: 'EXEC', nameAr: 'الإدارة التنفيذية', nameEn: 'Executive Office' },
    { code: 'HR',   nameAr: 'الموارد البشرية',    nameEn: 'Human Resources' },
    { code: 'FIN',  nameAr: 'المالية',            nameEn: 'Finance' },
    { code: 'OPS',  nameAr: 'العمليات',           nameEn: 'Operations' },
    { code: 'SLS',  nameAr: 'المبيعات',           nameEn: 'Sales' },
    { code: 'MKT',  nameAr: 'التسويق',            nameEn: 'Marketing' },
    { code: 'IT',   nameAr: 'تقنية المعلومات',    nameEn: 'Information Technology' },
    { code: 'LGL',  nameAr: 'الشؤون القانونية',   nameEn: 'Legal Affairs' },
    { code: 'QA',   nameAr: 'الجودة',             nameEn: 'Quality Assurance' },
    { code: 'TRN',  nameAr: 'التدريب والتطوير',   nameEn: 'Training & Development' },
    { code: 'LOG',  nameAr: 'اللوجستيات',         nameEn: 'Logistics' },
    { code: 'PRCH', nameAr: 'المشتريات',          nameEn: 'Procurement' },
  ];
  const depts = {};
  for (const d of DEPTS) depts[d.code] = await prisma.department.upsert({
    where: { code: d.code },
    update: { nameAr: d.nameAr, nameEn: d.nameEn },
    create: { code: d.code, nameAr: d.nameAr, nameEn: d.nameEn },
  });

  const POSITIONS = [
    { code: 'CEO',        titleAr: 'الرئيس التنفيذي',     titleEn: 'Chief Executive Officer', deptCode: 'EXEC', level: 9 },
    { code: 'CHRO',       titleAr: 'مدير الموارد البشرية', titleEn: 'Chief HR Officer',         deptCode: 'HR',   level: 8 },
    { code: 'HR-MGR',     titleAr: 'مدير HR',             titleEn: 'HR Manager',               deptCode: 'HR',   level: 6 },
    { code: 'HR-SPEC',    titleAr: 'أخصائي موارد بشرية',  titleEn: 'HR Specialist',            deptCode: 'HR',   level: 4 },
    { code: 'REC',        titleAr: 'مسؤول توظيف',         titleEn: 'Recruiter',                deptCode: 'HR',   level: 4 },
    { code: 'TRN-COORD',  titleAr: 'منسق تدريب',          titleEn: 'Training Coordinator',     deptCode: 'TRN',  level: 4 },
    { code: 'CFO',        titleAr: 'المدير المالي',        titleEn: 'Chief Financial Officer',  deptCode: 'FIN',  level: 8 },
    { code: 'ACC',        titleAr: 'محاسب',                titleEn: 'Accountant',               deptCode: 'FIN',  level: 3 },
    { code: 'COO',        titleAr: 'مدير العمليات',        titleEn: 'Chief Operating Officer',  deptCode: 'OPS',  level: 8 },
    { code: 'OPS-MGR',    titleAr: 'مدير عمليات',          titleEn: 'Operations Manager',       deptCode: 'OPS',  level: 6 },
    { code: 'OPS-SPEC',   titleAr: 'أخصائي عمليات',        titleEn: 'Operations Specialist',    deptCode: 'OPS',  level: 4 },
    { code: 'SLS-MGR',    titleAr: 'مدير مبيعات',          titleEn: 'Sales Manager',            deptCode: 'SLS',  level: 6 },
    { code: 'SLS-REP',    titleAr: 'مندوب مبيعات',         titleEn: 'Sales Rep',                deptCode: 'SLS',  level: 3 },
    { code: 'MKT-MGR',    titleAr: 'مدير تسويق',           titleEn: 'Marketing Manager',        deptCode: 'MKT',  level: 6 },
    { code: 'CTO',        titleAr: 'مدير التقنية',         titleEn: 'Chief Technology Officer', deptCode: 'IT',   level: 8 },
    { code: 'DEV-SR',     titleAr: 'مطوّر أول',            titleEn: 'Senior Developer',         deptCode: 'IT',   level: 6 },
    { code: 'DEV-JR',     titleAr: 'مطوّر',                titleEn: 'Developer',                deptCode: 'IT',   level: 4 },
    { code: 'QA-ENG',     titleAr: 'مهندس جودة',           titleEn: 'QA Engineer',              deptCode: 'QA',   level: 5 },
    { code: 'AUDIT',      titleAr: 'مدقق داخلي',           titleEn: 'Internal Auditor',         deptCode: 'LGL',  level: 6 },
    { code: 'LEGAL',      titleAr: 'مستشار قانوني',         titleEn: 'Legal Counsel',            deptCode: 'LGL',  level: 6 },
    { code: 'LOG-MGR',    titleAr: 'مدير لوجستيات',        titleEn: 'Logistics Manager',        deptCode: 'LOG',  level: 6 },
    { code: 'LOG-SPEC',   titleAr: 'أخصائي لوجستيات',      titleEn: 'Logistics Specialist',     deptCode: 'LOG',  level: 4 },
    { code: 'PRCH-MGR',   titleAr: 'مدير مشتريات',         titleEn: 'Procurement Manager',      deptCode: 'PRCH', level: 6 },
    { code: 'KN-KEEPER',  titleAr: 'أمين معرفة',            titleEn: 'Knowledge Keeper',         deptCode: 'HR',   level: 5 },
    { code: 'EMP',        titleAr: 'موظف',                 titleEn: 'Employee',                 deptCode: 'OPS',  level: 2 },
  ];
  const positions = {};
  for (const p of POSITIONS) {
    positions[p.code] = await prisma.position.upsert({
      where: { code: p.code },
      update: {
        titleAr: p.titleAr, titleEn: p.titleEn,
        deptId: depts[p.deptCode].id, level: p.level,
        minSalary: p.level * 2000, maxSalary: p.level * 5000,
      },
      create: {
        code: p.code, titleAr: p.titleAr, titleEn: p.titleEn,
        deptId: depts[p.deptCode].id, level: p.level,
        minSalary: p.level * 2000, maxSalary: p.level * 5000,
      },
    });
  }

  // ============================================================
  // USERS + EMPLOYEES (linked)
  // ============================================================
  console.log('[seed] users + employees…');
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'Admin@12345', 10);

  // 14 demo users — 13 دوراً (keeper مدمج في hr_specialist)
  const USER_DEMOS = [
    { username: 'admin',      role: 'sysadmin',          nameAr: 'مدير النظام',           nameEn: 'System Admin' },
    { username: 'executive',  role: 'ceo',               nameAr: 'سارة التنفيذي',         nameEn: 'Sara CEO' },
    { username: 'hrdir',      role: 'hr_director',       nameAr: 'عبدالرحمن السديري',     nameEn: 'Abdulrahman HR Director' },
    { username: 'finance',    role: 'finance_manager',   nameAr: 'منيرة القحطاني',        nameEn: 'Munira Finance Manager' },
    { username: 'hrmgr',      role: 'hr_specialist',     nameAr: 'فاطمة الحربي',          nameEn: 'Fatima Al-Harbi' },
    { username: 'recruiter',  role: 'recruiter',         nameAr: 'خالد العتيبي',          nameEn: 'Khalid Al-Otaibi' },
    { username: 'payroll',    role: 'payroll_officer',   nameAr: 'سلطان المطيري',         nameEn: 'Sultan Payroll' },
    { username: 'lnd',        role: 'ld_specialist',     nameAr: 'أمل الزهراني',          nameEn: 'Amal L&D' },
    { username: 'manager',    role: 'line_manager',      nameAr: 'محمد القحطاني',         nameEn: 'Mohammed Al-Qahtani' },
    { username: 'keeper',     role: 'hr_specialist',     nameAr: 'نورة الزهراني',         nameEn: 'Nora Al-Zahrani' },
    { username: 'employee',   role: 'employee',          nameAr: 'أحمد الغامدي',          nameEn: 'Ahmed Al-Ghamdi' },
    { username: 'auditor',    role: 'auditor',           nameAr: 'ريم الدوسري',           nameEn: 'Reem Al-Dosari' },
    { username: 'security',   role: 'security_admin',    nameAr: 'بدر الشهري',            nameEn: 'Badr Security' },
    { username: 'analyst',    role: 'data_analyst',      nameAr: 'جواهر العنزي',          nameEn: 'Jawaher Analyst' },
    { username: 'compliance', role: 'compliance_officer',nameAr: 'هند القرني',            nameEn: 'Hind Compliance' },
  ];

  const users = {};
  for (const u of USER_DEMOS) {
    users[u.username] = await prisma.user.create({
      data: {
        username: u.username,
        fullNameAr: u.nameAr,
        fullNameEn: u.nameEn,
        email: `${u.username}@hr-gov.local`,
        passwordHash,
        roleId: roles[u.role].id,
        status: 'active',
        mustChangePassword: false,
      },
    });
  }

  // 25 employees
  const EMP_NAMES = [
    ['سارة المطيري', 'Sara Al-Mutairi'], ['عبدالله الشهري', 'Abdullah Al-Shehri'],
    ['نوال السبيعي', 'Nawal Al-Subai'], ['ماجد البلوي', 'Majed Al-Balawi'],
    ['هند الرشيدي', 'Hind Al-Rashidi'], ['سامي العصيمي', 'Sami Al-Asimi'],
    ['لطيفة الحكمي', 'Latifa Al-Hakmi'], ['فيصل الدوسري', 'Faisal Al-Dosari'],
    ['منى العنزي', 'Muna Al-Anzi'], ['تركي الحارثي', 'Turki Al-Harthi'],
    ['أمل البقمي', 'Amal Al-Buqami'], ['بدر الشمري', 'Badr Al-Shammari'],
    ['حياة القرني', 'Hayat Al-Qarni'], ['وليد السلمي', 'Walid Al-Sulami'],
    ['شيخة العمري', 'Sheikha Al-Omari'], ['سعد الرويلي', 'Saad Al-Ruwaili'],
    ['جواهر الخالدي', 'Jawaher Al-Khalidi'], ['رائد الجهني', 'Raed Al-Juhani'],
    ['بدريه الزايدي', 'Badriya Al-Zaidi'], ['ماجد الفيفي', 'Majed Al-Faifi'],
    ['نعيمة الأحمدي', 'Naeema Al-Ahmadi'], ['عادل الحربي', 'Adel Al-Harbi'],
    ['سحر العتيبي', 'Sahar Al-Otaibi'], ['عبدالعزيز السهلي', 'Abdulaziz Al-Sahli'],
    ['خلود الغامدي', 'Kholoud Al-Ghamdi'],
  ];
  const EMP_DEPTS = ['HR','FIN','OPS','SLS','MKT','IT','QA','LGL','LOG','PRCH','TRN'];
  const employees = [];
  for (let i = 0; i < 25; i++) {
    const [nameAr, nameEn] = EMP_NAMES[i];
    const branchKeys = Object.keys(branches);
    const branch = branches[branchKeys[i % branchKeys.length]];
    const deptCode = EMP_DEPTS[i % EMP_DEPTS.length];
    const dept = depts[deptCode];
    const posCode = deptCode === 'HR' ? (i === 0 ? 'CHRO' : i === 1 ? 'HR-MGR' : 'HR-SPEC')
                  : deptCode === 'IT' ? (i < 5 ? 'DEV-SR' : 'DEV-JR')
                  : deptCode === 'FIN' ? 'ACC'
                  : deptCode === 'OPS' ? 'OPS-SPEC'
                  : deptCode === 'SLS' ? 'SLS-REP'
                  : deptCode === 'QA' ? 'QA-ENG'
                  : deptCode === 'LGL' ? 'LEGAL'
                  : deptCode === 'LOG' ? 'LOG-SPEC'
                  : deptCode === 'PRCH' ? 'PRCH-MGR'
                  : deptCode === 'TRN' ? 'TRN-COORD'
                  : deptCode === 'MKT' ? 'MKT-MGR'
                  : 'EMP';
    const pos = positions[posCode];
    const nationalities = ['SAU','EGY','JOR','IND','PHI','PAK','YEM','SUD'];
    const nat = nationalities[i % nationalities.length];
    const emp = await prisma.employee.create({
      data: {
        employeeNumber: `EMP-${String(i + 1).padStart(5, '0')}`,
        fullNameAr: nameAr, fullNameEn: nameEn,
        nationalId: `1${String(100000000 + i).padStart(9, '0')}`,
        nationality: nat,
        residentType: nat === 'SAU' ? 'saudi' : 'expat',
        gender: i % 3 === 0 ? 'F' : 'M',
        maritalStatus: i % 2 === 0 ? 'married' : 'single',
        dobHijri: hi(daysAgo(365 * (25 + i))),
        email: `emp${i + 1}@hr-gov.local`,
        phone: `05${String(10000000 + i).padStart(8, '0')}`,
        hireDate: daysAgo(180 + i * 90), // تنويع: من 6 أشهر إلى ~6.5 سنوات
        contractType: 'full_time',
        employmentStatus: i === 24 ? 'notice_period' : 'active',
        contractEndDate: i % 4 === 0 ? daysAhead(365) : null,
        branchId: branch.id, deptId: dept.id, positionId: pos.id,
        salary: pos.level * 3000,
        bankName: 'البنك الأهلي السعودي', iban: `SA0380000000608010167519`,
      },
    });
    employees.push(emp);
  }
  // Set employee for "employee" demo user
  await prisma.user.update({
    where: { id: users['employee'].id },
    data: { employeeId: employees[0].id },
  });
  await prisma.user.update({
    where: { id: users['manager'].id },
    data: { employeeId: employees[5].id },
  });

  // User scopes (regional/branch)
  for (const u of ['executive', 'admin', 'auditor']) {
    for (const r of Object.values(regions)) {
      await prisma.userScope.create({
        data: { userId: users[u].id, scopeType: 'region', scopeId: r.id, canRead: true, canWrite: u !== 'auditor', canApprove: u === 'hr_admin', canDelete: u === 'hr_admin' },
      });
    }
  }
  for (const b of Object.values(branches)) {
    await prisma.userScope.create({
      data: { userId: users['hrmgr'].id, scopeType: 'branch', scopeId: b.id, canRead: true, canWrite: true, canApprove: false, canDelete: false },
    });
  }

  // ============================================================
  // JOB POSTINGS + CANDIDATES + APPLICATIONS
  // ============================================================
  console.log('[seed] job postings + candidates…');
  const POSTINGS = [
    { titleAr: 'مهندس برمجيات أول', titleEn: 'Senior Software Engineer', deptCode: 'IT',   openings: 3, status: 'open' },
    { titleAr: 'مدير مبيعات إقليمي', titleEn: 'Regional Sales Manager',  deptCode: 'SLS',  openings: 1, status: 'open' },
    { titleAr: 'أخصائي موارد بشرية', titleEn: 'HR Specialist',            deptCode: 'HR',   openings: 2, status: 'open' },
    { titleAr: 'محاسب أول',           titleEn: 'Senior Accountant',        deptCode: 'FIN',  openings: 1, status: 'open' },
    { titleAr: 'منسق تدريب',          titleEn: 'Training Coordinator',     deptCode: 'TRN',  openings: 1, status: 'open' },
    { titleAr: 'مهندس جودة',          titleEn: 'Quality Engineer',         deptCode: 'QA',   openings: 2, status: 'open' },
    { titleAr: 'مدير لوجستيات',       titleEn: 'Logistics Manager',        deptCode: 'LOG',  openings: 1, status: 'open' },
    { titleAr: 'مدير تسويق رقمي',    titleEn: 'Digital Marketing Manager',deptCode: 'MKT',  openings: 1, status: 'draft' },
    { titleAr: 'مستشار قانوني',       titleEn: 'Legal Counsel',            deptCode: 'LGL',  openings: 1, status: 'open' },
    { titleAr: 'مدير مشتريات',       titleEn: 'Procurement Manager',      deptCode: 'PRCH', openings: 1, status: 'closed' },
  ];
  const postings = [];
  for (let i = 0; i < POSTINGS.length; i++) {
    const p = POSTINGS[i];
    const branchKeys = Object.keys(branches);
    const branch = branches[branchKeys[i % branchKeys.length]];
    postings.push(await prisma.jobPosting.create({
      data: {
        code: `JP-${String(i + 1).padStart(3, '0')}`,
        titleAr: p.titleAr, titleEn: p.titleEn,
        description: `وصف تفصيلي للوظيفة: ${p.titleAr}`,
        branchId: branch.id, deptId: depts[p.deptCode].id,
        status: p.status, openings: p.openings,
        publishedAt: p.status === 'open' ? daysAgo(30) : null,
        closedAt: p.status === 'closed' ? daysAgo(5) : null,
        createdById: users['recruiter'].id,
      },
    }));
  }

  const CANDIDATES = [];
  const CAND_NAMES = [
    ['فهد العنزي','Fahad Al-Anzi'], ['ريم السلمي','Reem Al-Sulami'],
    ['سعد القحطاني','Saad Al-Qahtani'], ['لينا الرشيد','Lina Al-Rasheed'],
    ['خالد الدوسري','Khalid Al-Dosari'], ['دانة العمري','Dana Al-Omari'],
    ['بدر الشهري','Badr Al-Shehri'], ['مها السبيعي','Maha Al-Subai'],
    ['تركي الحربي','Turki Al-Harbi'], ['عهود البلوي','Ohood Al-Balawi'],
    ['محمد الزهراني','Mohammed Al-Zahrani'], ['سارة الخالدي','Sarah Al-Khalidi'],
    ['عبدالعزيز الفيفي','Abdulaziz Al-Faifi'], ['جميلة الأحمدي','Jameela Al-Ahmadi'],
    ['نواف القرني','Nawaf Al-Qarni'], ['حصة السهلي','Hessa Al-Sahli'],
    ['مشعل العصيمي','Mishal Al-Asimi'], ['لمياء الغامدي','Lamia Al-Ghamdi'],
    ['زياد الرويلي','Ziad Al-Ruwaili'], ['بدور الجهني','Bdoor Al-Juhani'],
    ['عبدالرحمن المطيري','Abdulrahman Al-Mutairi'], ['غادة الحكمي','Ghada Al-Hakmi'],
    ['رائد الشمري','Raed Al-Shammari'], ['شذى الحارثي','Shatha Al-Harthi'],
    ['نايف العتيبي','Naif Al-Otaibi'], ['هاجر البقمي','Hajer Al-Buqami'],
    ['ثامر الزايدي','Thamer Al-Zaidi'], ['أمل الفهد','Amal Al-Fahd'],
    ['فيصل المهنا','Faisal Al-Muhanna'], ['رهف الدوسري','Rahaf Al-Dosari'],
  ];
  const SOURCES = ['portal','referral','agency','social','linkedin'];
  for (let i = 0; i < CAND_NAMES.length; i++) {
    const [nameAr, nameEn] = CAND_NAMES[i];
    CANDIDATES.push(await prisma.candidate.create({
      data: {
        fullNameAr: nameAr, fullNameEn: nameEn,
        email: `cand${i + 1}@mail.com`, phone: `05${String(50000000 + i).padStart(8, '0')}`,
        source: SOURCES[i % SOURCES.length],
        parsedData: { years: 3 + (i % 7), currentSalary: 8000 + i * 500 },
        biasFlags: i % 5 === 0 ? { age_proxy: true, region_bias: false } : null,
      },
    }));
  }

  // Applications across stages
  const STAGES = ['applied','screening','interview','assessment','offer','hired','rejected'];
  let appCounter = 0;
  for (let i = 0; i < CANDIDATES.length; i++) {
    const posting = postings[i % postings.length];
    const stage = STAGES[i % STAGES.length];
    const app = await prisma.application.create({
      data: {
        candidateId: CANDIDATES[i].id,
        postingId: posting.id,
        stage,
        score: 50 + (i * 3) % 50,
        biasScore: i % 7 === 0 ? 0.15 : null,
        closedAt: ['hired','rejected'].includes(stage) ? daysAgo(5) : null,
      },
    });
    appCounter++;
    // 70% have interviews
    if (i % 3 !== 0) {
      await prisma.interview.create({
        data: {
          applicationId: app.id,
          scheduledAt: daysAhead(i + 1),
          durationMins: 60,
          panelJson: [{ interviewer: users['manager'].id, role: 'manager' }],
          feedbackJson: { technical: 4, communication: 4 },
        },
      });
    }
    // 30% have offers (only if stage is offer/hired)
    if (['offer','hired'].includes(stage) && i % 2 === 0) {
      await prisma.offer.create({
        data: {
          applicationId: app.id,
          salary: 10000 + i * 200, currency: 'SAR',
          benefits: { housing: 2000, transport: 500 },
          startDate: daysAhead(14),
          status: stage === 'hired' ? 'accepted' : 'sent',
          sentAt: daysAgo(2),
          respondedAt: stage === 'hired' ? daysAgo(1) : null,
        },
      });
    }
  }

  // Onboarding tasks for first 5 employees
  const ONBOARDING_TASKS = [
    { taskCode: 'ID_CARD',     titleAr: 'تجهيز بطاقة الهوية الداخلية', titleEn: 'Internal ID Card' },
    { taskCode: 'EMAIL_SETUP', titleAr: 'إعداد البريد الإلكتروني',     titleEn: 'Email Setup' },
    { taskCode: 'EQUIPMENT',    titleAr: 'تسليم المعدات',              titleEn: 'Equipment Handover' },
    { taskCode: 'SYSTEM_ACCESS', titleAr: 'صلاحيات الأنظمة',           titleEn: 'System Access' },
    { taskCode: 'GOSI_REG',    titleAr: 'التسجيل في التأمينات',       titleEn: 'GOSI Registration' },
    { taskCode: 'TRAINING',    titleAr: 'تدريب تعريفي',               titleEn: 'Orientation Training' },
    { taskCode: 'INTRO_TEAM',  titleAr: 'تعريف بالفريق',              titleEn: 'Team Introduction' },
  ];
  for (let i = 0; i < 5; i++) {
    const emp = employees[i];
    for (let j = 0; j < ONBOARDING_TASKS.length; j++) {
      const t = ONBOARDING_TASKS[j];
      await prisma.onboardingTask.create({
        data: {
          employeeId: emp.id, taskCode: t.taskCode,
          titleAr: t.titleAr, titleEn: t.titleEn,
          status: j <= i ? 'done' : (j === i + 1 ? 'in_progress' : 'pending'),
          dueDate: daysAhead(j * 2 - i),
          completedAt: j <= i ? daysAgo(15 - j) : null,
          assigneeId: users['hrmgr'].id,
        },
      });
    }
  }

  // ============================================================
  // KNOWLEDGE DOCUMENTS + DECISIONS + POLICIES
  // ============================================================
  console.log('[seed] knowledge + decisions + policies…');
  const DOCS = [
    { titleAr: 'إجراءات التوظيف المعتمدة', category: 'sop', tags: ['recruitment','hr'] },
    { titleAr: 'دليل تقييم الأداء السنوي', category: 'guide', tags: ['performance','evaluation'] },
    { titleAr: 'نموذج خطة التطوير الفردي (IDP)', category: 'template', tags: ['idp','development'] },
    { titleAr: 'سياسة الإجازات السنوية', category: 'sop', tags: ['leave','policy'] },
    { titleAr: 'دليل إدارة المعرفة المؤسسية', category: 'guide', tags: ['knowledge','governance'] },
    { titleAr: 'قالب طلب توظيف جديد', category: 'template', tags: ['recruitment'] },
    { titleAr: 'درس مستفاد: فشل مشروع التحول الرقمي 2025', category: 'lesson_learned', tags: ['transformation','digital'] },
    { titleAr: 'دليل إجراءات إنهاء الخدمة', category: 'sop', tags: ['exit','offboarding'] },
    { titleAr: 'سياسة العمل عن بُعد', category: 'sop', tags: ['remote','work'] },
    { titleAr: 'إجراءات قياس نضج HR', category: 'guide', tags: ['maturity','assessment'] },
    { titleAr: 'دليل استخدام محرك سير العمل', category: 'guide', tags: ['workflow','engine'] },
    { titleAr: 'درس مستفاد: تطبيق نظام الحوكمة', category: 'lesson_learned', tags: ['governance'] },
    { titleAr: 'قالب مصفوفة الصلاحيات (RACI)', category: 'template', tags: ['raci','permissions'] },
    { titleAr: 'دليل كتابة سجل القرار', category: 'guide', tags: ['adr','decision'] },
    { titleAr: 'سياسة أمن المعلومات للموارد البشرية', category: 'sop', tags: ['security','data'] },
  ];
  for (let i = 0; i < DOCS.length; i++) {
    const d = DOCS[i];
    await prisma.knowledgeDocument.create({
      data: {
        code: `DOC-${String(i + 1).padStart(3, '0')}`,
        titleAr: d.titleAr, titleEn: d.titleAr,
        contentMarkdown: `# ${d.titleAr}\n\nهذا محتوى تجريبي للوثيقة...`,
        category: d.category, tags: d.tags,
        authorId: users['keeper'].id,
        status: i < 8 ? 'published' : (i < 12 ? 'in_review' : 'draft'),
        publishedAt: i < 8 ? daysAgo(60 - i * 5) : null,
      },
    });
  }

  // Decision records with hash chain
  let prevHash = null;
  const DECISIONS = [
    { titleAr: 'توحيد نظام إدارة الموارد البشرية', context: 'الحاجة لتوحيد 4 أنظمة منفصلة', decision: 'اعتماد المنصة الجديدة لكامل المؤسسة' },
    { titleAr: 'تطبيق سياسة العمل الهجين', context: 'متطلبات الموظفين بعد الجائحة', decision: 'يومين عن بُعد، 3 في المكتب، قابل للتعديل حسب الدور' },
    { titleAr: 'إطلاق برنامج تطوير القيادات الشابة', context: 'تحديد 15% HiPo', decision: 'برنامج 18 شهراً مع mentor خارجي' },
    { titleAr: 'دمج قسمي التوظيف والاستقطاب', context: 'تكرار في العمليات', decision: 'دمج تحت إدارة HR واحدة' },
    { titleAr: 'اعتماد ميزانية التحول الرقمي Q3', context: 'خطة 2026', decision: '15 مليون ريال على 18 شهراً' },
  ];
  for (let i = 0; i < DECISIONS.length; i++) {
    const d = DECISIONS[i];
    const payload = `${i}|${d.titleAr}|${d.decision}|${prevHash || ''}`;
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    await prisma.decisionRecord.create({
      data: {
        code: `ADR-${String(i + 1).padStart(3, '0')}`,
        titleAr: d.titleAr, contextMarkdown: d.context, decisionMarkdown: d.decision,
        decidedById: users['executive'].id,
        decidedAt: daysAgo(40 - i * 5),
        previousHash: prevHash,
        currentHash: hash,
      },
    });
    prevHash = hash;
  }

  const POLICIES = [
    { code: 'POL-LEAVE',   titleAr: 'سياسة الإجازات',  titleEn: 'Leave Policy',         jurisdiction: 'SA' },
    { code: 'POL-REMOTE',  titleAr: 'سياسة العمل عن بعد', titleEn: 'Remote Work Policy', jurisdiction: 'SA' },
    { code: 'POL-EXPENSE', titleAr: 'سياسة المصروفات', titleEn: 'Expense Policy',       jurisdiction: 'SA' },
    { code: 'POL-CODE',    titleAr: 'ميثاق السلوك المهني', titleEn: 'Code of Conduct',   jurisdiction: 'GLOBAL' },
    { code: 'POL-DATA',    titleAr: 'سياسة حماية البيانات', titleEn: 'Data Protection Policy', jurisdiction: 'GLOBAL' },
    { code: 'POL-GOSI',    titleAr: 'سياسة التأمينات', titleEn: 'GOSI Policy',           jurisdiction: 'SA' },
    { code: 'POL-HARASS',  titleAr: 'سياسة عدم التحرش', titleEn: 'Anti-Harassment Policy', jurisdiction: 'GLOBAL' },
    { code: 'POL-PROMO',   titleAr: 'سياسة الترقيات',   titleEn: 'Promotion Policy',      jurisdiction: 'SA' },
  ];
  for (const p of POLICIES) {
    await prisma.policy.create({
      data: {
        code: p.code, titleAr: p.titleAr, titleEn: p.titleEn,
        contentMarkdown: `# ${p.titleAr}\n\nمحتوى السياسة التفصيلي...`,
        jurisdiction: p.jurisdiction,
        effectiveDate: daysAgo(90), expiryDate: daysAhead(275),
        autoRenewal: true,
        status: 'published',
      },
    });
  }

  // ============================================================
  // WORKFLOW DEFINITIONS + INSTANCES
  // ============================================================
  console.log('[seed] workflows…');
  await prisma.workflowDefinition.create({
    data: {
      code: 'WF-LEAVE', nameAr: 'موافقة طلب إجازة', nameEn: 'Leave Approval',
      description: 'سير عمل موافقة طلب الإجازة',
      definitionJson: {
        steps: [
          { code: 'manager', nameAr: 'موافقة المدير المباشر', slaMins: 480 },
          { code: 'hr', nameAr: 'مراجعة HR', slaMins: 240 },
        ],
      },
    },
  });
  await prisma.workflowDefinition.create({
    data: {
      code: 'WF-PROMO', nameAr: 'موافقة ترقية', nameEn: 'Promotion Approval',
      description: 'سير عمل الموافقة على ترقية',
      definitionJson: {
        steps: [
          { code: 'manager', nameAr: 'توصية المدير', slaMins: 1440 },
          { code: 'hr_review', nameAr: 'مراجعة HR', slaMins: 720 },
          { code: 'executive', nameAr: 'موافقة تنفيذية', slaMins: 1440 },
        ],
      },
    },
  });
  await prisma.workflowDefinition.create({
    data: {
      code: 'WF-RECRUIT', nameAr: 'موافقة توظيف', nameEn: 'Recruitment Approval',
      description: 'سير عمل الموافقة على طلب توظيف جديد',
      definitionJson: {
        steps: [
          { code: 'recruiter', nameAr: 'مراجعة recruiter', slaMins: 720 },
          { code: 'hr_mgr', nameAr: 'موافقة HR Manager', slaMins: 1440 },
          { code: 'budget', nameAr: 'موافقة الميزانية', slaMins: 720 },
        ],
      },
    },
  });

  // ============================================================
  // COMPLIANCE RULES + DOCUMENT EXPIRIES
  // ============================================================
  console.log('[seed] compliance…');
  const COMP_RULES = [
    { code: 'COMP-IQAMA', nameAr: 'انتهاء الإقامة', nameEn: 'Iqama Expiry', severity: 'critical', ruleJson: { field: 'iqama', daysBefore: 30 } },
    { code: 'COMP-ID',    nameAr: 'انتهاء الهوية', nameEn: 'National ID Expiry', severity: 'warning',   ruleJson: { field: 'national_id', daysBefore: 60 } },
    { code: 'COMP-CONTRACT', nameAr: 'انتهاء العقد', nameEn: 'Contract Expiry', severity: 'warning', ruleJson: { field: 'contract', daysBefore: 30 } },
    { code: 'COMP-GOSI',  nameAr: 'عدم التسجيل في التأمينات', nameEn: 'Missing GOSI Registration', severity: 'critical', ruleJson: { check: 'gosi_within_30_days' } },
    { code: 'COMP-LEAVE', nameAr: 'تجاوز رصيد الإجازات', nameEn: 'Leave Balance Exceeded', severity: 'info', ruleJson: { maxBalance: 60 } },
  ];
  for (const r of COMP_RULES) {
    await prisma.complianceRule.create({ data: { ...r, isActive: true } });
  }
  // Document expiries
  for (let i = 0; i < 12; i++) {
    const emp = employees[i];
    await prisma.documentExpiry.create({
      data: {
        entityType: 'employee', entityId: emp.id,
        documentType: i % 2 === 0 ? 'iqama' : 'contract',
        documentRef: `REF-${i}`,
        expiryDate: daysAhead(i * 15 + 7),
        alert30Sent: i < 4, alert7Sent: i < 2, alert0Sent: i < 1,
      },
    });
  }
  // A few violations
  const openRules = await prisma.complianceRule.findMany();
  for (let i = 0; i < 5; i++) {
    await prisma.complianceViolation.create({
      data: {
        ruleId: openRules[i % openRules.length].id,
        entityType: 'employee', entityId: employees[i + 10].id,
        severity: openRules[i % openRules.length].severity,
        status: i < 3 ? 'open' : 'resolved',
        resolvedAt: i >= 3 ? daysAgo(2) : null,
        resolvedById: i >= 3 ? users['admin'].id : null,
      },
    });
  }

  // ============================================================
  // PROCESS KPIs
  // ============================================================
  console.log('[seed] KPIs…');
  const KPIS = [
    { processCode: 'RECRUITMENT', nameAr: 'متوسط أيام التوظيف', nameEn: 'Avg Days to Hire', targetValue: 30, currentValue: 42, measurementUnit: 'days', direction: 'lower_is_better', ownerId: users['recruiter'].id },
    { processCode: 'RECRUITMENT', nameAr: 'نسبة قبول العروض', nameEn: 'Offer Acceptance Rate', targetValue: 80, currentValue: 65, measurementUnit: '%', direction: 'higher_is_better', ownerId: users['recruiter'].id },
    { processCode: 'ONBOARDING', nameAr: 'نسبة إكمال الـ30 يوم', nameEn: '30-day Completion', targetValue: 90, currentValue: 75, measurementUnit: '%', direction: 'higher_is_better', ownerId: users['hrmgr'].id },
    { processCode: 'PERFORMANCE', nameAr: 'نسبة إكمال التقييمات', nameEn: 'Review Completion', targetValue: 95, currentValue: 88, measurementUnit: '%', direction: 'higher_is_better', ownerId: users['hrmgr'].id },
    { processCode: 'RETENTION', nameAr: 'معدل الدوران السنوي', nameEn: 'Annual Turnover', targetValue: 12, currentValue: 18, measurementUnit: '%', direction: 'lower_is_better', ownerId: users['hrmgr'].id },
  ];
  for (const k of KPIS) {
    const gap = k.direction === 'higher_is_better' ? k.targetValue - k.currentValue : k.currentValue - k.targetValue;
    await prisma.processKPI.create({
      data: { ...k, gapAuto: gap, lastMeasuredAt: daysAgo(7) },
    });
  }

  // ============================================================
  // MATURITY: 7 axes x 6 dimensions = 42
  // ============================================================
  console.log('[seed] maturity (42 dimensions)…');
  const AXES = [
    { id: 1, nameAr: 'الاستراتيجية والحوكمة', nameEn: 'Strategy & Governance' },
    { id: 2, nameAr: 'الهيكل والتنظيم',        nameEn: 'Structure & Organization' },
    { id: 3, nameAr: 'الموارد البشرية الأساسية', nameEn: 'Core HR' },
    { id: 4, nameAr: 'التعلم والتطوير',         nameEn: 'Learning & Development' },
    { id: 5, nameAr: 'التعويضات والمزايا',      nameEn: 'Compensation & Benefits' },
    { id: 6, nameAr: 'العلاقات والتحليلات',     nameEn: 'Relations & Analytics' },
    { id: 7, nameAr: 'التقنية والبيانات',       nameEn: 'Technology & Data' },
  ];
  const DIM_TEMPLATES = [
    'وضوح الرؤية والرسالة', 'مشاركة القيادة', 'التخطيط الاستراتيجي HR', 'حوكمة السياسات', 'إدارة المخاطر',
    'إدارة التغيير', 'الهيكل التنظيمي', 'توصيف الأدوار', 'خط المواهب', 'التعاقب الوظيفي',
    'الاستقطاب الذكي', 'تجربة الموظف', 'إدارة الأداء', 'إدارة الإجازات', 'الامتثال القانوني',
    'تحديد الاحتياجات التدريبية', 'خطط التطوير الفردية', 'تقييم أثر التدريب', 'منصات التعلم', 'مكتبة الكفاءات',
    'هيكل الرواتب', 'معايير الترقية', 'المزايا والتعويضات', 'ربط الأداء بالمكافآت', 'إدارة نهاية الخدمة',
    'مؤشرات تجربة الموظف', 'إدارة الشكاوى', 'التواصل الداخلي', 'ثقافة المؤسسة', 'تنوع وشمول',
    'نظام معلومات HR', 'تقارير لحظية', 'تكامل الأنظمة', 'أمن البيانات HR', 'تحليلات تنبؤية',
    'القيادة', 'الابتكار', 'الاستدامة', 'التوطين', 'التوسع الإقليمي', 'الحوكمة المتقدمة',
  ];
  const dimensions = [];
  for (let axisIdx = 0; axisIdx < AXES.length; axisIdx++) {
    const axis = AXES[axisIdx];
    for (let i = 0; i < 6; i++) {
      const code = axisIdx * 6 + i + 1;
      if (code > 42) break;
      const d = await prisma.maturityDimension.create({
        data: {
          axisId: axis.id, axisNameAr: axis.nameAr, axisNameEn: axis.nameEn,
          code, nameAr: DIM_TEMPLATES[code - 1] || `البعد ${code}`,
          nameEn: `Dimension ${code}`,
          description: `وصف البعد ${code}`,
          weight: 1.0,
        },
      });
      dimensions.push(d);
    }
  }
  // Assessments for some dimensions
  for (let i = 0; i < dimensions.length; i++) {
    const score = (i * 7) % 5 + 1; // 1-5
    await prisma.maturityAssessment.create({
      data: {
        dimensionId: dimensions[i].id,
        score, evidence: `دليل على المستوى ${score}`,
        targetScore: Math.min(5, score + 1),
        targetDate: daysAhead(90),
        assessorId: users['admin'].id,
      },
    });
  }

  // ============================================================
  // 5 WHYS ANALYSES
  // ============================================================
  console.log('[seed] 5 Whys…');
  const FIVE_WHYS = [
    {
      title: 'تأخر تسليم مشروع التحول الرقمي',
      problemDesc: 'تجاوز المشروع لمدة 6 أشهر عن الجدول',
      tree: {
        why1: { text: 'تأخر تسليم المرحلة الثانية', why2: {
          text: 'نقص في الكوادر التقنية', why3: {
            text: 'صعوبة استقطاب مطوّرين', why4: {
              text: 'ميزانية الرواتب غير تنافسية', why5: {
                text: 'لم تتم مراجعة هياكل الرواتب منذ 2023',
              },
            },
          },
        } },
      },
      rootCause: 'غياب سياسة دورية لمراجعة تنافسية الرواتب',
      corrective: 'إنشاء لجنة مراجعة رواتب ربع سنوية + benchmark سنوي',
    },
    {
      title: 'ارتفاع دوران الموظفين الجدد',
      problemDesc: '30% من الموظفين يغادرون خلال أول 6 أشهر',
      tree: { why1: { text: 'ضعف الاندماج', why2: { text: 'تدريب غير كافٍ', why3: { text: 'لا يوجد منهجية موحدة', why4: { text: 'لم تخصص ميزانية', why5: { text: 'لم يُعتبر أولوية استراتيجية' } } } } } },
      rootCause: 'غياب أولوية الاندماج في الخطة الاستراتيجية',
      corrective: 'اعتماد برنامج Onboarding منظم بميزانية محددة',
    },
    {
      title: 'انخفاض مشاركة الموظفين في الاستبيانات',
      problemDesc: 'معدل الاستجابة 22% فقط في آخر استبيان',
      tree: { why1: { text: 'الاستبيانات طويلة', why2: { text: 'لم تختبر تجربة المستخدم', why3: { text: 'لا يوجد فريق UX داخلي', why4: { text: 'لم يُخصص له ميزانية', why5: { text: 'لم تُقاس تجربة الموظف كمؤشر' } } } } } },
      rootCause: 'تجربة الموظف غير مُقاسة كمؤشر أداء',
      corrective: 'إضافة EX Score كمؤشر تنفيذي مع هدف محدد',
    },
    {
      title: 'تجاوز تكاليف التوظيف',
      problemDesc: 'تكلفة التوظيف 35% فوق المعيار الصناعي',
      tree: { why1: { text: 'الاعتماد على مكاتب خارجية', why2: { text: 'لا يوجد فريق داخلي كافٍ', why3: { text: 'صعوبة التوظيف', why4: { text: 'ميزانية غير كافية', why5: { text: 'لم يُحسب ROI للاستقطاب الداخلي' } } } } } },
      rootCause: 'غياب تحليل ROI للاستقطاب الداخلي',
      corrective: 'بناء نموذج ROI + خطة لتوطين 60% من التوظيف',
    },
  ];
  for (const fw of FIVE_WHYS) {
    await prisma.fiveWhysAnalysis.create({
      data: {
        title: fw.title, problemDesc: fw.problemDesc,
        treeJson: fw.tree, rootCause: fw.rootCause, correctiveAction: fw.corrective,
        createdById: users['admin'].id,
      },
    });
  }

  // ============================================================
  // RISKS: 15 risks C01-C15
  // ============================================================
  console.log('[seed] risks (C01-C15)…');
  const RISKS = [
    { code: 'C01', category: 'strategic',   titleAr: 'فقدان المواهب الرئيسية',         probability: 4, impact: 5 },
    { code: 'C02', category: 'operational', titleAr: 'ضعف عمليات الاستقطاب',           probability: 3, impact: 4 },
    { code: 'C03', category: 'compliance',  titleAr: 'مخالفة أنظمة العمل',              probability: 2, impact: 5 },
    { code: 'C04', category: 'financial',   titleAr: 'تجاوز ميزانية الرواتب',          probability: 3, impact: 4 },
    { code: 'C05', category: 'security',    titleAr: 'تسريب بيانات الموظفين',          probability: 2, impact: 5 },
    { code: 'C06', category: 'strategic',   titleAr: 'ضعف خط القيادة البديلة',          probability: 3, impact: 4 },
    { code: 'C07', category: 'operational', titleAr: 'تأخر تطبيق السياسات الجديدة',    probability: 3, impact: 3 },
    { code: 'C08', category: 'compliance',  titleAr: 'عدم الامتثال لـNitaqat',           probability: 2, impact: 5 },
    { code: 'C09', category: 'financial',   titleAr: 'ارتفاع تكاليف نهاية الخدمة',     probability: 3, impact: 3 },
    { code: 'C10', category: 'security',    titleAr: 'هجمات سيبرانية على HRIS',         probability: 2, impact: 5 },
    { code: 'C11', category: 'strategic',   titleAr: 'فشل التحول الرقمي',              probability: 3, impact: 5 },
    { code: 'C12', category: 'operational', titleAr: 'ضعف جودة بيانات الموظف',         probability: 4, impact: 3 },
    { code: 'C13', category: 'compliance',  titleAr: 'تأخر تحديث السياسات',            probability: 3, impact: 3 },
    { code: 'C14', category: 'financial',   titleAr: 'تذبذب أسعار صرف العملات',        probability: 2, impact: 2 },
    { code: 'C15', category: 'security',    titleAr: 'انقطاع الخدمة',                  probability: 1, impact: 5 },
  ];
  for (const r of RISKS) {
    const score = r.probability * r.impact;
    const level = score >= 20 ? 'critical' : score >= 12 ? 'high' : score >= 6 ? 'medium' : 'low';
    await prisma.risk.create({
      data: {
        code: r.code, category: r.category, titleAr: r.titleAr, titleEn: r.titleAr,
        probability: r.probability, impact: r.impact, score, level,
        mitigationPlan: `خطة تخفيف لـ ${r.titleAr}`,
        status: ['identified','assessed','mitigated','accepted','closed'][Math.floor(Math.random() * 3)],
        ownerId: users['admin'].id,
        reviewDate: daysAhead(30),
      },
    });
  }

  // ============================================================
  // ROADMAP: 52 weeks
  // ============================================================
  console.log('[seed] roadmap (52 weeks)…');
  const ROADMAP_THEMES = [
    'تشخيص النضج الحالي', 'تشخيص الفجوات', 'إعداد الاستراتيجية', 'موافقة الخطة',
    'تأسيس الحوكمة', 'تشكيل فريق التحول', 'إطلاق المرحلة الأولى',
  ];
  for (let week = 1; week <= 52; week++) {
    const theme = ROADMAP_THEMES[(week - 1) % ROADMAP_THEMES.length];
    const status = week < 5 ? 'done' : week < 12 ? 'in_progress' : week < 50 ? 'pending' : 'pending';
    await prisma.roadmapItem.create({
      data: {
        weekNumber: week,
        titleAr: `الأسبوع ${week}: ${theme}`,
        titleEn: `Week ${week}: ${theme}`,
        description: `مهام تفصيلية للأسبوع ${week}`,
        ownerId: users['admin'].id,
        dependencies: week > 1 ? [week - 1] : [],
        deliverable: `مخرج الأسبوع ${week}`,
        kpi: week % 4 === 0 ? 'مؤشر أداء ربع سنوي' : null,
        status,
        targetDate: daysAhead(week * 7),
        completedAt: status === 'done' ? daysAgo((52 - week) * 7) : null,
      },
    });
  }

  // ============================================================
  // INTEGRATION ENDPOINTS
  // ============================================================
  console.log('[seed] integration endpoints…');
  const INTEGRATIONS = [
    { code: 'GOSI',     nameAr: 'مؤسسة التأمينات',    nameEn: 'GOSI',     baseUrl: 'https://api.gosi.gov.sa/v1' },
    { code: 'MOI',      nameAr: 'وزارة العمل',        nameEn: 'Ministry of Labor', baseUrl: 'https://api.mol.gov.sa/v2' },
    { code: 'NAFEES',   nameAr: 'نظام نفيس',          nameEn: 'Nafees',    baseUrl: 'https://nafes.sa/api' },
    { code: 'BANK_SAU', nameAr: 'البنك الأهلي',       nameEn: 'SNB Bank',  baseUrl: 'https://api.alahli.com' },
    { code: 'ABSHER',   nameAr: 'أبشر',              nameEn: 'Absher',     baseUrl: 'https://absher.sa/api' },
  ];
  for (const i of INTEGRATIONS) {
    await prisma.integrationEndpoint.create({
      data: {
        code: i.code, nameAr: i.nameAr, nameEn: i.nameEn,
        baseUrl: i.baseUrl, authType: 'api_key',
        healthStatus: 'healthy', lastCheckedAt: daysAgo(0),
        configJson: { timeout: 5000 },
        isActive: true,
      },
    });
  }

  // ============================================================
  // المحركات الجديدة: إجازات/حضور/رواتب/أداء/تعلم/مواهب/احتفاظ/علاقات/مقيمين/امتثال/طلبات/69 مخطط
  // ============================================================
  const { seedNewEngines } = require('./seed-new-engines');
  await seedNewEngines({ prisma, users, employees, positions, roles, daysAgo, daysAhead, hi });

  // ============================================================
  // طبقة الحوكمة والمواءمة (الوثائق الثلاث): 21 فئة + 32 معادلة + عقود/أقسام/قوى + هوية الناضج
  // ============================================================
  const { seedGovernance } = require('./seed-governance');
  await seedGovernance({ prisma, users, employees, positions, departments: depts });

  // ============================================================
  // SETTINGS
  // ============================================================
  await prisma.setting.upsert({ where: { key: 'org.name_ar' }, update: { value: 'شركة الناضج' }, create: { data: { key: 'org.name_ar', value: 'شركة الناضج' } } });
  await prisma.setting.upsert({ where: { key: 'org.name_en' }, update: { value: 'Alnadij Company' }, create: { data: { key: 'org.name_en', value: 'Alnadij Company' } } });
  await prisma.setting.upsert({ where: { key: 'org.vision_ar' }, update: { value: 'أن نكون الشركة الرائدة في حوكمة الموارد البشرية بالمملكة' }, create: { data: { key: 'org.vision_ar', value: 'أن نكون الشركة الرائدة في حوكمة الموارد البشرية بالمملكة' } } });
  await prisma.setting.upsert({ where: { key: 'system.default_language' }, update: { value: 'ar' }, create: { data: { key: 'system.default_language', value: 'ar' } } });

  // ============================================================
  // AUDIT LOG: a few initial entries
  // ============================================================
  await prisma.auditLog.create({
    data: { userId: users['admin'].id, action: 'system.seed', entityType: 'system', entityId: 'init', reason: 'Initial seed completed' },
  });

  // ============================================================
  // Verification
  // ============================================================
  console.log('\n[verify] counts:');
  const counts = {
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    regions: await prisma.region.count(),
    branches: await prisma.branch.count(),
    departments: await prisma.department.count(),
    positions: await prisma.position.count(),
    employees: await prisma.employee.count(),
    candidates: await prisma.candidate.count(),
    applications: await prisma.application.count(),
    interviews: await prisma.interview.count(),
    offers: await prisma.offer.count(),
    onboardingTasks: await prisma.onboardingTask.count(),
    jobPostings: await prisma.jobPosting.count(),
    knowledgeDocs: await prisma.knowledgeDocument.count(),
    decisions: await prisma.decisionRecord.count(),
    policies: await prisma.policy.count(),
    workflowDefs: await prisma.workflowDefinition.count(),
    complianceRules: await prisma.complianceRule.count(),
    complianceViolations: await prisma.complianceViolation.count(),
    documentExpiries: await prisma.documentExpiry.count(),
    processKPIs: await prisma.processKPI.count(),
    maturityDimensions: await prisma.maturityDimension.count(),
    maturityAssessments: await prisma.maturityAssessment.count(),
    fiveWhysAnalyses: await prisma.fiveWhysAnalysis.count(),
    risks: await prisma.risk.count(),
    roadmapItems: await prisma.roadmapItem.count(),
    integrationEndpoints: await prisma.integrationEndpoint.count(),
    lookups: await prisma.lookup.count(),
    userScopes: await prisma.userScope.count(),
    leaveTypes: await prisma.leaveType.count(),
    leaveBalances: await prisma.leaveBalance.count(),
    leaveRequests: await prisma.leaveRequest.count(),
    attendanceRecords: await prisma.attendanceRecord.count(),
    payrollRuns: await prisma.payrollRun.count(),
    payrollItems: await prisma.payrollItem.count(),
    loans: await prisma.loan.count(),
    bonuses: await prisma.bonus.count(),
    eosCalcs: await prisma.eosCalculation.count(),
    perfCycles: await prisma.perfCycle.count(),
    objectives: await prisma.objective.count(),
    courses: await prisma.course.count(),
    enrollments: await prisma.enrollment.count(),
    successionPlans: await prisma.successionPlan.count(),
    surveys: await prisma.survey.count(),
    surveyResponses: await prisma.surveyResponse.count(),
    disciplinaryCases: await prisma.disciplinaryCase.count(),
    grievances: await prisma.grievance.count(),
    visas: await prisma.visa.count(),
    iqamas: await prisma.iqamaRecord.count(),
    gosiRecords: await prisma.gosiRecord.count(),
    insurancePolicies: await prisma.insurancePolicy.count(),
    insuranceMembers: await prisma.insuranceMember.count(),
    nitaqatSnapshots: await prisma.nitaqatSnapshot.count(),
    requestTypes: await prisma.requestType.count(),
    employeeRequests: await prisma.employeeRequest.count(),
    flowcharts: await prisma.knowledgeDocument.count({ where: { category: 'flowchart' } }),
    lookupCategories: await prisma.lookupCategory.count(),
    formulaDefinitions: await prisma.formulaDefinition.count(),
    changeRequests: await prisma.changeRequest.count(),
    contracts: await prisma.contract.count(),
    sections: await prisma.section.count(),
    transfers: await prisma.transfer.count(),
    promotions: await prisma.promotion.count(),
    qiwaRequests: await prisma.qiwaRequest.count(),
  };
  console.table(counts);
  console.log('\n[seed] Done.');
  console.log('\nDemo credentials (password for all: ' + (process.env.SEED_ADMIN_PASSWORD || 'Admin@12345') + '):');
  for (const u of USER_DEMOS) console.log(`  ${u.username.padEnd(12)} → ${u.role.padEnd(18)} (${u.nameAr})`);
}

main()
  .catch((e) => { console.error('[seed] error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());