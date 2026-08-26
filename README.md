# منصة حوكمة الموارد البشرية والتحوّل المؤسسي

نظام مؤسسي متكامل، موزّع، آمن، قابل للتوسع، يحكم دورة حياة الموظف والمعرفة والامتثال السعودي عبر **13 محرّكاً** و**69 معاملة موثّقة بالمخططات**.

## نظرة عامة

| البعد | القيم |
|---|---|
| الأدوار | **13 دوراً** (`sysadmin, ceo, hr_director, hr_specialist, line_manager, recruiter, payroll_officer, ld_specialist, employee, auditor, security_admin, data_analyst, compliance_officer`) |
| الصلاحيات | **~150 صلاحية** (RBAC + ABAC) |
| الجداول | **75+ جدولاً** في PostgreSQL |
| المحركات | **13 محركاً** (HR Core، Lifecycle، Knowledge، Workflow، Compliance، Analytics، Leaves، Attendance، Payroll، Performance، L&D، Talent، Retention، Relations، Expat، Insurance، Compliance-SA) |
| المعاملات | **69 معاملة** موثقة بمخططات Mermaid حيّة |
| المستخدمون التجريبيون | **14 مستخدماً** (كلمة المرور: `Admin@12345`) |
| البُعد التقني | React 18 + Vite + Tailwind + Mermaid + Node 20 + Express + Prisma + PostgreSQL |

## المعمارية

```
طبقة 13 دوراً → RBAC/ABAC (~150 صلاحية)
         ↓
   13 محرّكاً (HR/Lifecycle/Knowledge/Workflow/Compliance/Analytics/
              Leaves/Attendance/Payroll/Performance/L&D/Talent/
              Retention/Relations/Expat/Insurance/Compliance-SA)
         ↓
   محرك القواعد السعودية (saudiRules.js) + سير العمل (workflow)
         ↓
   PostgreSQL 75+ جدولاً
```

## الأدوار الـ13 وحسابات الدخول

| المستخدم | الدور | النطاق |
|---|---|---|
| `admin` | sysadmin | كل شيء + إدارة النظام |
| `executive` | ceo | قراءة استراتيجية + تنفيذ |
| `hrdir` | hr_director | HR شامل + اعتماد الرواتب |
| `hrmgr` | hr_specialist | العمليات اليومية HR |
| `recruiter` | recruiter | استقطاب ومرشحون |
| `payroll` | payroll_officer | مسيرات + WPS + EOS |
| `lnd` | ld_specialist | دورات + إرشاد + IDP |
| `manager` | line_manager | اعتماد فريقه + تقييمات |
| `keeper` | hr_specialist | معرفة + قرارات |
| `employee` | employee | خدمة ذاتية |
| `auditor` | auditor | قراءة كل شيء + audit |
| `security` | security_admin | جلسات + أحداث أمن |
| `analyst` | data_analyst | تحليلات |
| `compliance` | compliance_officer | نطاقات + PDPL + تقارير |

**كلمة المرور للجميع:** `Admin@12345`

## المحركات الـ13

| # | المحرك | المسار | الوصف |
|---|---|---|---|
| 1 | HR Core | `/api/hr` | الموظفون + الهياكل + العقود |
| 2 | Lifecycle | `/api/lifecycle` | استقطاب → توظيف → تأهيل → نهاية |
| 3 | Knowledge | `/api/knowledge` | وثائق + قرارات (hash chain) + سياسات |
| 4 | Workflow | `/api/workflows` | BPMN-lite + SLA + تصعيد |
| 5 | Compliance | `/api/compliance` | قواعد + تنبيهات انتهاء |
| 6 | Analytics | `/api/analytics` | KPIs + تحليلات |
| 7 | Leaves | `/api/leaves` | 7 أنواع إجازات (21/30/مرضية/حج/أمومة) |
| 8 | Attendance | `/api/attendance` | بصمة/GPS + إضافي (سقف 720) + مخافات تصاعدية |
| 9 | Payroll | `/api/payroll` | مسيرات + GOSI 9.75/11.75 + EOS + WPS + سلف + مكافآت |
| 10 | Performance | `/api/perf` | OKR + تقييم ذاتي/مدير/اعتماد + 360 + PIP |
| 11 | L&D | `/api/lnd` | دورات + جلسات + IDP + إرشاد + شهادات |
| 12 | Talent | `/api/talent` | تعاقب (3 فئات جاهزية) + HiPo |
| 13 | Retention | `/api/retention` | eNPS + نبض + مقابلات بقاء + مؤشرات |
| 14 | Relations | `/api/relations` | تأديب (4 مستويات) + تظلمات (حق التصعيد) |
| 15 | Expat | `/api/expat` | تأشيرات + إقامة + GOSI + GAMCA + توثيق + كفالة + هروب |
| 16 | Insurance | `/api/insurance` | وثائق + أعضاء (نفسه/زوج/ابن) |
| 17 | Compliance-SA | `/api/compliance-sa` | نطاقات + PDPL + WPS + تقارير تنظيمية |
| 18 | Requests | `/api/requests` | مركز الطلبات الموحد (6 أنواع) |
| 19 | Gov Docs | `/api/gov-docs` | مستندات + فترة التجربة (45/60/90) |

## التقنيات

- **Frontend:** React 18 + Vite + Tailwind + Mermaid 11 + Axios
- **Backend:** Node 20 + Express + Prisma 5 + Zod + bcrypt + JWT
- **DB:** PostgreSQL (مع embedded-postgres للتطوير بدون تثبيت)
- **i18n:** العربية RTL + الإنجليزية
- **RBAC:** ~150 صلاحية، مصفوفة منفصلة لكل دور

## التشغيل السريع

