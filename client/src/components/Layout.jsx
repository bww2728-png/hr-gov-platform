import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setLang, getLang } from '../i18n';

const NAV_SECTIONS = [
  {
    section: 'الرئيسية',
    items: [
      { to: '/', label: 'لوحة القيادة', icon: '📊', perm: 'analytics.read' },
      { to: '/my-hub', label: 'بوابتي', icon: '🏠', perm: 'self.profile.read' },
    ],
  },
  {
    section: 'الموظفون والهيكل',
    items: [
      { to: '/employees', label: 'الموظفون', icon: '👥', perm: 'hr.employee.read' },
      { to: '/employees/new', label: 'إضافة موظف', icon: '➕', perm: 'hr.employee.write' },
      { to: '/org-chart', label: 'الهيكل التنظيمي', icon: '🏛', perm: 'hr.org.read' },
    ],
  },
  {
    section: 'الاستقطاب',
    items: [
      { to: '/recruitment', label: 'الوظائف', icon: '🎯', perm: 'lifecycle.posting.read' },
      { to: '/candidates', label: 'المرشحون', icon: '📋', perm: 'lifecycle.candidate.read' },
    ],
  },
  {
    section: 'الخدمة الذاتية والطلبات',
    items: [
      { to: '/requests', label: 'مركز الطلبات', icon: '📨', perm: 'requests.create' },
      { to: '/leaves', label: 'الإجازات', icon: '🌴', perm: 'self.leave.read' },
      { to: '/attendance', label: 'الحضور', icon: '🕐', perm: 'self.attendance.read' },
      { to: '/payroll', label: 'الرواتب', icon: '💰', perm: 'payroll.read' },
    ],
  },
  {
    section: 'شؤون المقيمين',
    items: [
      { to: '/expat', label: 'الإقامات والتأشيرات', icon: '🛂', perm: 'expat.iqama.read' },
      { to: '/insurance', label: 'التأمين الصحي', icon: '🏥', perm: 'insurance.read' },
    ],
  },
  {
    section: 'الأداء والتطوير',
    items: [
      { to: '/performance', label: 'الأداء', icon: '🎯', perm: 'self.profile.read' },
      { to: '/learning', label: 'التعلم والتطوير', icon: '🎓', perm: 'lnd.catalog.read' },
      { to: '/talent', label: 'المواهب والتعاقب', icon: '⭐', perm: 'succession.read' },
      { to: '/retention', label: 'الاحتفاظ', icon: '💎', perm: 'surveys.respond' },
    ],
  },
  {
    section: 'العلاقات العمالية',
    items: [
      { to: '/relations', label: 'تأديب وتظلمات', icon: '⚖', perm: 'grievances.create' },
    ],
  },
  {
    section: 'المعرفة',
    items: [
      { to: '/knowledge', label: 'الوثائق', icon: '📚', perm: 'knowledge.doc.read' },
      { to: '/flowcharts', label: 'مرجع المعاملات', icon: '🗺', perm: 'knowledge.doc.read' },
      { to: '/decisions', label: 'سجل القرارات', icon: '⚖', perm: 'knowledge.decision.read' },
      { to: '/policies', label: 'السياسات', icon: '📜', perm: 'knowledge.policy.read' },
    ],
  },
  {
    section: 'الحوكمة والامتثال',
    items: [
      { to: '/workflows', label: 'سير العمل', icon: '🔄', perm: 'workflow.instance.read' },
      { to: '/compliance', label: 'الامتثال العام', icon: '🛡', perm: 'compliance.rule.read' },
      { to: '/compliance-sa', label: 'الامتثال السعودي', icon: '🇸🇦', perm: 'nitaqat.read' },
      { to: '/maturity', label: 'قياس النضج', icon: '📈', perm: 'maturity.read' },
      { to: '/roadmap', label: 'خارطة الطريق', icon: '🗺', perm: 'roadmap.read' },
      { to: '/risks', label: 'المخاطر', icon: '⚠', perm: 'risk.read' },
      { to: '/fivewhys', label: '5 Whys', icon: '🔍', perm: 'fivewhys.read' },
    ],
  },
  {
    section: 'التحليلات',
    items: [
      { to: '/analytics', label: 'التحليلات', icon: '📊', perm: 'analytics.read' },
    ],
  },
  {
    section: 'إدارة النظام',
    items: [
      { to: '/users', label: 'المستخدمون', icon: '🔐', perm: 'admin.user.read' },
      { to: '/roles', label: 'الأدوار والصلاحيات', icon: '🗝', perm: 'admin.role.read' },
      { to: '/security', label: 'الأمن والجلسات', icon: '🛡', perm: 'security.events.read' },
      { to: '/integrations', label: 'التكاملات', icon: '🔌', perm: 'admin.integration.read' },
      { to: '/audit', label: 'سجل التدقيق', icon: '📜', perm: 'admin.audit.read' },
      { to: '/settings', label: 'الإعدادات', icon: '⚙', perm: 'self.profile.read' },
    ],
  },
];

