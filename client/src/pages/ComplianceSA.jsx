import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const BAND_AR = { platinum: 'بلاتيني', green_high: 'أخضر مرتفع', green_mid: 'أخضر متوسط', green_low: 'أخضر منخفض', yellow: 'أصفر', red: 'أحمر' };
const BAND_CLASS = { platinum: 'badge-success', green_high: 'badge-success', green_mid: 'badge-primary', green_low: 'badge-primary', yellow: 'badge-warn', red: 'badge-danger' };

export default function ComplianceSA() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [dash, setDash] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [rules, setRules] = useState(null);
  const [pdpl, setPdpl] = useState(null);
  const [reports, setReports] = useState([]);
  const [tab, setTab] = useState('nitaqat');

  function load() {
    client.get('/compliance-sa/dashboard').then(({ data }) => setDash(data)).catch(() => {});
    client.get('/compliance-sa/nitaqat').then(({ data }) => setSnapshots(data.snapshots)).catch(() => {});
    client.get('/compliance-sa/rules').then(({ data }) => setRules(data.rules)).catch(() => {});
    if (hasAny('pdpl.read')) client.get('/compliance-sa/pdpl').then(({ data }) => setPdpl(data.status)).catch(() => {});
    if (hasAny('regulatory.read')) client.get('/compliance-sa/regulatory').then(({ data }) => setReports(data.reports)).catch(() => {});
  }
  useEffect(load, []);

  function snapshot() {
    client.post('/compliance-sa/nitaqat/snapshot', {})
      .then(({ data }) => { toast.success(`تم — النطاق: ${BAND_AR[data.snapshot.band]}`); load(); })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'nitaqat', label: 'نطاقات' },
    { id: 'rules', label: 'قواعد نظام العمل' },
    ...(hasAny('pdpl.read') ? [{ id: 'pdpl', label: 'حماية البيانات PDPL' }] : []),
    ...(hasAny('regulatory.read') ? [{ id: 'regulatory', label: `التقارير التنظيمية (${reports.length})` }] : []),
  ];

  return (
    <div className="page space-y-4">
      <h1 className="h1">الامتثال السعودي</h1>

      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card-padded">
            <div className="muted">نسبة التوطين الحالية</div>
            <div className="text-3xl font-bold mt-1">{dash.current.pct}%</div>
            <span className={BAND_CLASS[dash.current.band]}>{BAND_AR[dash.current.band]}</span>
          </div>
          <div className="card-padded"><div className="muted">سعوديون / مقيمون</div><div className="text-3xl font-bold mt-1">{dash.current.saudiCount} / {dash.current.expatCount}</div></div>
          <div className="card-padded"><div className="muted">تقارير معلقة</div><div className="text-3xl font-bold text-warn-600 mt-1">{dash.pendingReports}</div></div>
          <div className="card-padded"><div className="muted">ملفات WPS بانتظار الرفع</div><div className="text-3xl font-bold mt-1">{dash.wpsPending}</div></div>
        </div>
      )}

      <div className="flex gap-2 border-b border-ink-100 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nitaqat' && (
        <div className="card-padded space-y-3">
          {hasAny('nitaqat.write') && <button onClick={snapshot} className="btn-primary">أخذ لقطة نطاقات الآن</button>}
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>الإجمالي</th><th>سعوديون</th><th>مقيمون</th><th>النسبة</th><th>النطاق</th></tr></thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.id}>
                    <td>{new Date(s.snapshotDate).toLocaleDateString('ar-SA')}</td>
                    <td>{s.totalEmployees}</td>
                    <td>{s.saudiCount}</td>
                    <td>{s.expatCount}</td>
                    <td>{s.saudizationPct}%</td>
                    <td><span className={BAND_CLASS[s.band]}>{BAND_AR[s.band]}</span></td>
                  </tr>
                ))}
                {!snapshots.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد لقطات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'rules' && rules && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card-padded">
            <h3 className="h3 mb-2">الإجازات</h3>
            <ul className="text-sm space-y-1 text-ink-600">
              <li>سنوية: {rules.annualLeave.belowFiveYears} يوم (أقل من 5 سنوات) / {rules.annualLeave.fiveYearsAndAbove} يوم (5+)</li>
              <li>مرضية: {rules.sickLeave.tiers.map((t) => `${t.uptoDays} يوم بأجر ${t.payPct}%`).join(' ← ')}</li>
              <li>أمومة: {rules.maternity.weeksTotal} أسابيع — أبوة: {rules.paternity.days} أيام</li>
              <li>حج: {rules.hajj.daysMin}-{rules.hajj.daysMax} يوم مرة واحدة بعد {rules.hajj.minServiceYears} سنتين</li>
              <li>زواج: {rules.marriage.days} أيام — حداد: {rules.bereavement.days} أيام</li>
            </ul>
          </div>
          <div className="card-padded">
            <h3 className="h3 mb-2">التأمينات والرسوم</h3>
            <ul className="text-sm space-y-1 text-ink-600">
              <li>GOSI موظف: {rules.gosi.employeePct}% — منشأة: {rules.gosi.employerPct}%</li>
              <li>رخصة عمل: {rules.workPermitFee.above50Employees} ر.س (أكثر من 50 موظف) / {rules.workPermitFee.upTo50Employees} ر.س</li>
              <li>عمل إضافي: سقف {rules.overtime.yearCapHours} ساعة/سنة × {rules.overtime.multiplier}</li>
              <li>فترة التجربة: {rules.probation.days} يوم (تقييمات 45/60/90)</li>
            </ul>
          </div>
          <div className="card-padded">
            <h3 className="h3 mb-2">شؤون المقيمين</h3>
            <ul className="text-sm space-y-1 text-ink-600">
              <li>إصدار الإقامة: خلال {rules.iqama.issueWithinDays} يوم من الدخول</li>
              <li>تنبيه التجديد: قبل {rules.iqama.renewalNoticeMonths} أشهر</li>
              <li>تأشيرة عائلية: راتب &gt; {rules.familyVisa.minSalary} + خدمة {rules.familyVisa.minServiceMonths} أشهر</li>
              <li>خروج نهائي: صلاحية {rules.finalExit.validityDays} يوم</li>
              <li>نقل كفالة: {rules.kafala.minServiceMonths} شهر خدمة أو إعفاء</li>
            </ul>
          </div>
          <div className="card-padded">
            <h3 className="h3 mb-2">نهاية الخدمة (استقالة)</h3>
            <ul className="text-sm space-y-1 text-ink-600">
              <li>أقل من سنتين: لا استحقاق</li>
              <li>2-5 سنوات: نصف شهر × السنوات</li>
              <li>5-10 سنوات: نصف × 5 + شهر × الباقي</li>
              <li>أكثر من 10: نصف × 5 + شهر × 5 + 1.5 × الباقي</li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'pdpl' && pdpl && (
        <div className="card-padded space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div><div className="muted">أصحاب البيانات</div><div className="text-2xl font-bold">{pdpl.dataSubjects}</div></div>
            <div><div className="muted">مستخدمو النظام</div><div className="text-2xl font-bold">{pdpl.systemUsers}</div></div>
            <div><div className="muted">سجلات التدقيق</div><div className="text-2xl font-bold">{pdpl.auditTrailEntries}</div></div>
            <div><div className="muted">مستندات متتبعة</div><div className="text-2xl font-bold">{pdpl.documentsTracked}</div></div>
          </div>
          <h3 className="h3">مبادئ PDPL المطبقة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {pdpl.principles.map((p) => (
              <div key={p.code} className="flex items-center gap-2 p-2 rounded border border-ink-100">
                <span className="badge-success text-xs">موافق</span>
                <span className="text-sm">{p.nameAr}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'regulatory' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>النوع</th><th>الفترة</th><th>الحالة</th><th>التقديم</th></tr></thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td>{{ gosi: 'التأمينات', zatca: 'الزكاة والضريبة', labor_office: 'مكتب العمل', stats: 'الإحصاء' }[r.type]}</td>
                  <td>{r.period}</td>
                  <td><span className={r.status === 'submitted' ? 'badge-success' : 'badge-warn'}>{{ draft: 'مسودة', submitted: 'مقدم', accepted: 'مقبول' }[r.status]}</span></td>
                  <td className="text-xs text-ink-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('ar-SA') : '—'}</td>
                </tr>
              ))}
              {!reports.length && <tr><td colSpan={4} className="text-center text-ink-400">لا توجد تقارير</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
