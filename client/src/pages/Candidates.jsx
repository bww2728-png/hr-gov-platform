import React, { useEffect, useState } from 'react';
import client from '../api/client';

export default function Candidates() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      client.get('/lifecycle/candidates', { params: { search } }).then(({ data }) => setList(data.candidates)).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="page space-y-4">
      <h1 className="h1">المرشحون</h1>
      <div className="card-padded">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم، الإيميل..." className="input" />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>الاسم</th><th>الإيميل</th><th>الجوال</th><th>المصدر</th><th>عدد الطلبات</th><th>تاريخ التسجيل</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-6 text-ink-500">جاري التحميل...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-ink-500">لا توجد بيانات</td></tr>}
            {list.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.fullNameAr}</td>
                <td className="text-xs">{c.email}</td>
                <td className="font-mono text-xs">{c.phone}</td>
                <td><span className="badge-ink">{c.source}</span></td>
                <td>{c.applications?.length || 0}</td>
                <td className="text-xs text-ink-500">{new Date(c.createdAt).toLocaleDateString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}