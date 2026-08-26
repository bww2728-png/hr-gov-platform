import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const VISA_AR = { work: 'عمل', exit_reentry_single: 'خروج وعودة مفردة', exit_reentry_multi: 'خروج وعودة متعددة', final_exit: 'خروج نهائي', family_visit: 'زيارة عائلية' };
const V_STATUS = { requested: 'مطلوبة', issued: 'مصدرة', used: 'مستخدمة', expired: 'منتهية', cancelled: 'ملغاة' };
const money = (n) => n != null ? `${Number(n).toLocaleString('ar-SA')} ر.س` : '—';

export default function Expat() {
  const toast = useToast();
  const [dash, setDash] = useState(null);
  const [visas, setVisas] = useState([]);
  const [iqamas, setIqamas] = useState([]);
  const [gosi, setGosi] = useState([]);
  const [gamca, setGamca] = useState([]);
  const [attestations, setAttestations] = useState([]);
  const [kafala, setKafala] = useState([]);
  const [huroob, setHuroob] = useState([]);
  const [tab, setTab] = useState('iqamas');

  function load() {
    client.get('/expat/dashboard').then(({ data }) => setDash(data)).catch(() => {});
    client.get('/expat/visas').then(({ data }) => setVisas(data.visas)).catch(() => {});
    client.get('/expat/iqamas').then(({ data }) => setIqamas(data.iqamas)).catch(() => {});
    client.get('/expat/gosi').then(({ data }) => setGosi(data.records)).catch(() => {});
    client.get('/expat/gamca').then(({ data }) => setGamca(data.records)).catch(() => {});
    client.get('/expat/attestations').then(({ data }) => setAttestations(data.records)).catch(() => {});
    client.get('/expat/kafala').then(({ data }) => setKafala(data.records)).catch(() => {});
    client.get('/expat/huroob').then(({ data }) => setHuroob(data.records)).catch(() => {});
  }
  useEffect(load, []);

  const tabs = [
    { id: 'iqamas', label: `الإقامات (${iqamas.length})` },
    { id: 'visas', label: `التأشيرات (${visas.length})` },
    { id: 'gosi', label: `التأمينات (${gosi.length})` },
    { id: 'gamca', label: `GAMCA (${gamca.length})` },
    { id: 'attestations', label: `التوثيق (${attestations.length})` },
    { id: 'kafala', label: `نقل الكفالة (${kafala.length})` },
    { id: 'huroob', label: `بلاغات الهروب (${huroob.length})` },
  ];

  const expiringSoon = (d) => d && (new Date(d) - Date.now()) / 86400000 < 90;

  return (
    <div className="page space-y-4">
      <h1 className="h1">شؤون المقيمين والخدمات الحكومية</h1>

      {dash && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="card-padded"><div className="muted">مقيمون نشطون</div><div className="text-3xl font-bold mt-1">{dash.expatCount}</div></div>
          <div className="card-padded"><div className="muted">إقامات تنتهي قريباً</div><div className="text-3xl font-bold text-warn-600 mt-1">{dash.expiringIqamas}</div></div>
          <div className="card-padded"><div className="muted">تأشيرات معلقة</div><div className="text-3xl font-bold mt-1">{dash.pendingVisas}</div></div>
          <div className="card-padded"><div className="muted">مسجلون في GOSI</div><div className="text-3xl font-bold text-primary-700 mt-1">{dash.gosiRegistered}</div></div>
          <div className="card-padded"><div className="muted">بلاغات هروب نشطة</div><div className="text-3xl font-bold text-danger-600 mt-1">{dash.activeHuroob}</div></div>
        </div>
      )}

      <div className="flex gap-2 border-b border-ink-100 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'iqamas' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>رقم الإقامة</th><th>المهنة</th><th>الانتهاء</th><th>الحالة</th></tr></thead>
            <tbody>
              {iqamas.map((i) => (
                <tr key={i.id}>
                  <td>{i.employee?.fullNameAr}</td>
                  <td>{i.iqamaNumber || '—'}</td>
                  <td>{i.profession || '—'}</td>
                  <td className={expiringSoon(i.expiresAt) ? 'text-danger-600 font-medium' : ''}>{fmtDate(i.expiresAt)}</td>
                  <td><span className="badge-success">{i.status === 'active' ? 'سارية' : i.status}</span></td>
                </tr>
              ))}
              {!iqamas.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد إقامات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'visas' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>المستفيد</th><th>النوع</th><th>الحالة</th><th>الإصدار</th><th>الانتهاء</th><th>الرسوم</th></tr></thead>
            <tbody>
              {visas.map((v) => (
                <tr key={v.id}>
                  <td>{v.employee?.fullNameAr || v.candidateName || '—'}</td>
                  <td>{VISA_AR[v.type]}</td>
                  <td><span className={v.status === 'issued' ? 'badge-success' : v.status === 'requested' ? 'badge-warn' : 'badge-ink'}>{V_STATUS[v.status]}</span></td>
                  <td>{fmtDate(v.issuedAt)}</td>
                  <td>{fmtDate(v.expiresAt)}</td>
                  <td>{money(v.feesPaid)}</td>
                </tr>
              ))}
              {!visas.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد تأشيرات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'gosi' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>رقم التأمينات</th><th>الأجر الخاضع</th><th>حصة الموظف 9.75%</th><th>حصة المنشأة 11.75%</th><th>الحالة</th></tr></thead>
            <tbody>
              {gosi.map((g) => (
                <tr key={g.id}>
                  <td>{g.employee?.fullNameAr}</td>
                  <td>{g.gosiNumber || '—'}</td>
                  <td>{money(g.salaryBase)}</td>
                  <td>{money(g.employeeShare)}</td>
                  <td>{money(g.employerShare)}</td>
                  <td><span className="badge-success">{g.status === 'active' ? 'نشط' : 'ملغي'}</span></td>
                </tr>
              ))}
              {!gosi.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد سجلات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'gamca' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>المرشح</th><th>الجواز</th><th>الفحص</th><th>النتيجة</th><th>صالح حتى</th></tr></thead>
            <tbody>
              {gamca.map((g) => (
                <tr key={g.id}>
                  <td>{g.candidateName}</td>
                  <td>{g.passportNo || '—'}</td>
                  <td>{fmtDate(g.examDate)}</td>
                  <td><span className={g.result === 'fit' ? 'badge-success' : 'badge-danger'}>{g.result === 'fit' ? 'لائق' : g.result === 'unfit' ? 'غير لائق' : '—'}</span></td>
                  <td>{fmtDate(g.validUntil)}</td>
                </tr>
              ))}
              {!gamca.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد فحوصات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'attestations' && (
        <div className="card-padded space-y-2">
          {attestations.map((a) => {
            const stages = ['university', 'foreign_ministry', 'saudi_embassy', 'mofa_sa', 'moet_equation', 'done'];
            const labels = { university: 'الجامعة', foreign_ministry: 'خارجية البلد', saudi_embassy: 'السفارة السعودية', mofa_sa: 'الخارجية السعودية', moet_equation: 'المعادلة', done: 'مكتمل' };
            const idx = stages.indexOf(a.stage);
            return (
              <div key={a.id} className="p-3 rounded-lg border border-ink-100">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">{a.employeeId ? 'موظف' : a.candidateName} — {a.documentType}</span>
                  <span className={a.status === 'done' ? 'badge-success' : 'badge-primary'}>{labels[a.stage]}</span>
                </div>
                <div className="flex gap-1">
                  {stages.slice(0, -1).map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= idx ? 'bg-primary-500' : 'bg-ink-100'}`} title={labels[s]} />
                  ))}
                </div>
              </div>
            );
          })}
          {!attestations.length && <div className="text-ink-400 text-sm">لا توجد طلبات توثيق</div>}
        </div>
      )}

      {tab === 'kafala' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>من</th><th>إلى</th><th>السبب</th><th>الرسوم</th><th>الحالة</th></tr></thead>
            <tbody>
              {kafala.map((k) => (
                <tr key={k.id}>
                  <td>{k.employee?.fullNameAr}</td>
                  <td>{k.fromEmployer || '—'}</td>
                  <td>{k.toEmployer || '—'}</td>
                  <td>{{ normal: 'عادي', salary_delay_3m: 'تأخر رواتب 3 أشهر', abuse_court: 'حكم قضائي' }[k.reason]}</td>
                  <td>{money(k.feesPaid)}</td>
                  <td><span className="badge-primary">{{ requested: 'مطلوب', sponsor_ok: 'موافقة الكفيل', gov_ok: 'موافقة الجوازات', done: 'مكتمل', rejected: 'مرفوض' }[k.status]}</span></td>
                </tr>
              ))}
              {!kafala.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'huroob' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>الغياب منذ</th><th>تحذيرات</th><th>الحالة</th></tr></thead>
            <tbody>
              {huroob.map((h) => (
                <tr key={h.id}>
                  <td>{h.employee?.fullNameAr}</td>
                  <td>{fmtDate(h.absenceSince)}</td>
                  <td>{h.warningsSent}</td>
                  <td><span className={h.status === 'reported' ? 'badge-danger' : 'badge-warn'}>{{ monitoring: 'مراقبة', reported: 'مبلغ هارب', cancelled: 'ملغي', deported: 'تم الترحيل' }[h.status]}</span></td>
                </tr>
              ))}
              {!huroob.length && <tr><td colSpan={4} className="text-center text-ink-400">لا توجد بلاغات</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
