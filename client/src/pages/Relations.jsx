import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const SEV_AR = { minor: 'بسيطة', medium: 'متوسطة', major: 'كبيرة', severe: 'جسيمة' };
const ACTION_AR = { none: 'بدون إجراء', warning_written: 'إنذار كتابي', fine: 'غرامة', suspension: 'إيقاف', termination: 'فصل' };
const CASE_STATUS = { investigating: 'قيد التحقيق', decided: 'صدر القرار', appealed: 'متظلم منه', closed: 'مغلقة' };
const GR_STATUS = { submitted: 'مقدم', investigating: 'قيد التحقيق', resolved: 'محلول', escalated: 'مصعد', closed: 'مغلق' };

export default function Relations() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [cases, setCases] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [tab, setTab] = useState(hasAny('disciplinary.read') ? 'disciplinary' : 'grievances');
  const [grForm, setGrForm] = useState({ subject: '', details: '' });

  function load() {
    if (hasAny('disciplinary.read')) client.get('/relations/disciplinary').then(({ data }) => setCases(data.cases)).catch(() => {});
    client.get('/relations/grievances').then(({ data }) => setGrievances(data.grievances)).catch(() => {});
  }
  useEffect(load, []);

  function submitGrievance(e) {
    e.preventDefault();
    client.post('/relations/grievances', grForm)
      .then(() => { toast.success('تم تقديم التظلم'); setGrForm({ subject: '', details: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function decide(id, action) {
    client.post(`/relations/disciplinary/${id}/decide`, { action }).then(() => { toast.success('تم'); load(); });
  }
  function resolve(id) {
    const resolution = prompt('نص الحل:');
    if (resolution) client.post(`/relations/grievances/${id}/resolve`, { resolution }).then(() => { toast.success('تم'); load(); });
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">العلاقات العمالية</h1>

      <div className="flex gap-2 border-b border-ink-100">
        {hasAny('disciplinary.read') && (
          <button onClick={() => setTab('disciplinary')} className={`px-4 py-2 text-sm ${tab === 'disciplinary' ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>القضايا التأديبية ({cases.length})</button>
        )}
        <button onClick={() => setTab('grievances')} className={`px-4 py-2 text-sm ${tab === 'grievances' ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>التظلمات ({grievances.length})</button>
      </div>

      {tab === 'disciplinary' && (
        <div className="card-padded space-y-2">
          {cases.map((c) => (
            <div key={c.id} className="p-4 rounded-lg border border-ink-100 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{c.employee?.fullNameAr}</div>
                  <div className="text-sm text-ink-600 mt-1">{c.violation}</div>
                  <div className="flex gap-2 mt-1">
                    <span className="badge-warn">{SEV_AR[c.severity]}</span>
                    <span className="badge-ink">{CASE_STATUS[c.status]}</span>
                    {c.action && <span className="badge-danger">{ACTION_AR[c.action]}</span>}
                  </div>
                </div>
                {c.status === 'investigating' && hasAny('disciplinary.decide') && (
                  <select onChange={(e) => e.target.value && decide(c.id, e.target.value)} className="input w-40 text-xs" defaultValue="">
                    <option value="">اتخاذ قرار…</option>
                    {Object.entries(ACTION_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                )}
              </div>
              {c.employeeDefense && <div className="text-xs bg-ink-50 p-2 rounded">دفاع الموظف: {c.employeeDefense}</div>}
            </div>
          ))}
          {!cases.length && <div className="text-ink-400 text-sm">لا توجد قضايا</div>}
        </div>
      )}

      {tab === 'grievances' && (
        <>
          <form onSubmit={submitGrievance} className="card-padded space-y-2">
            <h2 className="h3">تقديم تظلم</h2>
            <input value={grForm.subject} onChange={(e) => setGrForm({ ...grForm, subject: e.target.value })} required placeholder="الموضوع" className="input w-full" />
            <textarea value={grForm.details} onChange={(e) => setGrForm({ ...grForm, details: e.target.value })} required placeholder="التفاصيل" className="input w-full" rows={3} />
            <button className="btn-primary">تقديم</button>
          </form>
          <div className="card-padded space-y-2">
            {grievances.map((g) => (
              <div key={g.id} className="p-3 rounded-lg border border-ink-100 flex justify-between items-start">
                <div>
                  <div className="font-medium">{g.subject}</div>
                  <div className="text-xs text-ink-500 mt-1">{fmtDate(g.createdAt)} {g.employee && `— ${g.employee.fullNameAr}`}</div>
                  {g.resolution && <div className="text-xs bg-primary-50 p-2 rounded mt-1">الحل: {g.resolution}</div>}
                </div>
                <div className="flex gap-2 items-center">
                  <span className={g.status === 'resolved' || g.status === 'closed' ? 'badge-success' : g.status === 'escalated' ? 'badge-danger' : 'badge-warn'}>{GR_STATUS[g.status]}</span>
                  {!['resolved', 'closed'].includes(g.status) && hasAny('grievances.resolve') && (
                    <button onClick={() => resolve(g.id)} className="btn-primary text-xs">حل</button>
                  )}
                </div>
              </div>
            ))}
            {!grievances.length && <div className="text-ink-400 text-sm">لا توجد تظلمات</div>}
          </div>
        </>
      )}
    </div>
  );
}
