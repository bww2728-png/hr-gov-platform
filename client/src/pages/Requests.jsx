import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const STATUS_AR = { submitted: 'مقدم', in_approval: 'قيد الاعتماد', approved: 'معتمد', rejected: 'مرفوض', done: 'منفذ', cancelled: 'ملغي' };

export default function Requests() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ typeId: '', details: '' });
  const [filter, setFilter] = useState('');

  const canManager = hasAny('requests.approve');
  const canProcess = hasAny('requests.process');

  function load() {
    client.get('/requests/types').then(({ data }) => setTypes(data.types));
    client.get('/requests', { params: filter ? { status: filter } : {} }).then(({ data }) => setRequests(data.requests));
  }
  useEffect(load, [filter]);

  function submit(e) {
    e.preventDefault();
    client.post('/requests', { typeId: Number(form.typeId), payload: { details: form.details } })
      .then(() => { toast.success('تم تقديم الطلب'); setForm({ typeId: '', details: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function decide(id, stage, decision) {
    client.post(`/requests/${id}/${stage}-decision`, { decision })
      .then(() => { toast.success('تم'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">مركز الطلبات الموحد</h1>

      <form onSubmit={submit} className="card-padded space-y-2">
        <h2 className="h3">طلب جديد</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })} required className="input">
            <option value="">نوع الطلب…</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
          </select>
          <input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required placeholder="تفاصيل الطلب" className="input" />
        </div>
        <button className="btn-primary">تقديم</button>
      </form>

      <div className="card-padded">
        <div className="flex justify-between items-center mb-3">
          <h2 className="h3">الطلبات ({requests.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-40">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>النوع</th><th>الموظف</th><th>التفاصيل</th><th>التاريخ</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.type?.nameAr}</td>
                  <td>{r.employee?.fullNameAr || '—'}</td>
                  <td className="text-xs max-w-xs truncate">{r.payloadJson?.details || JSON.stringify(r.payloadJson)}</td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td><span className={['approved', 'done'].includes(r.status) ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warn'}>{STATUS_AR[r.status]}</span></td>
                  <td className="space-x-1 space-x-reverse">
                    {r.status === 'submitted' && canManager && (
                      <>
                        <button onClick={() => decide(r.id, 'manager', 'approve')} className="btn-primary text-xs">اعتماد</button>
                        <button onClick={() => decide(r.id, 'manager', 'reject')} className="btn-secondary text-xs">رفض</button>
                      </>
                    )}
                    {r.status === 'in_approval' && canProcess && (
                      <>
                        <button onClick={() => decide(r.id, 'hr', 'approve')} className="btn-primary text-xs">اعتماد HR</button>
                        <button onClick={() => decide(r.id, 'hr', 'reject')} className="btn-secondary text-xs">رفض</button>
                      </>
                    )}
                    {r.status === 'approved' && canProcess && (
                      <button onClick={() => decide(r.id, 'hr', 'done')} className="btn-primary text-xs">تنفيذ</button>
                    )}
                  </td>
                </tr>
              ))}
              {!requests.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
