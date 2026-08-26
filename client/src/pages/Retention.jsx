import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Retention() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [results, setResults] = useState(null);
  const [stayInterviews, setStayInterviews] = useState([]);
  const [respond, setRespond] = useState(null);
  const [answers, setAnswers] = useState({});

  const canSeeResults = hasAny('surveys.read', 'surveys.write', 'retention.read');

  function load() {
    client.get('/retention/surveys').then(({ data }) => setSurveys(data.surveys));
    if (canSeeResults) {
      client.get('/retention/dashboard').then(({ data }) => setDashboard(data)).catch(() => {});
      client.get('/retention/stay-interviews').then(({ data }) => setStayInterviews(data.interviews)).catch(() => {});
    }
  }
  useEffect(load, []);

  function showResults(s) {
    client.get(`/retention/surveys/${s.id}/results`).then(({ data }) => setResults(data)).catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }
  function submitResponse(e) {
    e.preventDefault();
    client.post(`/retention/surveys/${respond.id}/respond`, { answers })
      .then(() => { toast.success('شكراً لمشاركتك'); setRespond(null); setAnswers({}); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">الاحتفاظ بالموظفين</h1>

      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card-padded"><div className="muted">موظفون نشطون</div><div className="text-3xl font-bold mt-1">{dashboard.totalActive}</div></div>
          <div className="card-padded"><div className="muted">مغادرون هذا العام</div><div className="text-3xl font-bold text-warn-600 mt-1">{dashboard.exitsThisYear}</div></div>
          <div className="card-padded"><div className="muted">معدل الدوران</div><div className="text-3xl font-bold mt-1">{dashboard.turnoverPct}%</div></div>
          <div className="card-padded"><div className="muted">أحدث eNPS</div><div className={`text-3xl font-bold mt-1 ${dashboard.latestEnps >= 0 ? 'text-primary-700' : 'text-danger-600'}`}>{dashboard.latestEnps ?? '—'}</div></div>
        </div>
      )}

      <div className="card-padded">
        <h2 className="h3 mb-3">الاستطلاعات ({surveys.length})</h2>
        <div className="space-y-2">
          {surveys.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-ink-100">
              <div>
                <div className="font-medium">{s.titleAr}</div>
                <div className="text-xs text-ink-500">{{ enps: 'ولاء eNPS', pulse: 'نبض سريع', engagement: 'انخراط' }[s.type]} — {s._count?.responses || 0} إجابة</div>
              </div>
              <div className="flex gap-2 items-center">
                <span className={s.status === 'open' ? 'badge-success' : 'badge-ink'}>{{ draft: 'مسودة', open: 'مفتوح', closed: 'مغلق' }[s.status]}</span>
                {s.status === 'open' && <button onClick={() => setRespond(s)} className="btn-primary text-xs">شارك</button>}
                {canSeeResults && (s._count?.responses > 0) && <button onClick={() => showResults(s)} className="btn-secondary text-xs">النتائج</button>}
              </div>
            </div>
          ))}
          {!surveys.length && <div className="text-ink-400 text-sm">لا توجد استطلاعات</div>}
        </div>
      </div>

      {respond && (
        <div className="card-padded border-2 border-primary-200">
          <h2 className="h3 mb-3">{respond.titleAr} {respond.isAnonymous && <span className="badge-ink">مجهول</span>}</h2>
          <form onSubmit={submitResponse} className="space-y-3">
            {respond.questions.map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-medium mb-1">{q.text}</label>
                {q.scale === '0_10' && (
                  <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 11 }, (_, i) => (
                      <button type="button" key={i} onClick={() => setAnswers({ ...answers, [q.id]: i })}
                        className={`w-9 h-9 rounded-lg border text-sm ${answers[q.id] === i ? 'bg-primary-600 text-white border-primary-600' : 'border-ink-200'}`}>
                        {i}
                      </button>
                    ))}
                  </div>
                )}
                {q.scale === 'text' && (
                  <textarea value={answers[q.id] || ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} className="input w-full" rows={2} />
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button className="btn-primary">إرسال</button>
              <button type="button" onClick={() => setRespond(null)} className="btn-secondary">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {results && (
        <div className="card-padded">
          <h2 className="h3 mb-3">نتائج: {results.survey.titleAr} ({results.results.total} إجابة)</h2>
          {results.results.enps !== null && (
            <div className="mb-3 p-4 rounded-lg bg-primary-50 text-center">
              <div className="muted">نتيجة eNPS</div>
              <div className="text-4xl font-bold text-primary-700">{results.results.enps}</div>
              <div className="text-xs text-ink-500 mt-1">
                مروّجون: {results.results.enpsBreakdown.promoters} — محايدون: {results.results.enpsBreakdown.passives} — منتقدون: {results.results.enpsBreakdown.detractors}
              </div>
            </div>
          )}
          <div className="space-y-2">
            {Object.entries(results.results.byQuestion).map(([qid, r]) => (
              <div key={qid} className="p-3 rounded-lg border border-ink-100">
                <div className="text-sm">{r.text}</div>
                {r.avg != null && <div className="text-xs text-ink-500 mt-1">المتوسط: {r.avg} ({r.count} إجابة)</div>}
              </div>
            ))}
          </div>
          <button onClick={() => setResults(null)} className="btn-secondary text-xs mt-3">إغلاق</button>
        </div>
      )}

      {canSeeResults && (
        <div className="card-padded">
          <h2 className="h3 mb-3">مقابلات البقاء ({stayInterviews.length})</h2>
          <div className="space-y-2">
            {stayInterviews.map((i) => (
              <div key={i.id} className="p-3 rounded-lg border border-ink-100 flex justify-between items-center">
                <div>
                  <div className="font-medium">{i.employee?.fullNameAr}</div>
                  <div className="text-xs text-ink-500">رضا: {i.satisfaction ?? '—'}/10 — {new Date(i.conductedAt).toLocaleDateString('ar-SA')}</div>
                </div>
                <span className={i.status === 'follow_up' ? 'badge-warn' : 'badge-success'}>{i.status === 'follow_up' ? 'متابعة' : 'مكتملة'}</span>
              </div>
            ))}
            {!stayInterviews.length && <div className="text-ink-400 text-sm">لا توجد مقابلات</div>}
          </div>
        </div>
      )}
    </div>
  );
}
