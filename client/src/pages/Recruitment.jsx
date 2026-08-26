import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function Recruitment() {
  const toast = useToast();
  const [postings, setPostings] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([
      client.get('/lifecycle/postings'),
      client.get('/lifecycle/pipeline'),
    ]).then(([a, b]) => {
      setPostings(a.data.postings);
      setPipeline(b.data);
    }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function setStatus(id, status) {
    client.patch(`/lifecycle/postings/${id}`, { status }).then(() => { toast.success('تم التحديث'); load(); }).catch((e) => toast.error(e.response?.data?.error));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">الاستقطاب والتوظيف</h1>

      {pipeline && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {['applied','screening','interview','assessment','offer','hired','rejected','withdrawn'].map((s) => (
            <div key={s} className="card-padded text-center">
              <div className="text-xs text-ink-500 mb-1">{s}</div>
              <div className="text-2xl font-bold">{pipeline.counts[s] || 0}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card-padded flex items-center justify-between">
        <h2 className="h3">الوظائف ({postings.length})</h2>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>الكود</th><th>العنوان</th><th>الحالة</th><th>الشواغر</th><th>المتقدمون</th><th>تاريخ النشر</th><th></th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-6 text-ink-500">جاري التحميل...</td></tr>}
            {postings.map((p) => (
              <tr key={p.id}>
                <td className="font-mono text-xs">{p.code}</td>
                <td className="font-medium">{p.titleAr}</td>
                <td>
                  <span className={
                    p.status === 'open' ? 'badge-success' :
                    p.status === 'draft' ? 'badge-ink' :
                    p.status === 'on_hold' ? 'badge-warn' : 'badge-danger'
                  }>{p.status}</span>
                </td>
                <td>{p.openings}</td>
                <td>{p._count?.applications || 0}</td>
                <td className="text-xs text-ink-500">{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('ar-SA') : '—'}</td>
                <td>
                  {p.status === 'draft' && <button onClick={() => setStatus(p.id, 'open')} className="text-xs text-success-600 hover:underline">نشر</button>}
                  {p.status === 'open' && <button onClick={() => setStatus(p.id, 'closed')} className="text-xs text-danger-600 hover:underline ms-2">إغلاق</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}