import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const CAT_AR = { technical: 'تقنية', soft_skills: 'مهارات شخصية', compliance: 'امتثال', leadership: 'قيادة' };

export default function Learning() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [mentoring, setMentoring] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [tab, setTab] = useState('catalog');

  function load() {
    client.get('/lnd/courses').then(({ data }) => setCourses(data.courses));
    client.get('/lnd/sessions').then(({ data }) => setSessions(data.sessions));
    client.get('/lnd/enrollments/me').then(({ data }) => setMyEnrollments(data.enrollments)).catch(() => {});
    client.get('/lnd/certificates').then(({ data }) => setCertificates(data.certificates)).catch(() => {});
    if (hasAny('lnd.mentoring.read')) client.get('/lnd/mentoring').then(({ data }) => setMentoring(data.pairs)).catch(() => {});
  }
  useEffect(load, []);

  function enroll(sessionId) {
    client.post(`/lnd/sessions/${sessionId}/enroll`)
      .then(() => { toast.success('تم التسجيل'); load(); })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'catalog', label: `الكتالوج (${courses.length})` },
    { id: 'sessions', label: `الجلسات (${sessions.length})` },
    { id: 'mine', label: `تسجيلاتي (${myEnrollments.length})` },
    { id: 'certs', label: `الشهادات (${certificates.length})` },
    ...(hasAny('lnd.mentoring.read') ? [{ id: 'mentoring', label: `الإرشاد (${mentoring.length})` }] : []),
  ];

  return (
    <div className="page space-y-4">
      <h1 className="h1">التعلم والتطوير</h1>

      <div className="flex gap-2 border-b border-ink-100 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map((c) => (
            <div key={c.id} className="card-padded space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-medium">{c.titleAr}</span>
                <span className="badge-primary">{CAT_AR[c.category]}</span>
              </div>
              <div className="text-sm text-ink-500">{c.titleEn} — {c.durationHrs} ساعة</div>
              <div className="text-xs text-ink-400">{c.provider === 'internal' ? 'داخلي' : 'خارجي'} — {c._count?.sessions || 0} جلسة</div>
            </div>
          ))}
          {!courses.length && <div className="text-ink-400">لا توجد دورات</div>}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>الدورة</th><th>التاريخ</th><th>المدرب</th><th>المكان</th><th>المقاعد</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.course?.titleAr}</td>
                    <td>{fmtDate(s.startDate)}</td>
                    <td>{s.trainerName || '—'}</td>
                    <td>{s.location === 'online' ? 'عن بعد' : 'حضوري'}</td>
                    <td>{s._count?.enrollments || 0}/{s.capacity}</td>
                    <td><span className={s.status === 'completed' ? 'badge-success' : 'badge-primary'}>{{ scheduled: 'مجدولة', running: 'جارية', completed: 'مكتملة', cancelled: 'ملغاة' }[s.status]}</span></td>
                    <td>{s.status === 'scheduled' && <button onClick={() => enroll(s.id)} className="btn-primary text-xs">سجّلني</button>}</td>
                  </tr>
                ))}
                {!sessions.length && <tr><td colSpan={7} className="text-center text-ink-400">لا توجد جلسات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mine' && (
        <div className="card-padded space-y-2">
          {myEnrollments.map((en) => (
            <div key={en.id} className="flex justify-between items-center p-3 rounded-lg border border-ink-100">
              <div>
                <div className="font-medium">{en.session?.course?.titleAr}</div>
                <div className="text-xs text-ink-500">{fmtDate(en.session?.startDate)} {en.testScore != null && `— درجة الاختبار: ${en.testScore}`}</div>
              </div>
              <span className={en.status === 'completed' ? 'badge-success' : 'badge-primary'}>{{ enrolled: 'مسجل', attended: 'حضر', completed: 'مكتمل', no_show: 'لم يحضر', cancelled: 'ملغي' }[en.status]}</span>
            </div>
          ))}
          {!myEnrollments.length && <div className="text-ink-400 text-sm">لا توجد تسجيلات</div>}
        </div>
      )}

      {tab === 'certs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {certificates.map((c) => (
            <div key={c.id} className="card-padded">
              <div className="font-medium">{c.title}</div>
              <div className="text-sm text-ink-500 mt-1">{c.issuer || '—'}</div>
              <div className="text-xs text-ink-400 mt-1">{c.issuedAt ? fmtDate(c.issuedAt) : ''}</div>
            </div>
          ))}
          {!certificates.length && <div className="text-ink-400">لا توجد شهادات</div>}
        </div>
      )}

      {tab === 'mentoring' && (
        <div className="card-padded space-y-2">
          {mentoring.map((p) => (
            <div key={p.id} className="p-3 rounded-lg border border-ink-100 flex justify-between items-center">
              <div>
                <span className="font-medium">{p.mentor?.fullNameAr}</span>
                <span className="text-ink-400 mx-2">يرشد</span>
                <span className="font-medium">{p.mentee?.fullNameAr}</span>
                <div className="text-xs text-ink-500 mt-1">{p.focusArea || ''} — منذ {fmtDate(p.startDate)}</div>
              </div>
              <span className={p.status === 'active' ? 'badge-success' : 'badge-ink'}>{p.status === 'active' ? 'نشط' : 'مكتمل'}</span>
            </div>
          ))}
          {!mentoring.length && <div className="text-ink-400 text-sm">لا توجد أزواج إرشاد</div>}
        </div>
      )}
    </div>
  );
}
