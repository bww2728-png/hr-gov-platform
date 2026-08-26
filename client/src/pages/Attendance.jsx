import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const STATUS_AR = { present: 'حاضر', absent: 'غائب', leave: 'إجازة', holiday: 'عطلة', remote: 'عن بعد', pending: 'معلق', approved: 'معتمد', rejected: 'مرفوض' };

export default function Attendance() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [overtime, setOvertime] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [tab, setTab] = useState('records');
  const canApproveOt = hasAny('overtime.approve');

  function load() {
    client.get('/attendance/records').then(({ data }) => setRecords(data.records.slice(0, 100)));
    client.get('/attendance/overtime').then(({ data }) => setOvertime(data.requests));
    if (hasAny('attendance.read', 'attendance.incidents.write')) {
      client.get('/attendance/incidents').then(({ data }) => setIncidents(data.incidents)).catch(() => {});
    }
  }
  useEffect(load, []);

  function decideOt(id, decision) {
    client.post(`/attendance/overtime/${id}/decision`, { decision })
      .then(() => { toast.success('تم'); load(); })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'records', label: 'سجلات الحضور' },
    { id: 'overtime', label: `العمل الإضافي (${overtime.length})` },
    { id: 'incidents', label: `المخالفات (${incidents.length})` },
  ];

  return (
    <div className="page space-y-4">
      <h1 className="h1">الحضور والانصراف</h1>

      <div className="flex gap-2 border-b border-ink-100">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'records' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>حضور</th><th>انصراف</th><th>ساعات</th><th>تأخير</th><th>الحالة</th><th>الطريقة</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.checkIn ? new Date(r.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{r.checkOut ? new Date(r.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td>{r.workedHours ? `${r.workedHours} س` : '—'}</td>
                    <td>{r.lateMins > 0 ? <span className="text-warn-600">{r.lateMins} د</span> : '—'}</td>
                    <td><span className={r.status === 'present' ? 'badge-success' : r.status === 'absent' ? 'badge-danger' : 'badge-ink'}>{STATUS_AR[r.status] || r.status}</span></td>
                    <td className="text-xs text-ink-500">{{ fingerprint: 'بصمة', gps: 'GPS', card: 'بطاقة', manual: 'يدوي' }[r.method]}</td>
                  </tr>
                ))}
                {!records.length && <tr><td colSpan={7} className="text-center text-ink-400">لا توجد سجلات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'overtime' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>الساعات</th><th>السبب</th><th>طارئ</th><th>الحالة</th><th>إجراء</th></tr></thead>
              <tbody>
                {overtime.map((o) => (
                  <tr key={o.id}>
                    <td>{fmtDate(o.date)}</td>
                    <td>{o.hours}</td>
                    <td>{o.reason}</td>
                    <td>{o.isEmergency ? <span className="badge-warn">طارئ</span> : '—'}</td>
                    <td><span className={o.status === 'approved' ? 'badge-success' : o.status === 'rejected' ? 'badge-danger' : 'badge-warn'}>{STATUS_AR[o.status]}</span></td>
                    <td>
                      {o.status === 'pending' && canApproveOt && (
                        <div className="flex gap-1">
                          <button onClick={() => decideOt(o.id, 'approve')} className="btn-primary text-xs">اعتماد</button>
                          <button onClick={() => decideOt(o.id, 'reject')} className="btn-secondary text-xs">رفض</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!overtime.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-ink-400 mt-2">سقف العمل الإضافي النظامي: 720 ساعة سنوياً × 1.5 أجر الساعة</p>
        </div>
      )}

      {tab === 'incidents' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>النوع</th><th>التكرار</th><th>عذر</th><th>الإجراء</th></tr></thead>
              <tbody>
                {incidents.map((i) => (
                  <tr key={i.id}>
                    <td>{fmtDate(i.date)}</td>
                    <td>{{ late: 'تأخير', absence: 'غياب', early_leave: 'انصراف مبكر' }[i.type]}</td>
                    <td>{i.occurrence}</td>
                    <td>{i.hasExcuse ? 'نعم' : 'لا'}</td>
                    <td><span className={i.action === 'deduction' ? 'badge-danger' : i.action?.startsWith('warning') ? 'badge-warn' : 'badge-ink'}>
                      {{ warning_1: 'إنذار أول', warning_2: 'إنذار ثانٍ', deduction: 'خصم', none: 'بدون' }[i.action] || i.action}
                    </span></td>
                  </tr>
                ))}
                {!incidents.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد مخالفات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
