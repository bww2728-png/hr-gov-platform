import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { fmtDateTime } from '../utils/datetime';

export default function Audit() {
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  useEffect(() => {
    const params = {};
    if (action) params.action = action;
    if (entityType) params.entityType = entityType;
    client.get('/admin/audit', { params }).then(({ data }) => setLogs(data.logs));
  }, [action, entityType]);

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">سجل التدقيق</h1>
        <p className="muted">سجل غير قابل للتعديل لكل عملية</p>
      </div>

      <div className="card-padded flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="label">الإجراء</label>
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="employee.create" className="input" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="label">نوع الكيان</label>
          <input value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="employee" className="input" />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>التاريخ</th><th>المستخدم</th><th>الإجراء</th><th>الكيان</th><th>التفاصيل</th><th>IP</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="text-xs font-mono whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                <td className="text-sm">{l.user?.fullNameAr || l.user?.username || '—'}</td>
                <td><code className="text-xs bg-ink-100 px-1.5 py-0.5 rounded">{l.action}</code></td>
                <td className="text-xs">{l.entityType}{l.entityId ? `#${l.entityId.slice(0, 8)}` : ''}</td>
                <td className="text-xs max-w-[300px] truncate font-mono" title={JSON.stringify(l.afterJson || l.details)}>{l.afterJson ? JSON.stringify(l.afterJson) : '—'}</td>
                <td className="text-xs font-mono">{l.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}