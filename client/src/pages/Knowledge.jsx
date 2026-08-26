import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function Knowledge() {
  const toast = useToast();
  const [docs, setDocs] = useState([]);
  const [filter, setFilter] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titleAr: '', contentMarkdown: '', category: 'sop', status: 'draft' });

  function load() {
    const params = filter ? { category: filter } : {};
    client.get('/knowledge/documents', { params }).then(({ data }) => setDocs(data.documents));
  }
  useEffect(load, [filter]);

  function save() {
    client.post('/knowledge/documents', form).then(() => {
      toast.success('تم إنشاء الوثيقة');
      setShowNew(false);
      setForm({ titleAr: '', contentMarkdown: '', category: 'sop', status: 'draft' });
      load();
    }).catch((e) => toast.error(e.response?.data?.error));
  }

  const cats = ['sop', 'guide', 'template', 'lesson_learned'];

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="h1">إدارة المعرفة</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ وثيقة جديدة</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilter(null)} className={`btn ${!filter ? 'btn-primary' : 'btn-secondary'}`}>الكل</button>
        {cats.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}>{c}</button>
        ))}
      </div>

      {showNew && (
        <div className="card-padded space-y-3 animate-slide-up">
          <h3 className="h3">وثيقة جديدة</h3>
          <div><label className="label">العنوان</label><input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">الفئة</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                <option value="draft">مسودة</option>
                <option value="in_review">قيد المراجعة</option>
                <option value="approved">معتمدة</option>
                <option value="published">منشورة</option>
              </select>
            </div>
          </div>
          <div><label className="label">المحتوى (Markdown)</label><textarea value={form.contentMarkdown} onChange={(e) => setForm({ ...form, contentMarkdown: e.target.value })} className="textarea min-h-[150px]" /></div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>الكود</th><th>العنوان</th><th>الفئة</th><th>الحالة</th><th>الإصدار</th><th>تاريخ التحديث</th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="font-mono text-xs">{d.code}</td>
                <td className="font-medium">{d.titleAr}</td>
                <td><span className="badge-ink">{d.category}</span></td>
                <td><span className={
                  d.status === 'published' ? 'badge-success' :
                  d.status === 'draft' ? 'badge-ink' :
                  d.status === 'in_review' ? 'badge-warn' : 'badge-primary'
                }>{d.status}</span></td>
                <td>v{d.version}</td>
                <td className="text-xs text-ink-500">{new Date(d.updatedAt).toLocaleDateString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}