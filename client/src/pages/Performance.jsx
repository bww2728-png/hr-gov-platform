import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RATING_AR = { exceptional: 'استثنائي', exceeds: 'يتجاوز التوقعات', meets: 'يلبي التوقعات', below: 'دون التوقعات', poor: 'ضعيف' };
const REVIEW_STATUS = { pending_self: 'تقييم ذاتي', pending_manager: 'تقييم المدير', pending_review: 'اعتماد نهائي', completed: 'مكتمل' };

export default function Performance() {
  const { hasAny, user } = useAuth();
  const toast = useToast();
  const [cycles, setCycles] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [pips, setPips] = useState([]);
  const [tab, setTab] = useState('objectives');
  const [objForm, setObjForm] = useState({ title: '', description: '', keyResults: [{ title: '', targetValue: '', unit: '' }] });

  function load() {
    client.get('/perf/cycles').then(({ data }) => setCycles(data.cycles));
    client.get('/perf/objectives').then(({ data }) => setObjectives(data.objectives));
    client.get('/perf/reviews').then(({ data }) => setReviews(data.reviews));
    if (hasAny('pip.read')) client.get('/perf/pips').then(({ data }) => setPips(data.pips)).catch(() => {});
  }
  useEffect(load, []);

  const activeCycle = cycles.find((c) => c.status === 'active') || cycles[0];

  function addObjective(e) {
    e.preventDefault();
    if (!activeCycle) return toast.error('لا توجد دورة أداء نشطة');
    const krs = objForm.keyResults.filter((k) => k.title && k.targetValue);
    client.post('/perf/objectives', {
      cycleId: activeCycle.id, title: objForm.title, description: objForm.description,
      keyResults: krs.map((k) => ({ ...k, targetValue: Number(k.targetValue) })),
    }).then(() => { toast.success('تمت إضافة الهدف'); setObjForm({ title: '', description: '', keyResults: [{ title: '', targetValue: '', unit: '' }] }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function reviewAction(id, action, body) {
    client.post(`/perf/reviews/${id}/${action}`, body)
      .then(() => { toast.success('تم'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'objectives', label: `الأهداف OKR (${objectives.length})` },
    { id: 'reviews', label: `التقييمات (${reviews.length})` },
    ...(hasAny('pip.read') ? [{ id: 'pips', label: `خطط التحسين (${pips.length})` }] : []),
  ];

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="h1">إدارة الأداء</h1>
        {activeCycle && <span className="badge-primary">{activeCycle.nameAr}</span>}
      </div>

      <div className="flex gap-2 border-b border-ink-100">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'objectives' && (
        <>
          <form onSubmit={addObjective} className="card-padded space-y-2">
            <h2 className="h3">هدف جديد</h2>
            <input value={objForm.title} onChange={(e) => setObjForm({ ...objForm, title: e.target.value })} required placeholder="عنوان الهدف" className="input w-full" />
            <input value={objForm.description} onChange={(e) => setObjForm({ ...objForm, description: e.target.value })} placeholder="الوصف (اختياري)" className="input w-full" />
            {objForm.keyResults.map((kr, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <input value={kr.title} onChange={(e) => { const k = [...objForm.keyResults]; k[i].title = e.target.value; setObjForm({ ...objForm, keyResults: k }); }} placeholder="نتيجة مفتاحية" className="input" />
                <input type="number" value={kr.targetValue} onChange={(e) => { const k = [...objForm.keyResults]; k[i].targetValue = e.target.value; setObjForm({ ...objForm, keyResults: k }); }} placeholder="المستهدف" className="input" />
                <input value={kr.unit} onChange={(e) => { const k = [...objForm.keyResults]; k[i].unit = e.target.value; setObjForm({ ...objForm, keyResults: k }); }} placeholder="الوحدة" className="input" />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="button" onClick={() => setObjForm({ ...objForm, keyResults: [...objForm.keyResults, { title: '', targetValue: '', unit: '' }] })} className="btn-secondary text-xs">+ نتيجة مفتاحية</button>
              <button className="btn-primary">حفظ الهدف</button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {objectives.map((o) => (
              <div key={o.id} className="card-padded space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">{o.title}</span>
                  <span className="badge-ink">{o.status}</span>
                </div>
                {o.description && <p className="text-sm text-ink-500">{o.description}</p>}
                <div className="space-y-1">
                  {o.keyResults.map((kr) => {
                    const pct = Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
                    return (
                      <div key={kr.id}>
                        <div className="flex justify-between text-xs"><span>{kr.title}</span><span>{kr.currentValue}/{kr.targetValue} {kr.unit}</span></div>
                        <div className="h-1.5 bg-ink-100 rounded-full"><div className="h-1.5 bg-primary-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {!objectives.length && <div className="text-ink-400 text-sm">لا توجد أهداف بعد</div>}
          </div>
        </>
      )}

      {tab === 'reviews' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>الموظف</th><th>ذاتي</th><th>المدير</th><th>النهائي</th><th>التقدير</th><th>الحالة</th><th>إجراء</th></tr></thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employee?.fullNameAr || '—'}</td>
                    <td>{r.selfScore ?? '—'}</td>
                    <td>{r.managerScore ?? '—'}</td>
                    <td>{r.finalScore ?? '—'}</td>
                    <td>{r.rating ? RATING_AR[r.rating] : '—'}</td>
                    <td><span className={r.status === 'completed' ? 'badge-success' : 'badge-warn'}>{REVIEW_STATUS[r.status]}</span></td>
                    <td className="space-x-1 space-x-reverse">
                      {r.status === 'pending_self' && (
                        <button onClick={() => { const s = prompt('تقييمك الذاتي (0-5):'); if (s) reviewAction(r.id, 'self', { selfScore: Number(s) }); }} className="btn-primary text-xs">تقييم ذاتي</button>
                      )}
                      {r.status === 'pending_manager' && hasAny('perf.review.write') && (
                        <button onClick={() => { const s = prompt('تقييم المدير (0-5):'); if (s) reviewAction(r.id, 'manager', { managerScore: Number(s) }); }} className="btn-primary text-xs">تقييم المدير</button>
                      )}
                      {r.status === 'pending_review' && hasAny('perf.review.approve') && (
                        <button onClick={() => { const s = prompt('الدرجة النهائية (0-5):'); if (s) reviewAction(r.id, 'finalize', { finalScore: Number(s), rating: 'meets' }); }} className="btn-primary text-xs">اعتماد</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!reviews.length && <tr><td colSpan={7} className="text-center text-ink-400">لا توجد تقييمات</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'pips' && (
        <div className="card-padded">
          <div className="space-y-2">
            {pips.map((p) => (
              <div key={p.id} className="p-3 rounded-lg border border-ink-100 flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.employee?.fullNameAr}</div>
                  <div className="text-xs text-ink-500">{new Date(p.startDate).toLocaleDateString('ar-SA')} — {new Date(p.endDate).toLocaleDateString('ar-SA')}</div>
                </div>
                <span className={p.status === 'passed' ? 'badge-success' : p.status === 'failed' ? 'badge-danger' : 'badge-warn'}>
                  {{ active: 'نشطة', extended: 'ممددة', passed: 'ناجحة', failed: 'فاشلة', cancelled: 'ملغاة' }[p.status]}
                </span>
              </div>
            ))}
            {!pips.length && <div className="text-ink-400 text-sm">لا توجد خطط تحسين</div>}
          </div>
        </div>
      )}
    </div>
  );
}
