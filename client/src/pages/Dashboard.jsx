import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmtDate } from '../utils/datetime';

export default function Dashboard() {
  const { user, has } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!has('analytics.dashboard.read')) {
      setLoading(false);
      setError(null);
      return () => { cancelled = true; };
    }
    client
      .get('/analytics/dashboard')
      .then(({ data }) => { if (!cancelled) { setStats(data); setError(null); } })
      .catch((err) => { if (!cancelled) setError(errMsg(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [has]);

  const cards = stats && [
    { label: 'إجمالي الموظفين', value: stats.totalEmployees, color: 'bg-primary-50 text-primary-700', to: '/employees' },
    { label: 'الموظفون النشطون', value: stats.activeEmployees, color: 'bg-green-50 text-success-600', to: '/employees' },
    { label: 'في فترة الإنذار', value: stats.noticeEmployees, color: 'bg-amber-50 text-warn-600', to: '/employees' },
    { label: 'وظائف مفتوحة', value: stats.openPostings, color: 'bg-blue-50 text-blue-700', to: '/recruitment' },
    { label: 'طلبات توظيف معلقة', value: stats.pendingApps, color: 'bg-violet-50 text-violet-700', to: '/candidates' },
    { label: 'مخالفات حرجة', value: stats.criticalViolations, color: 'bg-red-50 text-danger-600', to: '/compliance' },
    { label: 'مخاطر عالية', value: stats.openHighRisks, color: 'bg-orange-50 text-orange-700', to: '/risks' },
    { label: 'متوسط النضج', value: `${(stats.maturityAvg || 0).toFixed(2)} / 5`, color: 'bg-teal-50 text-teal-700', to: '/maturity' },
    { label: 'تقدم الخارطة', value: stats.roadmapProgress ? `${stats.roadmapProgress.done}/${stats.roadmapProgress.total}` : '0/52', color: 'bg-indigo-50 text-indigo-700', to: '/roadmap' },
  ];

  return (
    <div className="page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">أهلاً، {user?.fullNameAr} 👋</h1>
          <p className="muted">لوحة القيادة التنفيذية - {fmtDate(new Date())}</p>
        </div>
        <span className="badge-primary text-base px-3 py-1">{user?.role?.nameAr}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="card-padded animate-pulse">
              <div className="h-3 bg-ink-100 rounded w-1/2 mb-3" />
              <div className="h-8 bg-ink-100 rounded w-3/4" />
            </div>
          ))
        ) : (
          cards.map((c, i) => (
            <Link key={i} to={c.to} className="grid-card flex flex-col">
              <div className={`inline-flex self-start px-2.5 py-1 rounded-md text-xs font-medium ${c.color}`}>{c.label}</div>
              <div className="text-3xl font-bold mt-3 text-ink-900">{c.value}</div>
            </Link>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-padded">
          <h3 className="h3 mb-3">وصول سريع</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { to: '/employees', label: 'الموظفون', icon: '👥' },
              { to: '/recruitment', label: 'الاستقطاب', icon: '🎯' },
              { to: '/maturity', label: 'النضج', icon: '📈' },
              { to: '/risks', label: 'المخاطر', icon: '⚠' },
              { to: '/compliance', label: 'الامتثال', icon: '🛡' },
              { to: '/workflows', label: 'سير العمل', icon: '🔄' },
            ].map((q) => (
              <Link key={q.to} to={q.to} className="flex items-center gap-2 p-3 rounded-lg border border-ink-100 hover:bg-ink-50">
                <span className="text-xl">{q.icon}</span>
                <span className="text-sm font-medium">{q.label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="card-padded">
          <h3 className="h3 mb-3">مبادئ المنصة</h3>
          <ul className="space-y-2 text-sm text-ink-700">
            <li className="flex gap-2"><span>✅</span><span>8 محركات مستقلة قابلة للتطوير والاستبدال</span></li>
            <li className="flex gap-2"><span>✅</span><span>42 بعد نضج عبر 7 محاور</span></li>
            <li className="flex gap-2"><span>✅</span><span>52 أسبوع خارطة طريق قابلة للقياس</span></li>
            <li className="flex gap-2"><span>✅</span><span>سجل قرارات بـ hash chain غير قابل للتعديل</span></li>
            <li className="flex gap-2"><span>✅</span><span>RBAC كامل + سجل تدقيق لكل عملية</span></li>
            <li className="flex gap-2"><span>✅</span><span>إدخال ذكي: قوائم + تواريخ هجرية + مدد</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}