import React, { useEffect, useState } from 'react';
import client from '../api/client';

export default function OrgChart() {
  const [emps, setEmps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get('/hr/org-chart').then(({ data }) => setEmps(data.employees)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page text-ink-500">جاري التحميل...</div>;

  // Build tree
  const byManager = {};
  emps.forEach((e) => {
    const k = e.managerId || 'ROOT';
    if (!byManager[k]) byManager[k] = [];
    byManager[k].push(e);
  });

  function Tree({ managerId }) {
    const children = byManager[managerId] || [];
    if (children.length === 0) return null;
    return (
      <ul className="space-y-1">
        {children.map((e) => (
          <li key={e.id} className="border-s-2 border-primary-200 ps-3">
            <div className="flex items-center gap-2 py-1">
              <span className="w-2 h-2 rounded-full bg-primary-500" />
              <span className="font-medium text-sm">{e.fullNameAr}</span>
              <span className="badge-ink text-xs">{e.position?.titleAr}</span>
              <span className="badge-ink text-xs">{e.branch?.nameAr}</span>
            </div>
            <Tree managerId={e.id} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">الهيكل التنظيمي</h1>
        <p className="muted">{emps.length} موظف في الهيكل</p>
      </div>
      <div className="card-padded">
        <Tree managerId="ROOT" />
      </div>
    </div>
  );
}