export default function Layout({ children }) {
  const { user, logout, has } = useAuth();
  const nav = useNavigate();
  const [lang, setLangState] = useState(getLang());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const h = () => setLangState(getLang());
    window.addEventListener('hr:lang', h);
    return () => window.removeEventListener('hr:lang', h);
  }, []);

  function changeLang(newLang) {
    setLang(newLang);
    setLangState(newLang);
  }

  async function doLogout() {
    await logout();
    nav('/login');
  }

  const sections = NAV_SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((i) => has(i.perm)) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="h-full flex bg-ink-50">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} shrink-0 bg-white border-e border-ink-100 transition-all flex flex-col`}>
        <div className="p-4 border-b border-ink-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">ح</div>
          {sidebarOpen && (
            <div className="leading-tight">
              <div className="font-bold text-ink-900">حوكمة HR</div>
              <div className="text-xs text-ink-500">منصة مؤسسية</div>
            </div>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sections.map((sec) => (
            <div key={sec.section} className="mb-2">
              {sidebarOpen && <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-ink-400 uppercase">{sec.section}</div>}
              {sec.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-ink-700 hover:bg-ink-50'}`
                  }
                >
                  <span className="text-base">{it.icon}</span>
                  {sidebarOpen && <span>{it.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button
          onClick={() => setSidebarOpen((s) => !s)}
          className="m-2 p-2 text-ink-500 hover:bg-ink-50 rounded-lg text-sm"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-ink-100 px-4 flex items-center justify-between shrink-0">
          <div className="font-semibold text-ink-700">
            {lang === 'ar' ? 'منصة حوكمة الموارد البشرية والتحول المؤسسي' : 'HR Governance Platform'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeLang(lang === 'ar' ? 'en' : 'ar')}
              className="btn-secondary text-xs px-2.5 py-1.5"
            >
              {lang === 'ar' ? 'EN' : 'ع'}
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm">
                  {(user?.fullNameAr || '?')[0]}
                </div>
                <div className="text-start hidden sm:block">
                  <div className="text-sm font-medium text-ink-900 leading-tight">{user?.fullNameAr}</div>
                  <div className="text-xs text-ink-500">{user?.role?.nameAr}</div>
                </div>
              </button>
              {userMenuOpen && (
                <div className="absolute end-0 mt-1 w-56 bg-white border border-ink-300 rounded-lg shadow-pop z-30 py-1 animate-fade-in">
                  <Link to="/profile" className="block px-3 py-2 hover:bg-ink-50 text-sm" onClick={() => setUserMenuOpen(false)}>
                    ملفي الشخصي
                  </Link>
                  <Link to="/change-password" className="block px-3 py-2 hover:bg-ink-50 text-sm" onClick={() => setUserMenuOpen(false)}>
                    تغيير كلمة المرور
                  </Link>
                  <div className="border-t border-ink-100 my-1" />
                  <button onClick={doLogout} className="w-full text-start px-3 py-2 hover:bg-ink-50 text-sm text-danger-600">
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}