import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const SEV_CLASS = { info: 'badge-primary', warning: 'badge-warn', critical: 'badge-danger' };

export default function Security() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [deleted, setDeleted] = useState({ employees: [], users: [] });
  const [tab, setTab] = useState('events');
  const [simCode, setSimCode] = useState('WF-REQ-CERT');
  const [simResult, setSimResult] = useState(null);

  function load() {
    client.get('/admin/security-events').then(({ data }) => setEvents(data.events)).catch(() => {});
    client.get('/admin/sessions').then(({ data }) => setSessions(data.sessions)).catch(() => {});
    if (hasAny('admin.softdelete.restore')) client.get('/admin/deleted').then((r) => setDeleted(r.data)).catch(() => {});
  }
  useEffect(load, []);

  function revoke(id) {
    client.post(`/admin/sessions/${id}/revoke`).then(() => { toast.success('تم إنهاء الجلسة'); load(); });
  }
  function restore(entity, id) {
    client.post('/admin/restore', { entity, id }).then(() => { toast.success('تمت الاستعادة'); load(); });
  }
  function simulate() {
    client.post('/admin/workflow/simulate', { definitionCode: simCode, payload: { test: true } })
      .then(({ data }) => setSimResult(data))
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'events', label: `الأحداث الأمنية (${events.length})` },
    { id: 'sessions', label: `الجلسات النشطة (${sessions.length})` },
    ...(hasAny('admin.softdelete.restore') ? [{ id: 'restore', label: 'استعادة المحذوف' }] : []),
    ...(hasAny('admin.workflow.simulate') ? [{ id: 'simulate', label: 'محاكاة سير العمل' }] : []),
  ];

  return (
    <div className="page space-y-4">
      <h1 className="h1">الأمن وإدارة النظام</h1>

      <div className="flex gap-2 border-b border-ink-100 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>الوقت</th><th>النوع</th><th>الخطورة</th><th>التفاصيل</th><th>IP</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="text-xs">{new Date(e.createdAt).toLocaleString('ar-SA')}</td>
                  <td>{e.type}</td>
                  <td><span className={SEV_CLASS[e.severity] || 'badge-ink'}>{e.severity}</span></td>
                  <td className="text-xs max-w-xs truncate">{JSON.stringify(e.details)}</td>
                  <td className="text-xs">{e.ipAddress || '—'}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد أحداث</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="card-padded table-wrap">
          <table>
            <thead><tr><th>المستخدم</th><th>IP</th><th>الجهاز</th><th>البداية</th><th>الانتهاء</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.user?.fullNameAr} <span className="text-xs text-ink-400">({s.user?.username})</span></td>
                  <td className="text-xs">{s.ipAddress || '—'}</td>
                  <td className="text-xs max-w-xs truncate">{s.userAgent || '—'}</td>
                  <td className="text-xs">{fmtDate(s.createdAt)}</td>
                  <td className="text-xs">{fmtDate(s.expiresAt)}</td>
                  <td><button onClick={() => revoke(s.id)} className="btn-secondary text-xs">إنهاء</button></td>
                </tr>
              ))}
              {!sessions.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد جلسات</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'restore' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card-padded">
            <h3 className="h3 mb-2">موظفون محذوفون ({deleted.employees?.length || 0})</h3>
            <div className="space-y-2">
              {(deleted.employees || []).map((e) => (
                <div key={e.id} className="flex justify-between items-center p-2 rounded border border-ink-100">
                  <span className="text-sm">{e.fullNameAr} <span className="text-xs text-ink-400">{e.employeeNumber}</span></span>
                  <button onClick={() => restore('employee', e.id)} className="btn-primary text-xs">استعادة</button>
                </div>
              ))}
              {!deleted.employees?.length && <div className="text-ink-400 text-sm">لا يوجد</div>}
            </div>
          </div>
          <div className="card-padded">
            <h3 className="h3 mb-2">مستخدمون محذوفون ({deleted.users?.length || 0})</h3>
            <div className="space-y-2">
              {(deleted.users || []).map((u) => (
                <div key={u.id} className="flex justify-between items-center p-2 rounded border border-ink-100">
                  <span className="text-sm">{u.fullNameAr} <span className="text-xs text-ink-400">({u.username})</span></span>
                  <button onClick={() => restore('user', u.id)} className="btn-primary text-xs">استعادة</button>
                </div>
              ))}
              {!deleted.users?.length && <div className="text-ink-400 text-sm">لا يوجد</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'simulate' && (
        <div className="card-padded space-y-3">
          <div className="flex gap-2 items-end">
            <div><label className="muted block mb-1">رمز تعريف سير العمل</label>
              <input value={simCode} onChange={(e) => setSimCode(e.target.value)} className="input w-56" /></div>
            <button onClick={simulate} className="btn-primary">محاكاة</button>
          </div>
          {simResult && (
            <div className="space-y-2">
              <div className="text-sm">التعريف: <b>{simResult.definition.nameAr}</b> ({simResult.stepsCount} خطوات)</div>
              {simResult.trace.map((t) => (
                <div key={t.order} className="flex items-center gap-3 p-2 rounded border border-ink-100">
                  <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">{t.order}</span>
                  <div>
                    <div className="text-sm font-medium">{t.step}</div>
                    <div className="text-xs text-ink-500">الدور: {t.approverRole} — SLA: {t.slaMins ? `${t.slaMins} دقيقة` : '—'}</div>
                  </div>
                  <span className="badge-success ms-auto">اعتماد (محاكاة)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
