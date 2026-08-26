import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDateTime, relativeDays } from '../utils/datetime';

export default function Workflows() {
  const toast = useToast();
  const [defs, setDefs] = useState([]);
  const [instances, setInstances] = useState([]);
  const [tab, setTab] = useState('instances');

  function load() {
    client.get('/workflows/definitions').then(({ data }) => setDefs(data.definitions));
    client.get('/workflows/instances').then(({ data }) => setInstances(data.instances));
  }
  useEffect(load, []);

  function decide(id, decision) {
    client.post(`/workflows/instances/${id}/decide`, { decision, comments: 'موافقة من الواجهة' })
      .then(() => { toast.success('تم اتخاذ القرار'); load(); })
      .catch((e) => toast.error(e.response?.data?.error));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">سير العمل</h1>
      <div className="flex gap-2">
        <button onClick={() => setTab('instances')} className={`btn ${tab === 'instances' ? 'btn-primary' : 'btn-secondary'}`}>الطلبات الجارية ({instances.filter(i => i.status === 'running').length})</button>
        <button onClick={() => setTab('defs')} className={`btn ${tab === 'defs' ? 'btn-primary' : 'btn-secondary'}`}>التعريفات ({defs.length})</button>
      </div>

      {tab === 'instances' && (
        <div className="space-y-2">
          {instances.length === 0 && <div className="card-padded text-center text-ink-500">لا توجد طلبات</div>}
          {instances.map((i) => (
            <div key={i.id} className="card-padded">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="flex gap-2 items-center flex-wrap">
                    <span className="badge-ink">{i.definition?.nameAr}</span>
                    <span className={
                      i.status === 'running' ? 'badge-primary' :
                      i.status === 'approved' ? 'badge-success' :
                      i.status === 'rejected' ? 'badge-danger' : 'badge-ink'
                    }>{i.status}</span>
                  </div>
                  <p className="text-sm mt-1">الكيان: {i.entityType}#{i.entityId}</p>
                  <p className="text-xs text-ink-500">بدأ: {fmtDateTime(i.startedAt)}</p>
                </div>
                {i.status === 'running' && (
                  <div className="flex gap-2">
                    <button onClick={() => decide(i.id, 'approved')} className="btn-primary">موافقة</button>
                    <button onClick={() => decide(i.id, 'rejected')} className="btn-danger">رفض</button>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                {i.steps?.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center ${s.decidedAt ? 'bg-success-500 text-white' : 'bg-ink-300'}`}>{idx + 1}</span>
                    <span className="flex-1">{s.stepNameAr}</span>
                    {s.decidedAt && <span className="badge-success">{s.decision}</span>}
                    {!s.decidedAt && <span className="text-ink-500">SLA: {relativeDays(s.slaDeadline)}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'defs' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>الكود</th><th>الاسم</th><th>الوصف</th><th>الحالة</th></tr></thead>
            <tbody>
              {defs.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.code}</td>
                  <td className="font-medium">{d.nameAr}</td>
                  <td className="text-sm">{d.description}</td>
                  <td><span className={d.isActive ? 'badge-success' : 'badge-ink'}>{d.isActive ? 'مفعّل' : 'متوقف'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}