import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { fmtDate, relativeDays } from '../utils/datetime';

export default function Policies() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    const params = filter ? { jurisdiction: filter } : {};
    client.get('/knowledge/policies', { params }).then(({ data }) => setList(data.policies));
  }, [filter]);

  return (
    <div className="page space-y-4">
      <h1 className="h1">السياسات</h1>
      <div className="flex gap-2">
        <button onClick={() => setFilter(null)} className={`btn ${!filter ? 'btn-primary' : 'btn-secondary'}`}>الكل</button>
        {['SA','AE','EG','GLOBAL'].map((j) => (
          <button key={j} onClick={() => setFilter(j)} className={`btn ${filter === j ? 'btn-primary' : 'btn-secondary'}`}>{j}</button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>الكود</th><th>العنوان</th><th>الولاية</th><th>التفعيل</th><th>الانتهاء</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.code}</td>
                <td className="font-medium">{p.titleAr}</td>
                <td><span className="badge-primary">{p.jurisdiction}</span></td>
                <td className="text-xs">{fmtDate(p.effectiveDate)}</td>
                <td className="text-xs">{p.expiryDate ? `${fmtDate(p.expiryDate)} (${relativeDays(p.expiryDate)})` : '—'}</td>
                <td><span className={p.status === 'published' ? 'badge-success' : 'badge-ink'}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}