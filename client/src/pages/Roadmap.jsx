import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function Roadmap() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ weekNumber: 1, titleAr: '', titleEn: '', status: 'pending' });

  function load() {
    client.get('/analytics/roadmap').then(({ data }) => setItems(data.items));
  }
  useEffect(load, []);

  function save() {
    client.post('/analytics/roadmap', form).then(() => {
      toast.success('تم الإضافة');
      setShowNew(false);
      load();
    });
  }

  function setStatus(id, status) {
    client.patch(`/analytics/roadmap/${id}`, { status }).then(() => { toast.success('تم التحديث'); load(); });
  }

  // Group by phase
  const phases = [
    { name: 'التشخيص', from: 1, to: 8, color: 'bg-blue-500' },
    { name: 'التخطيط', from: 9, to: 16, color: 'bg-indigo-500' },
    { name: 'التنفيذ - المرحلة 1', from: 17, to: 26, color: 'bg-purple-500' },
    { name: 'التنفيذ - المرحلة 2', from: 27, to: 36, color: 'bg-violet-500' },
    { name: 'التثبيت', from: 37, to: 46, color: 'bg-teal-500' },
    { name: 'الاستدامة', from: 47, to: 52, color: 'bg-green-500' },
  ];

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">خارطة الطريق - 52 أسبوع</h1>
          <p className="muted">{items.length} بند</p>
        </div>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ بند جديد</button>
      </div>

      {/* Phases bar */}
      <div className="card-padded">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {phases.map((p) => {
            const width = ((p.to - p.from + 1) / 52) * 100;
            return (
              <div key={p.name} className={`${p.color} text-white text-xs flex items-center justify-center font-medium`} style={{ width: `${width}%` }}>
                {p.name}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-ink-500 mt-1">
          <span>أسبوع 1</span><span>أسبوع 26</span><span>أسبوع 52</span>
        </div>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <h3 className="h3">بند جديد</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">الأسبوع (1-52)</label><input type="number" min="1" max="52" value={form.weekNumber} onChange={(e) => setForm({ ...form, weekNumber: +e.target.value })} className="input" /></div>
            <div><label className="label">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                <option value="pending">قيد الانتظار</option>
                <option value="in_progress">جاري</option>
                <option value="done">مكتمل</option>
                <option value="blocked">محجوب</option>
              </select>
            </div>
            <div><label className="label">العنوان (عربي)</label><input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} className="input" /></div>
            <div><label className="label">العنوان (English)</label><input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className="input" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {/* Gantt-like grid */}
      <div className="card overflow-x-auto">
        <div className="grid grid-cols-[80px_1fr_120px] bg-ink-100 px-3 py-2 text-sm font-medium sticky top-0">
          <div>الأسبوع</div><div>العنوان</div><div>الحالة</div>
        </div>
        {items.map((it) => (
          <div key={it.id} className="grid grid-cols-[80px_1fr_120px] px-3 py-2 border-t border-ink-100 items-center text-sm">
            <div className="font-mono font-bold">W{it.weekNumber}</div>
            <div>
              <div className="font-medium">{it.titleAr}</div>
              {it.deliverable && <div className="text-xs text-ink-500">المخرج: {it.deliverable}</div>}
            </div>
            <div>
              <select value={it.status} onChange={(e) => setStatus(it.id, e.target.value)} className={`text-xs px-2 py-1 rounded border ${
                it.status === 'done' ? 'bg-green-50 text-success-600 border-green-300' :
                it.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                it.status === 'blocked' ? 'bg-red-50 text-danger-600 border-red-300' : 'bg-ink-50 border-ink-300'
              }`}>
                <option value="pending">قيد الانتظار</option>
                <option value="in_progress">جاري</option>
                <option value="done">مكتمل</option>
                <option value="blocked">محجوب</option>
                <option value="skipped">مُتجاوز</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}