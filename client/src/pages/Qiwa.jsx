import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const STATUS_AR = { draft: 'مسودة', raised: 'مرفوع', in_progress: 'قيد المعالجة', completed: 'مكتمل', rejected: 'مرفوض' };
const STATUS_CLS = { draft: 'badge-ink', raised: 'badge-primary', in_progress: 'badge-warn', completed: 'badge-success', rejected: 'badge-danger' };

export default function Qiwa() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [changeTypes, setChangeTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId: '', changeType: '', notes: '' });
  const [showNew, setShowNew] = useState(false);
  const canWrite = hasAny('qiwa.write');

  function load() {
    client.get('/qiwa').then(({ data }) => setRequests(data.requests)).catch((e) => toast.error(errMsg(e)));
    client.get('/lookups', { params: { category: 'qiwa_change_type' } }).then(({ data }) => setChangeTypes(data.lookups)).catch(() => {});
    if (canWrite) client.get('/hr/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => {});
  }
  useEffect(load, []);

  function submit(e) {
    e.preventDefault();
    client.post('/qiwa', { employeeId: form.employeeId || null, changeType: form.changeType, notes: form.notes })
      .then(() => { toast.success('أُنشئ الطلب'); setForm({ employeeId: '', changeType: '', notes: '' }); setShowNew(false); load(); })
      .catch((err) => toast.error(errMsg(err)));
  }

  function act(id, action) {
    client.post(`/qiwa/${id}/${action}`)
      .then(() => { toast.success('تم'); load(); })
      .catch((err) => toast.error(errMsg(err)));
  }

  const typeAr = (code) => changeTypes.find((t) => t.code === code)?.valueAr || code;

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="h1">طلبات منصة قوى</h1>
          <p className="muted">سجل داخلي لطلبات قوى — الرفع محاكاة (لا تكامل حكومي فعلي في هذه المرحلة).</p>
        </div>
        {canWrite && <button onClick={() => setShowNew((s) => !s)} className="btn-primary">{showNew ? 'إغلاق' : 'طلب جديد'}</button>}
      </div>

      {showNew && canWrite && (
        <form onSubmit={submit} className="card-padded grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <label className="text-xs">
            <span className="block text-ink-500 mb-1">الموظف</span>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="input w-full">
              <option value="">— اختر —</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.fullNameAr} ({e.employeeNumber})</option>)}
            </select>
          </label>
          <label className="text-xs">
            <span className="block text-ink-500 mb-1">نوع التغيير</span>
            <select value={form.changeType} onChange={(e) => setForm({ ...form, changeType: e.target.value })} required className="input w-full">
              <option value="">— اختر —</option>
              {changeTypes.map((t) => <option key={t.code} value={t.code}>{t.valueAr}</option>)}
            </select>
          </label>
          <label className="text-xs md:col-span-1">
            <span className="block text-ink-500 mb-1">ملاحظات</span>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input w-full" />
          </label>
          <button className="btn-primary">إنشاء</button>
        </form>
      )}

      <div className="card-padded">
        <div className="table-wrap">
          <table>
            <thead><tr><th>رقم الطلب</th><th>الموظف</th><th>نوع التغيير</th><th>الحالة</th><th>أُنشئ</th><th>إجراء</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.requestNo}</td>
                  <td>{r.employee?.fullNameAr || '—'}</td>
                  <td>{typeAr(r.changeType)}</td>
                  <td><span className={STATUS_CLS[r.status] || 'badge-ink'}>{STATUS_AR[r.status] || r.status}</span></td>
                  <td>{fmtDate(r.createdAt)}</td>
                  <td className="space-x-1 space-x-reverse">
                    {canWrite && r.status === 'draft' && <button onClick={() => act(r.id, 'raise')} className="btn-secondary text-xs">رفع</button>}
                    {canWrite && r.status === 'raised' && <button onClick={() => act(r.id, 'complete')} className="btn-secondary text-xs">إتمام</button>}
                    {canWrite && ['draft', 'raised'].includes(r.status) && <button onClick={() => act(r.id, 'reject')} className="btn-secondary text-xs text-danger-600">رفض</button>}
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
