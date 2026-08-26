import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDate, relativeDays } from '../utils/datetime';

export default function Compliance() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [violations, setViolations] = useState([]);
  const [expiries, setExpiries] = useState([]);

  function load() {
    client.get('/compliance/summary').then(({ data }) => setSummary(data));
    client.get('/compliance/violations').then(({ data }) => setViolations(data.violations));
    client.get('/compliance/expiries', { params: { days: 90 } }).then(({ data }) => setExpiries(data.expiries));
  }
  useEffect(load, []);

  function resolve(id, status) {
    client.patch(`/compliance/violations/${id}/resolve`, { status }).then(() => { toast.success('تم التحديث'); load(); });
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">الامتثال التنظيمي</h1>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card-padded">
            <div className="muted">قواعد نشطة</div>
            <div className="text-3xl font-bold mt-1">{summary.totalRules}</div>
          </div>
          <div className="card-padded">
            <div className="muted">مخالفات مفتوحة</div>
            <div className="text-3xl font-bold text-danger-600 mt-1">{summary.openViolations}</div>
          </div>
          <div className="card-padded">
            <div className="muted">مخالفات حرجة</div>
            <div className="text-3xl font-bold text-danger-600 mt-1">{summary.criticalViolations}</div>
          </div>
          <div className="card-padded">
            <div className="muted">وثائق تنتهي خلال 30 يوم</div>
            <div className="text-3xl font-bold text-warn-600 mt-1">{summary.expiringSoon}</div>
          </div>
        </div>
      )}

      <div className="card-padded">
        <h2 className="h3 mb-3">المخالفات ({violations.length})</h2>
        <div className="space-y-2">
          {violations.map((v) => (
            <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border border-ink-100">
              <div>
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="font-medium">{v.rule?.nameAr}</span>
                  <span className={
                    v.severity === 'critical' ? 'badge-danger' :
                    v.severity === 'warning' ? 'badge-warn' : 'badge-primary'
                  }>{v.severity}</span>
                  <span className={v.status === 'resolved' ? 'badge-success' : 'badge-ink'}>{v.status}</span>
                </div>
                <p className="text-xs text-ink-500 mt-1">كيان {v.entityType}#{v.entityId} • {fmtDate(v.detectedAt)}</p>
              </div>
              {v.status !== 'resolved' && (
                <button onClick={() => resolve(v.id, 'resolved')} className="btn-primary text-xs">حل</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card-padded">
        <h2 className="h3 mb-3">انتهاء الوثائق ({expiries.length})</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>النوع</th><th>المرجع</th><th>تاريخ الانتهاء</th><th>المتبقي</th></tr></thead>
            <tbody>
              {expiries.map((e) => (
                <tr key={e.id}>
                  <td>{e.documentType}</td>
                  <td className="font-mono text-xs">{e.documentRef}</td>
                  <td className="text-xs">{fmtDate(e.expiryDate)}</td>
                  <td><span className={new Date(e.expiryDate) < new Date() ? 'badge-danger' : 'badge-warn'}>{relativeDays(e.expiryDate)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}