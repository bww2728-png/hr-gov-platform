/**
 * Seed للمحركات الجديدة: إجازات/حضور/رواتب/أداء/تعلم/مواهب/احتفاظ/علاقات/مقيمين/تأمين/امتثال/طلبات/مخططات
 * يُستدعى من seed.js بعد إنشاء المستخدمين والموظفين.
 */
const saudi = require('../src/utils/saudiRules');

// =====================================================================
// مرجع المعاملات الـ69 — مخططات Mermaid موثقة
// =====================================================================
const FLOWCHARTS = [
  // --- الهيكل والاستقطاب (1-11) ---
  { n: 1, code: 'workforce_plan', titleAr: 'خطة القوى العاملة السنوية', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["مدير HR: إعداد خطة القوى العاملة"] --> B["تحليل الاحتياج لكل إدارة"]\n  B --> C["مطابقة مع الميزانية"]\n  C --> D{"اعتماد المدير التنفيذي؟"}\n  D -->|نعم| E["اعتماد الخطة ونشرها"]\n  D -->|لا| A\n  E --> F["تحويلها إلى إعلانات وظائف"]` },
  { n: 2, code: 'org_restructure', titleAr: 'إعادة هيكلة إدارية', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["مدير HR: اقتراح إعادة الهيكلة"] --> B["دراسة الأثر على الموظفين"]\n  B --> C{"اعتماد CEO؟"}\n  C -->|نعم| D["تحديث الهيكل في النظام"]\n  D --> E["نقل الموظفين المتأثرين"]\n  E --> F["توثيق في سجل التغييرات"]\n  C -->|لا| G["أرشفة المقترح"]` },
  { n: 3, code: 'job_posting', titleAr: 'إعلان وظيفة', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["المدير المباشر: طلب شغل وظيفة"] --> B{"موجودة في خطة القوى العاملة؟"}\n  B -->|نعم| C["مسؤول التوظيف: إنشاء الإعلان"]\n  B -->|لا| D["اعتماد استثنائي من مدير HR"]\n  D --> C\n  C --> E["نشر داخلي + خارجي"]\n  E --> F["بدء استقبال الطلبات"]` },
  { n: 4, code: 'candidate_screening', titleAr: 'استقبال وفرز المرشحين', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["استقبال الطلبات عبر البوابة"] --> B["فرز آلي حسب المتطلبات"]\n  B --> C{"مطابق للحد الأدنى؟"}\n  C -->|نعم| D["قائمة مختصرة"]\n  C -->|لا| E["رفض مهذب + أرشفة"]\n  D --> F["مراجعة مسؤول التوظيف"]\n  F --> G["ترشيح للمقابلات"]` },
  { n: 5, code: 'interview_process', titleAr: 'المقابلات والتقييم', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["جدولة المقابلة مع المرشح"] --> B["مقابلة HR الأولية"]\n  B --> C{"ناجح؟"}\n  C -->|لا| D["رفض + إشعار"]\n  C -->|نعم| E["مقابلة فنية مع المدير المباشر"]\n  E --> F{"ناجح؟"}\n  F -->|لا| D\n  F -->|نعم| G["توصية بالتعيين"]` },
  { n: 6, code: 'job_offer', titleAr: 'إصدار عرض العمل', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["توصية التعيين"] --> B["إعداد العرض: راتب + بدلات + منصب"]\n  B --> C{"اعتماد مدير HR؟"}\n  C -->|لا| A\n  C -->|نعم| D["إرسال العرض للمرشح"]\n  D --> E{"قبول المرشح؟"}\n  E -->|لا| F["تفاوض أو رفض نهائي"]\n  E -->|نعم| G["بدء إجراءات التعيين"]` },
  { n: 7, code: 'hiring_decision', titleAr: 'اعتماد قرار التعيين', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["عرض مقبول"] --> B["التحقق من المستندات والمراجع"]\n  B --> C{"مستوفٍ؟"}\n  C -->|لا| D["إلغاء العرض"]\n  C -->|نعم| E["اعتماد نهائي: مدير HR + CEO للقياديين"]\n  E --> F["إنشاء ملف الموظف"]` },
  { n: 8, code: 'employment_contract', titleAr: 'توقيع عقد العمل', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["إنشاء ملف الموظف"] --> B["إصدار العقد وفق نظام العمل"]\n  B --> C["توقيع الطرفين"]\n  C --> D["توثيق العقد في قوى"]\n  D --> E["تحديد تاريخ المباشرة"]\n  E --> F["بدء برنامج التأهيل"]` },
  { n: 9, code: 'onboarding', titleAr: 'التأهيل الأولي للموظف الجديد', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["اليوم الأول: استقبال وتعريف"] --> B["تجهيز الأدوات والصلاحيات"]\n  B --> C["تعيين زميل مرشد"]\n  C --> D["برنامج تعريفي بالسياسات"]\n  D --> E["متابعة أسبوعية من المدير"]\n  E --> F["إغلاق قائمة مهام التأهيل"]` },
  { n: 10, code: 'internal_transfer', titleAr: 'النقل الداخلي', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["طلب نقل: موظف أو إدارة"] --> B["موافقة المدير الحالي"]\n  B --> C["موافقة المدير المستقبل"]\n  C --> D{"اعتماد HR؟"}\n  D -->|نعم| E["تحديث الهيكل والراتب إن لزم"]\n  E --> F["توثيق في سجل الموظف"]\n  D -->|لا| G["إشعار الرفض"]` },
  { n: 11, code: 'promotion', titleAr: 'الترقية', module: 'الهيكل والاستقطاب', mermaid: `flowchart TD\n  A["ترشيح المدير المباشر"] --> B["مراجعة الأهلية: أداء + مدة"]\n  B --> C{"مستوفٍ؟"}\n  C -->|لا| D["إرجاع مع مبررات"]\n  C -->|نعم| E["اعتماد مدير HR"]\n  E --> F["اعتماد CEO للقياديين"]\n  F --> G["تحديث المنصب والراتب + إشعار"]` },
  // --- شؤون المقيمين - استقدام (12-19) ---
  { n: 12, code: 'work_visa', titleAr: 'إصدار تأشيرة عمل', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["مسؤول التوظيف: طلب تأشيرة عمل"] --> B["التحقق من رصيد التأشيرات"]\n  B --> C["تفويض وزارة الخارجية"]\n  C --> D["تصديق الطلب من السفارة"]\n  D --> E["إصدار التأشيرة"]\n  E --> F["إشعار المرشح بالسفر"]` },
  { n: 13, code: 'arrival_processing', titleAr: 'استقبال الوافد واستكمال الدخول', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["وصول الوافد للمطار"] --> B["تسجيل الدخول في النظام"]\n  B --> C["استلام الجواز والمستندات"]\n  C --> D["حجز فحص طبي محلي"]\n  D --> E["بدء عداد 90 يوم لإصدار الإقامة"]` },
  { n: 14, code: 'gamca_medical', titleAr: 'الفحص الطبي GAMCA', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["حجز موعد GAMCA قبل السفر"] --> B["إجراء الفحص الطبي"]\n  B --> C{"النتيجة لائق؟"}\n  C -->|لا| D["إلغاء إجراءات الاستقدام"]\n  C -->|نعم| E["صلاحية 3 أشهر"]\n  E --> F["استكمال إصدار التأشيرة"]` },
  { n: 15, code: 'iqama_issuance', titleAr: 'إصدار الإقامة خلال 90 يوم', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["دخول الوافد"] --> B["فحص طبي محلي + بصمة"]\n  B --> C["تقديم طلب الإقامة للجوازات"]\n  C --> D{"خلال 90 يوم من الدخول؟"}\n  D -->|نعم| E["استلام الإقامة"]\n  D -->|لا| F["غرامة تأخير + معالجة عاجلة"]\n  E --> G["تحديث ملف الموظف"]` },
  { n: 16, code: 'work_permit', titleAr: 'رخصة العمل ورسومها', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["طلب رخصة عمل عبر قوى"] --> B["حساب الرسوم: 9000 أو 7200 حسب الحجم"]\n  B --> C["السداد عبر سداد"]\n  C --> D["إصدار الرخصة"]\n  D --> E["جدولة التجديد السنوي"]` },
  { n: 17, code: 'gosi_registration', titleAr: 'التسجيل في التأمينات GOSI', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["مباشرة الموظف"] --> B["تسجيل في GOSI خلال المدة النظامية"]\n  B --> C["حساب الحصص: موظف 9.75% + منشأة 11.75%"]\n  C --> D["ربط الأجر الخاضع"]\n  D --> E["اشتراك شهري تلقائي مع الرواتب"]` },
  { n: 18, code: 'family_visa', titleAr: 'تأشيرة زيارة عائلية', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["الموظف المقيم: طلب زيارة عائلية"] --> B{"الراتب أكبر من 5000؟"}\n  B -->|لا| C["رفض: شرط الراتب"]\n  B -->|نعم| D{"خدمة 6 أشهر فأكثر؟"}\n  D -->|لا| E["رفض: شرط المدة"]\n  D -->|نعم| F["تقديم الطلب عبر الخارجية"]\n  F --> G["سداد الرسوم وإصدار التأشيرة"]` },
  { n: 19, code: 'kafala_transfer', titleAr: 'نقل الكفالة', module: 'شؤون المقيمين', mermaid: `flowchart TD\n  A["طلب نقل كفالة"] --> B{"12 شهر خدمة أو سبب إعفاء؟"}\n  B -->|لا| C["رفض"]\n  B -->|نعم| D["موافقة الكفيل الحالي أو إعفاء نظامي"]\n  D --> E["سداد الرسوم 2000-10000"]\n  E --> F["موافقة الجوازات"]\n  F --> G["تحديث بيانات الكفالة"]` },
  // --- التأهيل والتجربة والمستندات (20-25) ---
  { n: 20, code: 'onboarding_90', titleAr: 'برنامج التأهيل 90 يوم', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["قائمة مهام تأهيل تلقائية"] --> B["أسبوع 1: تعريف وسياسات"]\n  B --> C["شهر 1: تدريب على العمل"]\n  C --> D["شهر 2: مهام فعلية بإشراف"]\n  D --> E["شهر 3: استقلالية تدريجية"]\n  E --> F["تقييم نهاية التأهيل"]` },
  { n: 21, code: 'buddy_assignment', titleAr: 'تعيين الزميل المرشد', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["موظف جديد"] --> B["HR يرشح زميلاً من نفس الإدارة"]\n  B --> C["موافقة الزميل والمدير"]\n  C --> D["تعريف بالمهام: مرافقة وإجابة"]\n  D --> E["متابعة شهرية حتى نهاية التجربة"]` },
  { n: 22, code: 'equipment_provisioning', titleAr: 'تجهيز الأدوات والصلاحيات', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["طلب تجهيز تلقائي عند التعيين"] --> B["IT: جهاز + حسابات + بريد"]\n  B --> C["الإدارة: مكتب + أدوات"]\n  C --> D["الأمن: بطاقة دخول"]\n  D --> E["تأكيد الاستلام في قائمة التأهيل"]` },
  { n: 23, code: 'probation_reviews', titleAr: 'تقييمات فترة التجربة 45/60/90', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["تعيين بفترة تجربة 90 يوم"] --> B["تقييم يوم 45"]\n  B --> C{"الأداء؟"}\n  C -->|ضعيف| D["إنذار + خطة تحسين"]\n  C -->|جيد| E["تقييم يوم 60"]\n  D --> E\n  E --> F{"تقدم؟"}\n  F -->|لا| G["إنهاء خلال التجربة"]\n  F -->|نعم| H["تقييم يوم 90: تثبيت"]` },
  { n: 24, code: 'confirmation', titleAr: 'تثبيت الموظف بعد التجربة', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["تقييم يوم 90 ناجح"] --> B["توصية المدير بالتثبيت"]\n  B --> C{"اعتماد HR؟"}\n  C -->|نعم| D["تحديث الحالة: موظف مثبت"]\n  D --> E["استحقاق كامل المزايا"]\n  E --> F["خطاب تثبيت رسمي"]\n  C -->|لا| G["تمديد أو إنهاء"]` },
  { n: 25, code: 'employee_documents', titleAr: 'توثيق مستندات الموظف', module: 'التأهيل والتجربة', mermaid: `flowchart TD\n  A["استلام المستندات: هوية/مؤهل/عقد"] --> B["مطابقة الأصل بالنسخة"]\n  B --> C["أرشفة إلكترونية في الملف"]\n  C --> D["تسجيل تواريخ الانتهاء"]\n  D --> E["تنبيهات تلقائية قبل الانتهاء"]` },
  // --- الحضور (26-28) ---
  { n: 26, code: 'daily_attendance', titleAr: 'تسجيل الحضور اليومي', module: 'الحضور', mermaid: `flowchart TD\n  A["الموظف: بصمة أو GPS عند الدخول"] --> B["تسجيل وقت الحضور"]\n  B --> C{"بعد 8:00 صباحاً؟"}\n  C -->|نعم| D["احتساب دقائق تأخير"]\n  C -->|لا| E["حضور نظامي"]\n  D --> F["بصمة الانصراف"]\n  E --> F\n  F --> G["حساب ساعات العمل"]` },
  { n: 27, code: 'overtime', titleAr: 'طلب العمل الإضافي', module: 'الحضور', mermaid: `flowchart TD\n  A["الموظف: طلب عمل إضافي بسبب"] --> B{"اعتماد المدير؟"}\n  B -->|لا| C["رفض"]\n  B -->|نعم| D{"ضمن سقف 720 ساعة سنوياً؟"}\n  D -->|لا| E["رفض: تجاوز السقف"]\n  D -->|نعم| F["تسجيل الساعات الفعلية"]\n  F --> G["احتساب 1.5x في مسير الرواتب"]` },
  { n: 28, code: 'late_absence', titleAr: 'معالجة التأخر والغياب', module: 'الحضور', mermaid: `flowchart TD\n  A["رصد تأخر أو غياب"] --> B{"يوجد عذر مقبول؟"}\n  B -->|نعم| C["توثيق العذر: بلا إجراء"]\n  B -->|لا| D{"التكرار؟"}\n  D -->|أولى| E["إنذار أول"]\n  D -->|ثانية| F["إنذار ثانٍ"]\n  D -->|ثالثة+| G["خصم + إحالة تأديبية"]` },
  // --- الإجازات (29-36) ---
  { n: 29, code: 'annual_leave', titleAr: 'الإجازة السنوية', module: 'الإجازات', mermaid: `flowchart TD\n  A["الموظف: طلب إجازة سنوية"] --> B{"الرصيد كافٍ؟ 21 أو 30 يوم"} \n  B -->|لا| C["رفض: الرصيد غير كافٍ"]\n  B -->|نعم| D{"موافقة المدير؟"}\n  D -->|لا| E["رفض"]\n  D -->|نعم| F["اعتماد HR"]\n  F --> G["خصم من الرصيد + جدولة البديل"]` },
  { n: 30, code: 'sick_leave', titleAr: 'الإجازة المرضية', module: 'الإجازات', mermaid: `flowchart TD\n  A["طلب إجازة مرضية بتقرير طبي"] --> B["حساب الاستخدام السنوي"]\n  B --> C{"الشريحة؟"}\n  C -->|أول 30 يوم| D["أجر كامل 100%"]\n  C -->|31-90 يوم| E["أجر 75%"]\n  C -->|91-120 يوم| F["بدون أجر 0%"]\n  D --> G["اعتماد وتوثيق"]\n  E --> G\n  F --> G` },
  { n: 31, code: 'maternity_leave', titleAr: 'إجازة الأمومة', module: 'الإجازات', mermaid: `flowchart TD\n  A["طلب إجازة أمومة"] --> B["10 أسابيع بأجر كامل"]\n  B --> C["حتى 4 أسابيع قبل الولادة"]\n  C --> D["اعتماد HR الآلي"]\n  D --> E["ساعة رضاعة يومياً بعد العودة"]\n  E --> F["حماية من الفصل أثناء الإجازة"]` },
  { n: 32, code: 'paternity_leave', titleAr: 'إجازة الأبوة', module: 'الإجازات', mermaid: `flowchart TD\n  A["طلب إجازة أبوة خلال أسبوع من الولادة"] --> B["3 أيام بأجر كامل"]\n  B --> C["اعتماد المدير"]\n  C --> D["توثيق في الرصيد"]` },
  { n: 33, code: 'hajj_leave', titleAr: 'إجازة الحج', module: 'الإجازات', mermaid: `flowchart TD\n  A["طلب إجازة حج"] --> B{"خدمة سنتان فأكثر؟"}\n  B -->|لا| C["رفض: شرط المدة"]\n  B -->|نعم| D{"أول مرة في الخدمة؟"}\n  D -->|لا| E["رفض: تُمنح مرة واحدة"]\n  D -->|نعم| F["10-15 يوم بأجر"]\n  F --> G["اعتماد HR وتوثيق الاستخدام"]` },
  { n: 34, code: 'marriage_bereavement', titleAr: 'إجازة الزواج والحداد', module: 'الإجازات', mermaid: `flowchart TD\n  A["طلب إجازة زواج أو حداد"] --> B{"النوع؟"}\n  B -->|زواج| C["5 أيام بأجر كامل"]\n  B -->|حداد| D["3-5 أيام حسب القرابة"]\n  C --> E["اعتماد المدير + توثيق"]\n  D --> E` },
  { n: 35, code: 'leave_balance', titleAr: 'استحقاق وترحيل أرصدة الإجازات', module: 'الإجازات', mermaid: `flowchart TD\n  A["نهاية كل شهر: تراكم تلقائي"] --> B{"سنوات الخدمة؟"}\n  B -->|أقل من 5| C["1.75 يوم شهرياً = 21 سنوياً"]\n  B -->|5 فأكثر| D["2.5 يوم شهرياً = 30 سنوياً"]\n  C --> E["نهاية السنة: ترحيل حتى 10 أيام"]\n  D --> E\n  E --> F["تحديث الرصيد المتاح"]` },
  { n: 36, code: 'official_holidays', titleAr: 'العطل الرسمية', module: 'الإجازات', mermaid: `flowchart TD\n  A["HR: إدخال العطل الرسمية سنوياً"] --> B["عيد الفطر + عيد الأضحى"]\n  B --> C["اليوم الوطني + يوم التأسيس"]\n  C --> D["استثناء تلقائي من الحضور"]\n  D --> E["بأجر كامل حسب النظام"]` },
  // --- الأداء (37-41) ---
  { n: 37, code: 'okr_setting', titleAr: 'اعتماد الأهداف OKR', module: 'الأداء', mermaid: `flowchart TD\n  A["بداية الدورة: الموظف يقترح أهدافاً"] --> B["نتائج مفتاحية قابلة للقياس"]\n  B --> C["مراجعة المدير وموازنة الأوزان"]\n  C --> D{"اعتماد؟"}\n  D -->|لا| A\n  D -->|نعم| E["تفعيل الأهداف ومتابعة ربعية"]` },
  { n: 38, code: 'annual_review', titleAr: 'التقييم السنوي', module: 'الأداء', mermaid: `flowchart TD\n  A["فتح دورة التقييم"] --> B["تقييم ذاتي من الموظف"]\n  B --> C["تقييم المدير المباشر"]\n  C --> D["معايرة بين المديرين"]\n  D --> E["اعتماد مدير HR النهائي"]\n  E --> F["ربط النتيجة بالمكافآت والترقيات"]` },
  { n: 39, code: 'feedback_360', titleAr: 'التغذية الراجعة 360', module: 'الأداء', mermaid: `flowchart TD\n  A["اختيار المُقيَّم"] --> B["دعوات: مدير + أقران + مرؤوسين"]\n  B --> C["إجابات سرية مجهولة"]\n  C --> D["تجميع النتائج آلياً"]\n  D --> E["تقرير تنموي للموظف والمدير"]` },
  { n: 40, code: 'continuous_feedback', titleAr: 'التغذية المستمرة', module: 'الأداء', mermaid: `flowchart TD\n  A["أي وقت: ملاحظة من مدير أو زميل"] --> B["تصنيف: إيجابية أو بناءة"]\n  B --> C["إشعار للموظف"]\n  C --> D["تُرشح لملف الأداء السنوي"]` },
  { n: 41, code: 'pip', titleAr: 'خطة تحسين الأداء PIP', module: 'الأداء', mermaid: `flowchart TD\n  A["أداء دون التوقعات"] --> B["المدير + HR: خطة 30-90 يوم"]\n  B --> C["أهداف محددة + دعم وموارد"]\n  C --> D["متابعة أسبوعية موثقة"]\n  D --> E{"النتيجة؟"}\n  E -->|نجاح| F["إغلاق الخطة: عودة طبيعية"]\n  E -->|فشل| G["إجراء وفق اللوائح"]` },
  // --- التعلم (42-46) ---
  { n: 42, code: 'training_request', titleAr: 'طلب دورة تدريبية', module: 'التعلم والتطوير', mermaid: `flowchart TD\n  A["الموظف: طلب دورة من الكتالوج"] --> B{"موافقة المدير؟"}\n  B -->|لا| C["رفض"]\n  B -->|نعم| D{"مقاعد متاحة؟"}\n  D -->|لا| E["قائمة انتظار"]\n  D -->|نعم| F["تسجيل + إشعار بالموعد"]` },
  { n: 43, code: 'internal_course', titleAr: 'تنفيذ دورة داخلية', module: 'التعلم والتطوير', mermaid: `flowchart TD\n  A["مسؤول التعلم: جدولة جلسة"] --> B["تسجيل المشاركين"]\n  B --> C["تنفيذ + تسجيل الحضور"]\n  C --> D["تقييم كيركباتريك: رد الفعل"]\n  D --> E["قياس التعلم باختبار"]\n  E --> F["تحديث سجلات الموظفين"]` },
  { n: 44, code: 'external_course', titleAr: 'دورة خارجية', module: 'التعلم والتطوير', mermaid: `flowchart TD\n  A["طلب دورة خارجية مع التكلفة"] --> B["موافقة المدير"]\n  B --> C{"اعتماد الميزانية؟"}\n  C -->|لا| D["رفض"]\n  C -->|نعم| E["سداد الرسوم والتسجيل"]\n  E --> F["إرفاق الشهادة بعد الإتمام"]` },
  { n: 45, code: 'idp', titleAr: 'خطة التطوير الفردية IDP', module: 'التعلم والتطوير', mermaid: `flowchart TD\n  A["تحليل فجوات المهارات مع المدير"] --> B["أهداف تطويرية + إجراءات"]\n  B --> C["جدول زمني وموارد"]\n  C --> D["اعتماد المدير"]\n  D --> E["مراجعة تقدم ربعية"]\n  E --> F["تحديث نسبة الإنجاز"]` },
  { n: 46, code: 'mentoring', titleAr: 'الإرشاد المهني', module: 'التعلم والتطوير', mermaid: `flowchart TD\n  A["ترشيح مرشد ومسترشد"] --> B["اتفاق أهداف الإرشاد"]\n  B --> C["جلسات دورية موثقة"]\n  C --> D["تقييم منتصف المدة"]\n  D --> E["إغلاق بتقييم الطرفين"]` },
  // --- المواهب (47-49) ---
  { n: 47, code: 'succession_planning', titleAr: 'خطط التعاقب الوظيفي', module: 'المواهب', mermaid: `flowchart TD\n  A["تحديد المناصب الحرجة"] --> B["ترشيح خلفاء لكل منصب"]\n  B --> C["تصنيف الجاهزية: الآن/سنة/2-3 سنوات"]\n  C --> D["خطط تطوير لكل خليفة"]\n  D --> E["اعتماد مدير HR"]\n  E --> F["مراجعة سنوية"]` },
  { n: 48, code: 'hipo_program', titleAr: 'برنامج المواهب عالية الإمكانات', module: 'المواهب', mermaid: `flowchart TD\n  A["ترشيح HiPo من المديرين"] --> B["تقييم مركزي: أداء + إمكانات"]\n  B --> C{"قبول؟"}\n  C -->|لا| D["إرجاع"]\n  C -->|نعم| E["برنامج تطوير مسرّع"]\n  E --> F["مشاريع قيادية + إرشاد تنفيذي"]` },
  { n: 49, code: 'talent_review', titleAr: 'مراجعة المواهب السنوية', module: 'المواهب', mermaid: `flowchart TD\n  A["جمع بيانات الأداء والإمكانات"] --> B["مصفوفة 9-Box لكل موظف"]\n  B --> C["جلسة معايرة القيادات"]\n  C --> D["قرارات: تطوير/ترقية/تعاقب"]\n  D --> E["متابعة تنفيذ القرارات"]` },
  // --- الرواتب والمكافآت والاحتفاظ (50-56) ---
  { n: 50, code: 'monthly_payroll', titleAr: 'مسير الرواتب الشهري', module: 'الرواتب', mermaid: `flowchart TD\n  A["مسؤول الرواتب: إنشاء مسير الشهر"] --> B["جمع: حضور + إضافي + خصومات"]\n  B --> C["حساب GOSI والسلف والمكافآت"]\n  C --> D["مراجعة مسؤول رواتب ثانٍ"]\n  D --> E{"اعتماد مدير HR؟"}\n  E -->|لا| B\n  E -->|نعم| F["تحويل بنكي + قسائم"]\n  F --> G["توليد ملف WPS"]` },
  { n: 51, code: 'loan_request', titleAr: 'طلب سلفة', module: 'الرواتب', mermaid: `flowchart TD\n  A["الموظف: طلب سلفة + مدة السداد"] --> B{"سلفة نشطة سابقة؟"}\n  B -->|نعم| C["رفض تلقائي"]\n  B -->|لا| D["اعتماد مسؤول الرواتب"]\n  D --> E["جدولة خصم شهري تلقائي"]\n  E --> F["إقفال عند اكتمال السداد"]` },
  { n: 52, code: 'bonus_cycle', titleAr: 'دورة المكافآت', module: 'الرواتب', mermaid: `flowchart TD\n  A["ترشيح مكافأة من المدير"] --> B["مراجعة HR: مطابقة السياسة"]\n  B --> C{"اعتماد مدير HR؟"}\n  C -->|لا| D["رفض"]\n  C -->|نعم| E["ربط بمسير الشهر التالي"]\n  E --> F["صرف مع الراتب"]` },
  { n: 53, code: 'salary_adjustment', titleAr: 'تعديل الراتب', module: 'الرواتب', mermaid: `flowchart TD\n  A["مقترح تعديل: ترقية/علاوة/معايرة"] --> B["مراجعة الميزانية"]\n  B --> C{"اعتماد مدير HR؟"}\n  C -->|لا| D["أرشفة"]\n  C -->|نعم| E["تاريخ سريان محدد"]\n  E --> F["تحديث العقد وGOSI والمسير"]` },
  { n: 54, code: 'enps_survey', titleAr: 'استطلاع eNPS', module: 'الاحتفاظ', mermaid: `flowchart TD\n  A["HR: إطلاق استطلاع مجهول"] --> B["سؤال 0-10: توصي بالعمل هنا؟"]\n  B --> C["إغلاق وجمع الإجابات"]\n  C --> D["حساب: مروّجون % − منتقدون %"]\n  D --> E["نشر النتيجة وخطط التحسين"]` },
  { n: 55, code: 'stay_interview', titleAr: 'مقابلة البقاء', module: 'الاحتفاظ', mermaid: `flowchart TD\n  A["اختيار موظفين مؤثرين"] --> B["المدير: مقابلة لماذا تبقى؟"]\n  B --> C["توثيق المخاطر والدوافع"]\n  C --> D["إجراءات احتفاظ شخصية"]\n  D --> E["متابعة دورية"]` },
  { n: 56, code: 'eos_settlement', titleAr: 'حساب نهاية الخدمة', module: 'الرواتب', mermaid: `flowchart TD\n  A["انتهاء علاقة العمل"] --> B{"سبب الانتهاء؟"}\n  B -->|استقالة| C["أقل من 2: صفر / 2-5: نصف شهر / 5-10: نصف+شهر / أكثر: شرائح"]\n  B -->|إنهاء مشروع| D["أقل من 2: صفر / بعدها: نصف إلى 5 ثم شهر"]\n  B -->|تقاعد| E["استحقاق كامل"]\n  C --> F["+ مستحقات أخرى: رصيد إجازات"]\n  D --> F\n  E --> F\n  F --> G["اعتماد وصرف خلال أسبوعين"]` },
  // --- الخدمات والتأمين (57-58) ---
  { n: 57, code: 'hr_certificate', titleAr: 'إصدار شهادات وإفادات الموظف', module: 'الخدمات', mermaid: `flowchart TD\n  A["الموظف: طلب إفادة/شهادة عبر البوابة"] --> B{"النوع؟"}\n  B -->|راتب| C["تحقق من صلاحية الاطلاع"]\n  B -->|خدمة| D["إصدار تلقائي ببيانات الملف"]\n  C --> E["اعتماد HR"]\n  D --> F["إشعار بالتحميل"]\n  E --> F` },
  { n: 58, code: 'health_insurance', titleAr: 'التأمين الصحي', module: 'الخدمات', mermaid: `flowchart TD\n  A["مباشرة الموظف"] --> B["إضافة لوثيقة التأمين الجماعي"]\n  B --> C["إصدار بطاقة خلال أيام"]\n  C --> D["إضافة التابعين المستحقين"]\n  D --> E["حذف عند انتهاء الخدمة"]` },
  // --- دورة الحياة المتأخرة (59-64) ---
  { n: 59, code: 'resignation', titleAr: 'الاستقالة', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["الموظف: تقديم استقالة"] --> B["إشعار المدير وHR"]\n  B --> C["فترة إشعار 60 يوم أو حسب العقد"]\n  C --> D["محاولة احتفاظ اختيارية"]\n  D --> E["قبول نهائي وتحديد آخر يوم"]` },
  { n: 60, code: 'termination', titleAr: 'إنهاء الخدمة', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["طلب إنهاء بسبب موثق"] --> B["مراجعة قانونية للمادة النظامية"]\n  B --> C{"اعتماد مدير HR؟"}\n  C -->|لا| D["إرجاع"]\n  C -->|نعم| E["إشعار رسمي للموظف"]\n  E --> F["بدء التسوية النهائية"]` },
  { n: 61, code: 'retirement', titleAr: 'التقاعد', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["بلوغ سن التقاعد أو طلب مبكر"] --> B["تحقق الأهلية من HR"]\n  B --> C["اعتماد القرار"]\n  C --> D["تكريم وتسليم المعرفة"]\n  D --> E["تسوية كاملة + ربط التأمينات"]` },
  { n: 62, code: 'exit_interview', titleAr: 'مقابلة الخروج', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["آخر أسبوع: دعوة مقابلة خروج"] --> B["أسئلة: أسباب المغادرة الحقيقية"]\n  B --> C["توثيق سري"]\n  C --> D["تحليل أسباب الدوران"]\n  D --> E["تغذية لخطط الاحتفاظ"]` },
  { n: 63, code: 'clearance', titleAr: 'إخلاء الطرف', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["قائمة إخلاء تلقائية"] --> B["IT: إغلاق الحسابات واسترجاع الأجهزة"]\n  B --> C["المالية: سداد الالتزامات"]\n  C --> D["الإدارة: تسليم العهد والملفات"]\n  D --> E{"كل البنود مكتملة؟"}\n  E -->|لا| F["إشعار الجهة المتأخرة"]\n  E -->|نعم| G["اعتماد الإخلاء"]` },
  { n: 64, code: 'final_settlement', titleAr: 'التسوية النهائية', module: 'نهاية الخدمة', mermaid: `flowchart TD\n  A["إخلاء طرف مكتمل"] --> B["حساب نهاية الخدمة آلياً"]\n  B --> C["+ رصيد إجازات نقدي"]\n  C --> D["- خصومات مستحقة"]\n  D --> E["اعتماد مسؤول الرواتب"]\n  E --> F["تحويل بنكي + مخالصة نهائية"]` },
  // --- العلاقات العمالية (65-68) ---
  { n: 65, code: 'disciplinary_investigation', titleAr: 'التحقيق في مخالفة', module: 'العلاقات العمالية', mermaid: `flowchart TD\n  A["بلاغ مخالفة موثق"] --> B["HR: فتح قضية تحقيق"]\n  B --> C["جمع الأدلة والشهادات"]\n  C --> D["استدعاء الموظف لسماع دفاعه"]\n  D --> E["محضر تحقيق موقع"]\n  E --> F["توصية بالإجراء"]` },
  { n: 66, code: 'disciplinary_action', titleAr: 'الإجراء التأديبي', module: 'العلاقات العمالية', mermaid: `flowchart TD\n  A["توصية التحقيق"] --> B{"جسامة المخالفة؟"}\n  B -->|بسيطة| C["إنذار كتابي"]\n  B -->|متوسطة| D["غرامة/خصم نظامي"]\n  B -->|جسيمة| E["فصل وفق المادة 80"]\n  C --> F["إبلاغ الموظف كتابياً"]\n  D --> F\n  E --> F\n  F --> G["حق التظلم خلال 30 يوم"]` },
  { n: 67, code: 'grievance', titleAr: 'التظلم والشكوى', module: 'العلاقات العمالية', mermaid: `flowchart TD\n  A["الموظف: تظلم عبر البوابة"] --> B["HR: استلام وتصنيف"]\n  B --> C["تحقيق مستقل"]\n  C --> D["رد رسمي خلال المدة"]\n  D --> E{"الموظف راضٍ؟"}\n  E -->|نعم| F["إغلاق"]\n  E -->|لا| G["تصعيد"]` },
  { n: 68, code: 'grievance_escalation', titleAr: 'تصعيد التظلم', module: 'العلاقات العمالية', mermaid: `flowchart TD\n  A["تظلم غير محلول"] --> B["تصعيد لمدير HR"]\n  B --> C["لجنة مراجعة مستقلة"]\n  C --> D["قرار نهائي موثق"]\n  D --> E["إرشاد لسبل التقاضي الخارجية إن لزم"]` },
  // --- الامتثال (69) ---
  { n: 69, code: 'nitaqat', titleAr: 'نطاقات التوطين', module: 'الامتثال', mermaid: `flowchart TD\n  A["حساب نسبة التوطين دورياً"] --> B{"النسبة؟"}\n  B -->|40%+| C["بلاتيني: مزايا كاملة"]\n  B -->|22-40%| D["أخضر: مزايا جيدة"]\n  B -->|8-22%| E["أصفر: قيود جزئية"]\n  B -->|أقل| F["أحمر: إيقاف خدمات"]\n  C --> G["خطة تحسين مستمرة"]\n  D --> G\n  E --> G\n  F --> G` },
];

// =====================================================================
async function seedNewEngines(ctx) {
  const { prisma, users, employees, positions, daysAgo, daysAhead } = ctx;
  const year = new Date().getFullYear();
  const expats = employees.filter((e) => e.residentType === 'expat');
  const saudis = employees.filter((e) => e.residentType === 'saudi');

  // ============ أنواع الإجازات (قواعد نظام العمل) ============
  console.log('[seed] leave types + holidays…');
  const LEAVE_TYPES = [
    { code: 'annual',      nameAr: 'إجازة سنوية',      nameEn: 'Annual Leave',      rulesJson: { daysPerYear: 21, daysPerYear5Plus: 30, accrualMonthlyBelow5: 1.75, accrualMonthlyAbove5: 2.5, maxCarryOver: 10 } },
    { code: 'sick',        nameAr: 'إجازة مرضية',      nameEn: 'Sick Leave',        rulesJson: { maxDaysPerYear: 120, payTiers: [{ upto: 30, pct: 100 }, { upto: 90, pct: 75 }, { upto: 120, pct: 0 }], requiresDocs: true } },
    { code: 'maternity',   nameAr: 'إجازة أمومة',      nameEn: 'Maternity Leave',   rulesJson: { daysPerYear: 70, weeks: 10, payPct: 100, gender: 'F' } },
    { code: 'paternity',   nameAr: 'إجازة أبوة',       nameEn: 'Paternity Leave',   rulesJson: { daysPerYear: 3, payPct: 100, gender: 'M' } },
    { code: 'hajj',        nameAr: 'إجازة حج',         nameEn: 'Hajj Leave',        rulesJson: { daysMin: 10, daysMax: 15, minServiceYears: 2, oncePerService: true, payPct: 100 } },
    { code: 'marriage',    nameAr: 'إجازة زواج',       nameEn: 'Marriage Leave',    rulesJson: { daysPerYear: 5, oncePerService: false, payPct: 100 } },
    { code: 'bereavement', nameAr: 'إجازة حداد',       nameEn: 'Bereavement Leave', rulesJson: { daysPerYear: 5, payPct: 100 } },
  ];
  const leaveTypes = {};
  for (const t of LEAVE_TYPES) leaveTypes[t.code] = await prisma.leaveType.create({ data: t });

  const HOLIDAYS = [
    { nameAr: 'عيد الفطر المبارك', nameEn: 'Eid Al-Fitr', start: 0, len: 4 },
    { nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid Al-Adha', start: 70, len: 4 },
    { nameAr: 'اليوم الوطني السعودي', nameEn: 'Saudi National Day', start: 120, len: 1 },
    { nameAr: 'يوم التأسيس', nameEn: 'Founding Day', start: 150, len: 1 },
  ];
  for (const h of HOLIDAYS) {
    await prisma.officialHoliday.create({
      data: { nameAr: h.nameAr, nameEn: h.nameEn, startDate: daysAhead(h.start), endDate: daysAhead(h.start + h.len - 1), year },
    });
  }

  // أرصدة الإجازات لكل الموظفين (سنوي + مرضي)
  console.log('[seed] leave balances…');
  for (const emp of employees) {
    for (const code of ['annual', 'sick']) {
      const t = leaveTypes[code];
      const entitled = code === 'annual' ? saudi.annualEntitlement(emp.hireDate) : 120;
      await prisma.leaveBalance.create({
        data: {
          employeeId: emp.id, leaveTypeId: t.id, year,
          entitled, accrued: entitled,
          used: code === 'annual' ? (employees.indexOf(emp) % 4) * 2 : 0,
        },
      });
    }
  }

  // طلبات إجازة متنوعة الحالات
  const lr1 = await prisma.leaveRequest.create({
    data: {
      employeeId: employees[0].id, leaveTypeId: leaveTypes.annual.id,
      startDate: daysAhead(14), endDate: daysAhead(18), days: 5,
      reason: 'سفر عائلي', status: 'manager_approved', managerId: employees[5].id,
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[2].id, leaveTypeId: leaveTypes.sick.id,
      startDate: daysAgo(10), endDate: daysAgo(8), days: 3,
      reason: 'تقرير طبي مرفق', status: 'approved',
      managerId: employees[5].id, hrApproverId: users['hrdir'].id, decidedAt: daysAgo(9),
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: employees[7].id, leaveTypeId: leaveTypes.annual.id,
      startDate: daysAhead(30), endDate: daysAhead(39), days: 10,
      reason: 'إجازة منتصف السنة', status: 'pending',
    },
  });

  // ============ الحضور ============
  console.log('[seed] attendance…');
  for (let d = 0; d < 10; d++) {
    for (const emp of employees.slice(0, 8)) {
      const day = daysAgo(d);
      if (day.getDay() === 5 || day.getDay() === 6) continue; // جمعة/سبت
      const late = (d + employees.indexOf(emp)) % 5 === 0 ? 20 : 0;
      const checkIn = new Date(day); checkIn.setHours(8, late, 0, 0);
      const checkOut = new Date(day); checkOut.setHours(17, 0, 0, 0);
      await prisma.attendanceRecord.create({
        data: {
          employeeId: emp.id, date: new Date(day.getFullYear(), day.getMonth(), day.getDate()),
          checkIn, checkOut, method: d % 2 === 0 ? 'fingerprint' : 'gps',
          lateMins: late, workedHours: 9 - late / 60, status: 'present',
        },
      });
    }
  }
  // غياب موظف واحد
  const absentDay = daysAgo(2);
  await prisma.attendanceRecord.create({
    data: {
      employeeId: employees[9].id, date: new Date(absentDay.getFullYear(), absentDay.getMonth(), absentDay.getDate()),
      status: 'absent',
    },
  });
  await prisma.attendanceIncident.create({
    data: {
      employeeId: employees[9].id, type: 'absence', date: absentDay,
      hasExcuse: false, action: 'warning_1', occurrence: 1, resolvedById: users['hrmgr'].id,
    },
  });
  await prisma.overtimeRequest.create({
    data: {
      employeeId: employees[3].id, date: daysAgo(3), hours: 3,
      reason: 'إغلاق شهر مالي', status: 'approved', approvedById: users['manager'].id, decidedAt: daysAgo(3),
    },
  });
  await prisma.overtimeRequest.create({
    data: {
      employeeId: employees[4].id, date: daysAhead(1), hours: 4,
      reason: 'إطلاق مشروع عاجل', status: 'pending',
    },
  });

  // ============ الرواتب ============
  console.log('[seed] payroll…');
  const prevMonth = new Date(); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const pMonth = prevMonth.getMonth() + 1; const pYear = prevMonth.getFullYear();
  const run = await prisma.payrollRun.create({
    data: {
      code: `PAY-${pYear}-${String(pMonth).padStart(2, '0')}`,
      month: pMonth, year: pYear, status: 'paid', paidAt: daysAgo(5),
      preparedById: users['payroll'].id, reviewedById: users['payroll'].id, approvedById: users['hrdir'].id,
    },
  });
  let totalGross = 0; let totalNet = 0; let totalGosi = 0;
  for (const emp of employees.filter((e) => e.employmentStatus === 'active')) {
    const base = Number(emp.salary);
    const housing = Math.round(base * 0.25 * 100) / 100;
    const transport = 500;
    const gosi = saudi.gosiShares(base + housing);
    const gross = Math.round((base + housing + transport) * 100) / 100;
    const net = Math.round((gross - gosi.employee) * 100) / 100;
    await prisma.payrollItem.create({
      data: {
        runId: run.id, employeeId: emp.id, baseSalary: base, housing, transport,
        gosiEmployee: gosi.employee, gosiEmployer: gosi.employer,
        gross, net, iban: emp.iban,
      },
    });
    totalGross += gross; totalNet += net; totalGosi += gosi.employer;
  }
  await prisma.payrollRun.update({
    where: { id: run.id },
    data: { totalGross: Math.round(totalGross * 100) / 100, totalNet: Math.round(totalNet * 100) / 100, totalGosi: Math.round(totalGosi * 100) / 100 },
  });
  await prisma.wpsFile.create({
    data: { payrollRunId: run.id, month: pMonth, year: pYear, fileRef: `WPS-${pYear}-${pMonth}-SEED`, status: 'confirmed', uploadedAt: daysAgo(5), confirmedAt: daysAgo(4) },
  });

  // سلفة نشطة + مكافأة
  await prisma.loan.create({
    data: {
      employeeId: employees[6].id, amount: 12000, months: 12, monthlyDeduct: 1000,
      remaining: 9000, reason: 'ظروف عائلية', status: 'active',
      approvedById: users['payroll'].id, startDate: daysAgo(90),
    },
  });
  await prisma.bonus.create({
    data: {
      employeeId: employees[1].id, amount: 5000, type: 'performance',
      reason: 'أداء استثنائي في الربع الماضي', status: 'approved', nominatedById: users['manager'].id,
    },
  });

  // حساب EOS تجريبي
  const eosEmp = employees[23];
  const eosCalc = saudi.calculateEOS({ hireDate: eosEmp.hireDate, lastSalary: Number(eosEmp.salary), reason: 'resignation' });
  await prisma.eosCalculation.create({
    data: {
      employeeId: eosEmp.id, reason: 'resignation', serviceYears: eosCalc.years,
      lastSalary: Number(eosEmp.salary), eosAmount: eosCalc.eosAmount,
      otherDues: 0, totalPayable: eosCalc.eosAmount, formulaJson: eosCalc,
      calculatedById: users['payroll'].id,
    },
  });

  // ============ الأداء ============
  console.log('[seed] performance…');
  const cycle = await prisma.perfCycle.create({
    data: { code: `CYCLE-${year}`, nameAr: `دورة الأداء ${year}`, startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31) },
  });
  const obj = await prisma.objective.create({
    data: {
      employeeId: employees[0].id, cycleId: cycle.id,
      title: 'رفع كفاءة عمليات الإدارة', description: 'تحسين زمن الإنجاز وخفض الأخطاء',
      status: 'active',
      keyResults: {
        create: [
          { title: 'خفض زمن إنجاز الطلبات', targetValue: 3, currentValue: 4.5, unit: 'يوم' },
          { title: 'نسبة رضا العملاء الداخليين', targetValue: 90, currentValue: 78, unit: '%' },
        ],
      },
    },
    include: { keyResults: true },
  });
  await prisma.perfReview.create({
    data: {
      employeeId: employees[0].id, cycleId: cycle.id, reviewerId: users['manager'].id,
      selfScore: 4.2, status: 'pending_manager',
    },
  });
  await prisma.feedbackEntry.create({
    data: {
      employeeId: employees[0].id, giverId: employees[3].id, type: 'peer',
      content: 'تعاون ممتاز في مشروع التحول الرقمي والتزام بالمواعيد.',
      sentiment: 'positive', isAnonymous: true,
    },
  });

  // ============ التعلم ============
  console.log('[seed] L&D…');
  const course1 = await prisma.course.create({
    data: { code: 'CRS-EXCEL', titleAr: 'إكسل المتقدم للمحللين', titleEn: 'Advanced Excel', category: 'technical', provider: 'internal', durationHrs: 12 },
  });
  const course2 = await prisma.course.create({
    data: { code: 'CRS-LEAD', titleAr: 'القيادة للمدراء الجدد', titleEn: 'Leadership 101', category: 'leadership', provider: 'external', durationHrs: 24 },
  });
  const course3 = await prisma.course.create({
    data: { code: 'CRS-PDPL', titleAr: 'أساسيات حماية البيانات PDPL', titleEn: 'PDPL Fundamentals', category: 'compliance', provider: 'internal', durationHrs: 6 },
  });
  const session1 = await prisma.courseSession.create({
    data: { courseId: course1.id, startDate: daysAhead(7), endDate: daysAhead(9), location: 'online', trainerName: 'م. سامي الحربي', capacity: 20 },
  });
  const session2 = await prisma.courseSession.create({
    data: { courseId: course3.id, startDate: daysAgo(15), endDate: daysAgo(15), location: 'onsite', trainerName: 'إدارة الامتثال', capacity: 30, status: 'completed' },
  });
  for (const emp of employees.slice(0, 6)) {
    await prisma.enrollment.create({ data: { sessionId: session1.id, employeeId: emp.id } });
  }
  await prisma.enrollment.create({
    data: { sessionId: session2.id, employeeId: employees[0].id, status: 'completed', attendedHrs: 6, testScore: 92, evalJson: { reaction: 5, learning: 4 } },
  });
  await prisma.certificate.create({
    data: { employeeId: employees[0].id, title: 'شهادة أساسيات PDPL', issuer: 'أكاديمية الامتثال', issuedAt: daysAgo(14) },
  });
  await prisma.idp.create({
    data: {
      employeeId: employees[0].id, managerId: employees[5].id,
      goalsJson: { goals: ['إتقان التحليل المالي', 'قيادة فريق صغير'], actions: ['دورة مالية', 'مشروع قيادي'], timelineMonths: 6 },
      progress: 35, reviewDate: daysAhead(60),
    },
  });
  await prisma.mentoringPair.create({
    data: { mentorId: employees[5].id, menteeId: employees[0].id, startDate: daysAgo(30), focusArea: 'تطوير مهارات التحليل', sessionsLog: [{ at: daysAgo(20), note: 'جلسة تعارف وتحديد أهداف' }] },
  });

  // ============ المواهب ============
  console.log('[seed] talent…');
  const plan = await prisma.successionPlan.create({ data: { positionId: positions['CHRO'].id, approvedById: users['hrdir'].id } });
  await prisma.successionCandidate.create({ data: { planId: plan.id, employeeId: employees[1].id, readiness: 'ready_1y', developmentNote: 'إكمال برنامج القيادة التنفيذية' } });
  await prisma.successionCandidate.create({ data: { planId: plan.id, employeeId: employees[10].id, readiness: 'ready_2_3y' } });
  await prisma.hipoMember.create({
    data: { employeeId: employees[1].id, nominatedById: users['hrdir'].id, programJson: { track: 'قيادي', projects: ['تحول رقمي'], mentor: 'CHRO' } },
  });

  // ============ الاحتفاظ ============
  console.log('[seed] retention…');
  const survey = await prisma.survey.create({
    data: {
      code: 'ENPS-Q3', titleAr: 'استطلاع ولاء الموظفين eNPS - الربع الثالث', type: 'enps', status: 'closed',
      opensAt: daysAgo(30), closesAt: daysAgo(20),
      questions: {
        create: [
          { text: 'ما مدى احتمالية أن توصي بالعمل في هذه المنشأة لصديق؟', scale: '0_10', orderIndex: 1 },
          { text: 'ما أهم سبب لدرجتك؟', scale: 'text', orderIndex: 2 },
        ],
      },
    },
    include: { questions: true },
  });
  const scores = [9, 10, 7, 8, 9, 6, 10, 8, 5, 9, 7, 10, 8, 9, 6, 8, 9, 10, 7, 4];
  for (let i = 0; i < scores.length; i++) {
    await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        answersJson: { [survey.questions[0].id]: scores[i], [survey.questions[1].id]: 'بيئة عمل جيدة' },
        deptId: employees[i % employees.length].deptId,
      },
    });
  }
  await prisma.stayInterview.create({
    data: {
      employeeId: employees[1].id, conductedById: users['manager'].id, conductedAt: daysAgo(12),
      satisfaction: 8, issuesJson: { concerns: ['فرص النمو'] }, actionsJson: { actions: ['مسار قيادي واضح'] },
      followUpAt: daysAhead(45), status: 'follow_up',
    },
  });

  // ============ العلاقات العمالية ============
  console.log('[seed] relations…');
  await prisma.disciplinaryCase.create({
    data: {
      employeeId: employees[9].id, violation: 'غياب متكرر بدون عذر (3 مرات خلال شهر)',
      severity: 'medium', investigationNote: 'تمت مراجعة سجلات الحضور وسماع أقوال الموظف.',
      employeeDefense: 'ظروف صحية طارئة لم أوثقها في حينها.',
      action: 'warning_written', status: 'decided', decidedById: users['hrdir'].id, decidedAt: daysAgo(6),
    },
  });
  await prisma.grievance.create({
    data: {
      employeeId: employees[4].id, subject: 'تأخر صرف بدل العمل الإضافي',
      details: 'تم اعتماد ساعاتي الإضافية منذ شهرين ولم تصرف مع الراتب.',
      status: 'resolved', resolution: 'تمت إضافة المستحق للمسير القادم والاعتذار للموظف.',
      resolvedById: users['hrdir'].id, satisfied: true,
    },
  });

  // ============ شؤون المقيمين ============
  console.log('[seed] expat services…');
  for (const emp of expats.slice(0, 6)) {
    await prisma.iqamaRecord.create({
      data: {
        employeeId: emp.id, iqamaNumber: `2${String(400000000 + employees.indexOf(emp)).padStart(9, '0')}`,
        profession: 'أخصائي', issuedAt: daysAgo(300), expiresAt: daysAhead(60 + employees.indexOf(emp) * 10),
      },
    });
    const shares = saudi.gosiShares(Number(emp.salary));
    await prisma.gosiRecord.create({
      data: {
        employeeId: emp.id, gosiNumber: `5${String(10000000 + employees.indexOf(emp)).padStart(8, '0')}`,
        registeredAt: emp.hireDate, salaryBase: Number(emp.salary),
        employeeShare: shares.employee, employerShare: shares.employer,
      },
    });
  }
  for (const emp of saudis.slice(0, 6)) {
    const shares = saudi.gosiShares(Number(emp.salary));
    await prisma.gosiRecord.create({
      data: {
        employeeId: emp.id, gosiNumber: `1${String(20000000 + employees.indexOf(emp)).padStart(8, '0')}`,
        registeredAt: emp.hireDate, salaryBase: Number(emp.salary),
        employeeShare: shares.employee, employerShare: shares.employer,
      },
    });
  }
  if (expats[0]) {
    await prisma.visa.create({
      data: { employeeId: expats[0].id, type: 'exit_reentry_single', status: 'issued', issuedAt: daysAgo(10), expiresAt: daysAhead(80), feesPaid: 200, refNumber: 'ER-778899' },
    });
    await prisma.visa.create({
      data: { employeeId: expats[1].id, type: 'family_visit', status: 'requested', feesPaid: 300 },
    });
  }
  await prisma.gamcaRecord.create({
    data: { candidateName: 'راجيش كومار', passportNo: 'P1234567', examDate: daysAgo(20), result: 'fit', validUntil: daysAhead(70) },
  });
  await prisma.attestation.create({
    data: { candidateName: 'راجيش كومار', documentType: 'degree', stage: 'saudi_embassy' },
  });
  if (expats[2]) {
    await prisma.kafalaTransfer.create({
      data: { employeeId: expats[2].id, fromEmployer: 'شركة المقاولات المتحدة', toEmployer: 'منشأتنا', reason: 'normal', status: 'sponsor_ok', currentSponsorOk: true, feesPaid: 4000 },
    });
  }

  // ============ التأمين الصحي ============
  console.log('[seed] insurance…');
  const policy = await prisma.insurancePolicy.create({
    data: {
      provider: 'شركة التعاونية للتأمين', policyNumber: 'COOP-2026-001', planName: 'الفئة الذهبية',
      startDate: new Date(year, 0, 1), endDate: new Date(year, 11, 31), premium: 480000,
    },
  });
  for (const emp of employees.slice(0, 10)) {
    await prisma.insuranceMember.create({
      data: { policyId: policy.id, employeeId: emp.id, relation: 'self', cardNumber: `CARD-${1000 + employees.indexOf(emp)}` },
    });
  }

  // ============ نطاقات + تقارير تنظيمية ============
  console.log('[seed] saudi compliance…');
  const totalActive = employees.filter((e) => e.employmentStatus === 'active').length;
  const saudiActive = saudis.filter((e) => e.employmentStatus === 'active').length;
  const pct = Math.round((saudiActive / totalActive) * 1000) / 10;
  await prisma.nitaqatSnapshot.create({
    data: {
      snapshotDate: new Date(), totalEmployees: totalActive, saudiCount: saudiActive,
      expatCount: totalActive - saudiActive, saudizationPct: pct, band: saudi.nitaqatBand(pct),
      notes: 'لقطة أولية آلية من بيانات الموظفين',
    },
  });
  await prisma.regulatoryReport.create({
    data: { type: 'gosi', period: `${year}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`, payloadJson: { employees: totalActive, note: 'تقرير اشتراكات ربعي' }, status: 'submitted', submittedAt: daysAgo(10), createdById: users['compliance'].id },
  });

  // ============ مستندات الموظفين + فترة التجربة ============
  console.log('[seed] employee documents + probation…');
  for (const emp of employees.slice(0, 8)) {
    await prisma.employeeDocument.create({
      data: {
        employeeId: emp.id, docType: emp.residentType === 'expat' ? 'iqama' : 'national_id',
        docNumber: emp.nationalId, expiresAt: daysAhead(200 + employees.indexOf(emp) * 20), verified: true,
      },
    });
  }
  // موظف جديد (أقل من 90 يوم) → تقييم تجربة 45
  const newHire = employees.find((e) => (Date.now() - new Date(e.hireDate).getTime()) / 86400000 < 90);
  if (newHire) {
    await prisma.probationReview.create({
      data: { employeeId: newHire.id, milestone: 45, reviewDate: daysAgo(3), performance: 'good', notes: 'اندماج جيد مع الفريق', decision: 'continue', reviewerId: users['manager'].id },
    });
  }

  // ============ مركز الطلبات الموحد ============
  console.log('[seed] request types + requests…');
  const REQ_TYPES = [
    { code: 'certificate', nameAr: 'شهادة/إفادة', nameEn: 'HR Certificate', workflowDefCode: 'WF-REQ-CERT' },
    { code: 'training', nameAr: 'دورة تدريبية', nameEn: 'Training Request', workflowDefCode: 'WF-REQ-TRAIN' },
    { code: 'data_update', nameAr: 'تحديث بيانات', nameEn: 'Data Update', workflowDefCode: 'WF-REQ-DATA' },
    { code: 'equipment', nameAr: 'تجهيزات وأدوات', nameEn: 'Equipment Request', workflowDefCode: 'WF-REQ-EQUIP' },
    { code: 'travel', nameAr: 'مهمة سفر', nameEn: 'Business Travel', workflowDefCode: 'WF-REQ-TRAVEL' },
    { code: 'other', nameAr: 'طلب آخر', nameEn: 'Other Request', workflowDefCode: 'WF-REQ-GENERIC' },
  ];
  const reqTypes = {};
  for (const t of REQ_TYPES) {
    reqTypes[t.code] = await prisma.requestType.create({
      data: { ...t, formSchema: { fields: [{ name: 'details', labelAr: 'التفاصيل', type: 'text', required: true }] } },
    });
    // تعريف سير عمل لكل نوع: مدير → HR
    await prisma.workflowDefinition.create({
      data: {
        code: t.workflowDefCode, nameAr: `سير عمل: ${t.nameAr}`, nameEn: `${t.nameEn} Workflow`,
        description: `اعتماد ${t.nameAr}: مدير مباشر ثم HR`,
        definitionJson: { steps: [{ code: 'manager', nameAr: 'موافقة المدير المباشر', slaMins: 480 }, { code: 'hr', nameAr: 'معالجة HR', slaMins: 480 }] },
      },
    });
  }
  await prisma.employeeRequest.create({
    data: {
      typeId: reqTypes.certificate.id, employeeId: employees[0].id,
      payloadJson: { kind: 'salary_certificate', purpose: 'طلب قرض بنكي' }, status: 'in_approval',
    },
  });
  await prisma.employeeRequest.create({
    data: {
      typeId: reqTypes.training.id, employeeId: employees[2].id,
      payloadJson: { course: 'إكسل المتقدم للمحللين', reason: 'متطلبات العمل الحالية' }, status: 'submitted',
    },
  });
  await prisma.employeeRequest.create({
    data: {
      typeId: reqTypes.data_update.id, employeeId: employees[3].id,
      payloadJson: { field: 'phone', newValue: '0551234567' }, status: 'done', decidedById: users['hrmgr'].id, decidedAt: daysAgo(2),
    },
  });

  // ============ أحداث أمنية تجريبية ============
  await prisma.securityEvent.create({
    data: { type: 'login_failed', severity: 'warning', details: { username: 'admin', attempts: 3 }, ipAddress: '127.0.0.1' },
  });
  await prisma.securityEvent.create({
    data: { userId: users['admin'].id, type: 'password_reset', severity: 'info', details: { by: 'self' }, ipAddress: '127.0.0.1' },
  });

  // ============ مرجع المعاملات: 69 مخطط Mermaid ============
  console.log('[seed] 69 flowcharts…');
  for (const fc of FLOWCHARTS) {
    await prisma.knowledgeDocument.create({
      data: {
        code: `FC-${String(fc.n).padStart(2, '0')}`,
        titleAr: `معاملة ${fc.n}: ${fc.titleAr}`,
        titleEn: fc.code,
        contentMarkdown: `# ${fc.titleAr}\n\n**الوحدة:** ${fc.module}\n\n\`\`\`mermaid\n${fc.mermaid}\n\`\`\`\n`,
        category: 'flowchart',
        tags: ['flowchart', fc.module, fc.code],
        authorId: users['admin'].id,
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }
}

module.exports = { seedNewEngines, FLOWCHARTS };
