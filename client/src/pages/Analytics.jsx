import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function Analytics() {
  const toast = useToast();
  const [kpis, setKpis] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ processCode: 'RECRUITMENT', nameAr: '', nameEn: '', targetValue: 100, currentValue: 0, measurementUnit: '%', direction: 'higher_is_better', frequency: 'monthly' });

  function load() {
    client.get('/analytics/kpis').then(({ data }) => setKpis(data.kpis));
  }
  useEffect(load, []);

  function save() {
    client.post('/analytics/kpis', form).then(() => { toast.success('تم إضافة المؤشر'); setShowNew(false); load(); });
  }

  function measure(id, currentValue) {
    client.patch(`/analytics/kpis/${id}/measure`, { currentValue: +currentValue }).then(() => { toast.success('تم القياس'); load(); });
  }

  const grouped = kpis.reduce((acc, k) => {
    (acc[k.processCode] = acc[k.processCode] || []).push(k);
    return acc;
  }, {});

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="h1">التحليلات ومؤشرات الأداء</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ مؤشر جديد</button>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">العملية</label><input value={form.processCode} onChange={(e) => setForm({ ...form, processCode: e.target.value })} className="input" /></div>
            <div><label className="label">وحدة القياس</label><input value={form.measurementUnit} onChange={(e) => setForm({ ...form, measurementUnit: e.target.value })} className="input" /></div>
            <div><label className="label">الاسم (عربي)</label><input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" /></div>
            <div><label className="label">الاسم (English)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="input" /></div>
            <div><label className="label">القيمة المستهدفة</label><input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: +e.target.value })} className="input" /></div>
            <div><label className="label">القيمة الحالية</label><input type="number" value={form.currentValue} onChange={(e) => setForm({ ...form, currentValue: +e.target.value })} className="input" /></div>
            <div><label className="label">الاتجاه</label>
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="input">
                <option value="higher_is_better">أعلى أفضل</option>
                <option value="lower_is_better">أقل أفضل</option>
              </select>
            </div>
            <div><label className="label">التكرار</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="input">
                {['daily','weekly','monthly','quarterly','yearly'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([proc, items]) => (
        <div key={proc} className="card-padded">
          <h3 className="h3 mb-3">{proc}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((k) => {
              const pct = k.targetValue ? Math.min(100, Math.abs(k.currentValue / k.targetValue * 100)) : 0;
              const ok = k.direction === 'higher_is_better' ? k.currentValue >= k.targetValue : k.currentValue <= k.targetValue;
              return (
                <div key={k.id} className="p-4 rounded-lg border border-ink-100">
                  <div className="text-sm font-medium">{k.nameAr}</div>
                  <div className="text-xs text-ink-500 mb-2">{k.nameEn} • {k.frequency}</div>
                  <div className="flex items-end gap-2 mb-2">
                    <div className="text-3xl font-bold">{k.currentValue}</div>
                    <div className="text-sm text-ink-500">/ {k.targetValue} {k.measurementUnit}</div>
                  </div>
                  <div className="w-full bg-ink-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${ok ? 'bg-success-500' : 'bg-warn-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs ${ok ? 'text-success-600' : 'text-warn-600'}`}>{ok ? '✓ محقق' : `فجوة: ${k.gapAuto?.toFixed(1)}`}</span>
                    <button onClick={() => { const v = prompt('القيمة الحالية:', k.currentValue); if (v !== null) measure(k.id, v); }} className="text-xs text-primary-600 hover:underline">قياس</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}