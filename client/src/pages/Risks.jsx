import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const LEVEL_BG = { low: 'bg-green-100', medium: 'bg-amber-100', high: 'bg-orange-200', critical: 'bg-red-200' };

export default function Risks() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', titleAr: '', titleEn: '', category: 'operational', probability: 3, impact: 3, status: 'identified' });

  function load() {
    client.get('/analytics/risks').then(({ data }) => setList(data.risks));
  }
  useEffect(load, []);

  function save() {
    client.post('/analytics/risks', form).then(() => {
      toast.success('تم إضافة المخاطرة');
      setShowNew(false);
      load();
    });
  }

  const score = (form.probability || 0) * (form.impact || 0);

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="h1">إدارة المخاطر ({list.length})</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ مخاطرة جديدة</button>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">الكود</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="C16" className="input" /></div>
            <div><label className="label">الفئة</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input">
                {['operational','strategic','financial','compliance','security'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2"><label className="label">العنوان (عربي)</label><input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} className="input" /></div>
            <div className="col-span-2"><label className="label">العنوان (English)</label><input value={form.titleEn} onChange={(e) => setForm({ ...form, titleEn: e.target.value })} className="input" /></div>
            <div>
              <label className="label">الاحتمال (1-5)</label>
              <input type="range" min="1" max="5" value={form.probability} onChange={(e) => setForm({ ...form, probability: +e.target.value })} className="w-full" />
              <div className="text-center font-bold">{form.probability}</div>
            </div>
            <div>
              <label className="label">الأثر (1-5)</label>
              <input type="range" min="1" max="5" value={form.impact} onChange={(e) => setForm({ ...form, impact: +e.target.value })} className="w-full" />
              <div className="text-center font-bold">{form.impact}</div>
            </div>
          </div>
          <div className="text-center text-lg">الدرجة المتوقعة: <span className="font-bold text-2xl">{score}</span> / 25</div>
          <div className="flex gap-2 justify-end">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {/* 5x5 matrix */}
      <div className="card-padded">
        <h3 className="h3 mb-3">مصفوفة المخاطر (5×5)</h3>
        <div className="grid grid-cols-6 gap-1">
          <div></div>
          {[1,2,3,4,5].map((i) => <div key={i} className="text-center text-xs font-medium">أثر {i}</div>)}
          {[5,4,3,2,1].map((p) => (
            <React.Fragment key={p}>
              <div className="text-xs font-medium text-center">احتمال {p}</div>
              {[1,2,3,4,5].map((i) => {
                const s = p * i;
                const lvl = s >= 20 ? 'critical' : s >= 12 ? 'high' : s >= 6 ? 'medium' : 'low';
                const items = list.filter((r) => r.probability === p && r.impact === i);
                return (
                  <div key={i} className={`${LEVEL_BG[lvl]} aspect-square rounded flex items-center justify-center text-xs font-bold relative group`}>
                    {s}
                    {items.length > 0 && <span className="absolute top-1 end-1 bg-primary-600 text-white text-[10px] rounded-full px-1.5">{items.length}</span>}
                    {items.length > 0 && (
                      <div className="absolute hidden group-hover:block bg-white border border-ink-300 rounded-lg shadow-pop p-2 z-10 text-start top-full end-0 mt-1 min-w-[200px]">
                        {items.map((r) => <div key={r.id} className="text-xs">{r.titleAr}</div>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>الكود</th><th>العنوان</th><th>الفئة</th><th>الاحتمال</th><th>الأثر</th><th>الدرجة</th><th>المستوى</th><th>الحالة</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.code}</td>
                <td className="font-medium">{r.titleAr}</td>
                <td><span className="badge-ink">{r.category}</span></td>
                <td className="text-center">{r.probability}</td>
                <td className="text-center">{r.impact}</td>
                <td className="text-center font-bold">{r.score}</td>
                <td><span className={
                  r.level === 'critical' ? 'badge-danger' :
                  r.level === 'high' ? 'badge-warn' :
                  r.level === 'medium' ? 'badge-primary' : 'badge-success'
                }>{r.level}</span></td>
                <td><span className="badge-ink">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}