### الطريقة الأولى: من المصدر

```bash
# 1) تثبيت الحزم
cd server && npm install
cd ../client && npm install

# 2) قاعدة البيانات المدمجة (المنفذ 5432)
cd ../server && node scripts/db-start.js

# 3) توليد Prisma وإدخال البيانات
set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/hr_gov?schema=public
npx prisma generate
npx prisma db push
node prisma/seed.js

# 4) بناء الواجهة
cd ../client && npm run build

# 5) تشغيل الخادم (يخدم الخلفية على 4000 + يقدم الواجهة المبنية)
cd ../server
set DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/hr_gov?schema=public
node src/index.js
```

ثم افتح `http://localhost:4000`

### الطريقة الثانية: Docker

```bash
docker-compose up --build
```

## الاختبار الآلي

```bash
cd server
node scripts/smoke-test.js
```

**86 فحص آلي** يغطي: المصادقة + 13 دوراً + 19 محركاً + قواعد سعودية (21/30، مرضية، GOSI 9.75%، EOS) + 69 مخطط + عزل الأدوار.

## المسارات المهمة في الواجهة

| المسار | الوصف |
|---|---|
| `/my-hub` | بوابة الخدمة الذاتية (حضور/راتب/إجازات/طلبات/دوراتي) |
| `/employees/new` | نموذج إنشاء موظف كامل |
| `/leaves` | إدارة الإجازات (HR/مدير) |
| `/payroll` | مسيرات + EOS + WPS + سلف + مكافآت |
| `/expat` | الإقامات + التأشيرات + GOSI + GAMCA + التوثيق |
| `/compliance-sa` | نطاقات + PDPL + قواعد نظام العمل |
| `/flowcharts` | مرجع المعاملات الـ69 بمخططات Mermaid حيّة |
| `/security` | جلسات نشطة + استعادة محذوف + محاكاة سير عمل |

## بنية البيانات

75+ جدولاً رئيسياً: `users, roles, employees, branches, departments, positions, leave_types, leave_balances, leave_requests, official_holidays, attendance_records, overtime_requests, attendance_incidents, payroll_runs, payroll_items, loans, bonuses, eos_calculations, perf_cycles, objectives, key_results, perf_reviews, feedback_entries, pips, courses, course_sessions, enrollments, certificates, idps, mentoring_pairs, succession_plans, succession_candidates, hipo_members, surveys, survey_questions, survey_responses, stay_interviews, disciplinary_cases, grievances, visas, iqama_records, gosi_records, gamca_records, attestations, kafala_transfers, huroob_reports, insurance_policies, insurance_members, nitaqat_snapshots, regulatory_reports, request_types, employee_requests, employee_documents, probation_reviews, wps_files, audit_logs, security_events, user_sessions, workflow_definitions, workflow_instances, workflow_steps, maturity_dimensions, maturity_assessments, five_whys_analyses, process_kpis, roadmap_items, risks, decision_records, knowledge_documents, policies, lookups, settings, regions`.

## القواعد السعودية المدمجة (`server/src/utils/saudiRules.js`)

| القاعدة | القيمة |
|---|---|
| الإجازة السنوية | 21 يوم (<5 سنوات) / 30 يوم (≥5 سنوات) |
| المرضية | 30 يوم × 100% + 60 يوم × 75% + 30 يوم × 0% |
| الأمومة | 10 أسابيع بأجر كامل |
| الأبوة | 3 أيام |
| الحج | 10-15 يوم مرة واحدة بعد سنتين |
| الزواج | 5 أيام |
| الحداد | 3-5 أيام |
| GOSI | 9.75% موظف / 11.75% منشأة |
| العمل الإضافي | سقف 720 ساعة/سنة × 1.5 |
| الإقامة | خلال 90 يوم من الدخول + تنبيه قبل 3 أشهر |
| تأشيرة عائلية | راتب > 5000 + 6 أشهر خدمة |
| الخروج النهائي | صلاحية 60 يوم |
| نقل الكفالة | 12 شهر خدمة أو إعفاء (تأخر رواتب/حكم) |
| رخصة العمل | 9000 (>50 موظف) / 7200 (≤50) |
| فترة التجربة | 90 يوم (تقييمات 45/60/90) |
| EOS (استقالة) | شرائح: 0/<2 → 2-5 → 5-10 → >10 |
| EOS (إنهاء) | شرائح أبكر بنفس الحساب |
| نطاقات | 5 نطاقات حسب نسبة التوطين |

## ما هو مغطّى / ما هو جزئي / ما هو غير مغطّى

### مغطّى بالكامل
13 دوراً + ~150 صلاحية + 75 جدولاً + 19 محرك API + 16+ صفحة واجهة + 69 معاملة موثقة بمخططات + القواعد السعودية الـ17 + آلية End-of-Service (EOS) محسوبة آلياً + GOSI 9.75/11.75 + سقف 720 ساعة إضافي + مركز طلبات موحد بسير عمل متعدد الخطوات.

### جزئي / محاكاة
- فحوصات GAMCA: منطق صلاحية 3 أشهر (بدون ربط مع النظام الحكومي)
- WPS: توليد CSV داخلي (بدون رفع فعلي لـ Mudad/SADAD)
- الإقامة: قواعد انتهاء وتجديد فقط
- HR Connector: بنية under-development

### لم يُنفّذ (يتطلب تكاملاً خارجياً)
- MFA الفعلي + الإشعارات Email/SMS + PDF/Excel export + رفع الملفات + التكامل الحي مع GOSI/مقيم/قوى/أبشر + Event Sourcing/CQRS/Saga + Circuit Breaker + Zero Trust.

## الترخيص

ملكية خاصة — للاستخدام الداخلي.
