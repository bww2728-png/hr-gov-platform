import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const SCORE_COLORS = ['bg-red-200', 'bg-red-400', 'bg-amber-300', 'bg-amber-400', 'bg-green-400', 'bg-green-600'];

export default function Maturity() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [showAssess, setShowAssess] = useState(false);
  const [form, setForm] = useState({ dimensionId: null, score: 3, evidence: '' });

  function load() {
    client.get('/analytics/maturity/summary').then(({ data }) => setSummary(data));
  }
  useEffect(load, []);

  function assess() {
    client.post('/analytics/maturity/assess', form).then(() => {
      toast.success('تم تسجيل التقييم');
      setShowAssess(false);
      setForm({ dimensionId: null, score: 3, evidence: '' });
      load();
    });
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">قياس النضج المؤسسي</h1>
          <p className="muted">{summary?.totalDimensions || 0} بعد عبر 7 محاور • متوسط عام {summary?.overallAvg || 0} / 5</p>
        </div>
        <button onClick={() => setShowAssess((s) => !s)} className="btn-primary">+ تقييم جديد</button>
      </div>

      {showAssess && (
        <div className="card-padded space-y-3">
          <h3 className="h3">تقييم جديد</h3>
          <div>
            <label className="label">البعد</label>
            <select value={form.dimensionId || ''} onChange={(e) => setForm({ ...form, dimensionId: +e.target.value })} className="input">
              <option value="">اختر البعد</option>
              {summary?.axes.flatMap((a) => a.dimensions.map((d) => (
                <option key={d.code} value={d.code}>{a.axisNameAr} - {d.nameAr}</option>
              )))}
            </select>
          </div>
          <div>
            <label className="label">المستوى (1-5)</label>
            <input type="range" min="1" max="5" value={form.score} onChange={(e) => setForm({ ...form, score: +e.target.value })} className="w-full" />
            <div className="flex justify-between text-xs text-ink-500">
              <span>1 - أولي</span><span>2 - مكرر</span><span>3 - محدد</span><span>4 - مُدار</span><span>5 - مُحسّن</span>
            </div>
            <div className="text-center text-2xl font-bold mt-1">{form.score}</div>
          </div>
          <div><label className="label">الدليل</label><textarea value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} className="textarea" /></div>
          <div className="flex gap-2">
            <button onClick={assess} className="btn-primary">حفظ</button>
            <button onClick={() => setShowAssess(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-4">
          {summary.axes.map((a) => (
            <div key={a.axisId} className="card-padded">
              <div className="flex items-center justify-between mb-3">
                <h3 className="h3">{a.axisNameAr} <span className="text-ink-500 text-sm">({a.axisNameEn})</span></h3>
                <div className="flex gap-2">
                  <span className="badge-primary">المتوسط: {a.avg.toFixed(2)} / 5</span>
                  <span className="badge-ink">{a.count} بعد</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {a.dimensions.map((d) => (
                  <div key={d.code} className={`p-3 rounded-lg ${SCORE_COLORS[d.score] || 'bg-ink-100'}`}>
                    <div className="text-xs text-ink-700 font-medium">#{d.code}</div>
                    <div className="text-sm font-semibold mt-1">{d.nameAr}</div>
                    <div className="text-2xl font-bold mt-2">{d.score || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}