import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const STATUS_AR = {
  pending: 'بانتظار المدير', manager_approved: 'بانتظار HR', approved: 'معتمدة',
  rejected: 'مرفوضة', cancelled: 'ملغاة',
};

export default function Leaves() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [filter, setFilter] = useState('');
  const canManagerApprove = hasAny('leaves.approve', 'requests.approve');
  const canHrApprove = hasAny('leaves.approve.hr');

  function load() {
    client.get('/leaves/requests', { params: filter ? { status: filter } : {} }).then(({ data }) => setRequests(data.requests));
    client.get('/leaves/types').then(({ data }) => setTypes(data.types));
    client.get('/leaves/holidays').then(({ data }) => setHolidays(data.holidays));
  }
  useEffect(load, [filter]);

  function decide(id, stage, decision) {
    client.post(`/leaves/requests/${id}/${stage}-decision`, { decision })
      .then(() => { toast.success('تم'); load(); })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">إدارة الإجازات</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {types.map((t) => (
          <div key={t.id} className="card-padded text-center">
            <div className="text-sm font-medium">{t.nameAr}</div>
            <div className="text-xs text-ink-500 mt-1">
              {t.rulesJson?.daysPerYear ? `${t.rulesJson.daysPerYear} يوم/سنة` : t.rulesJson?.daysMax ? `${t.rulesJson.daysMin}-${t.rulesJson.daysMax} يوم` : t.rulesJson?.maxDaysPerYear ? `حتى ${t.rulesJson.maxDaysPerYear}` : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="card-padded">
        <div className="flex items-center justify-between mb-3">
          <h2 className="h3">طلبات الإجازات ({requests.length})</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input w-44">
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>النوع</th><th>الفترة</th><th>الأيام</th><th>الحالة</th><th>إجراء</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee?.fullNameAr || '—'}</td>
                  <td>{r.leaveType?.nameAr}</td>
                  <td>{fmtDate(r.startDate)} ← {fmtDate(r.endDate)}</td>
                  <td>{r.days}</td>
                  <td><span className={r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warn'}>{STATUS_AR[r.status] || r.status}</span></td>
                  <td className="space-x-1 space-x-reverse">
                    {r.status === 'pending' && canManagerApprove && (
                      <>
                        <button onClick={() => decide(r.id, 'manager', 'approve')} className="btn-primary text-xs">اعتماد</button>
                        <button onClick={() => decide(r.id, 'manager', 'reject')} className="btn-secondary text-xs">رفض</button>
                      </>
                    )}
                    {r.status === 'manager_approved' && canHrApprove && (
                      <>
                        <button onClick={() => decide(r.id, 'hr', 'approve')} className="btn-primary text-xs">اعتماد HR</button>
                        <button onClick={() => decide(r.id, 'hr', 'reject')} className="btn-secondary text-xs">رفض</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!requests.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-padded">
        <h2 className="h3 mb-3">العطل الرسمية</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          {holidays.map((h) => (
            <div key={h.id} className="p-3 rounded-lg border border-ink-100">
              <div className="font-medium">{h.nameAr}</div>
              <div className="text-xs text-ink-500 mt-1">{fmtDate(h.startDate)} — {fmtDate(h.endDate)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
