import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import client, { errMsg } from '../api/client';
import { setLang, getLang, t } from '../i18n';

// الدخول السريع التجريبي: يظهر فقط عند VITE_DEMO_MODE=true (بيئات العرض التجريبي)
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

const QUICK_ACCOUNTS = [
  { username: 'admin',      label: 'مسؤول النظام' },
  { username: 'executive',  label: 'المدير التنفيذي' },
  { username: 'hrdir',      label: 'مدير الموارد البشرية' },
  { username: 'finance',    label: 'المدير المالي' },
  { username: 'hrmgr',      label: 'أخصائي HR' },
  { username: 'manager',    label: 'مدير مباشر' },
  { username: 'recruiter',  label: 'مسؤول التوظيف' },
  { username: 'payroll',    label: 'محاسب الرواتب' },
  { username: 'lnd',        label: 'مسؤول التعلم' },
  { username: 'keeper',     label: 'أمين المعرفة' },
  { username: 'employee',   label: 'موظف' },
  { username: 'auditor',    label: 'مراقب داخلي' },
  { username: 'security',   label: 'مسؤول الأمن' },
  { username: 'analyst',    label: 'محلل بيانات' },
  { username: 'compliance', label: 'مسؤول امتثال' },
];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [userList, setUserList] = useState([]);
  const [ddOpen, setDdOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const userWrapRef = useRef(null);
  const pwdRef = useRef(null);

  useEffect(() => {
    let alive = true;
    client.get('/auth/usernames')
      .then((r) => { if (alive) setUserList(Array.isArray(r.data?.users) ? r.data.users : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onDocClick(e) {
      if (userWrapRef.current && !userWrapRef.current.contains(e.target)) setDdOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filteredUsers = useMemo(() => {
    const q = username.trim().toLowerCase();
    if (!q) return userList;
    return userList.filter((u) =>
      u.username?.toLowerCase().includes(q) ||
      u.fullNameAr?.toLowerCase().includes(q)
    );
  }, [userList, username]);

  function pickUser(u) {
    setUsername(u.username);
    setDdOpen(false);
    setHi(-1);
    if (pwdRef.current) pwdRef.current.focus();
  }

  function onUsernameKeyDown(e) {
    if (!ddOpen || filteredUsers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => (h + 1) % filteredUsers.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => (h <= 0 ? filteredUsers.length - 1 : h - 1));
    } else if (e.key === 'Enter' && hi >= 0 && hi < filteredUsers.length) {
      e.preventDefault();
      pickUser(filteredUsers[hi]);
    } else if (e.key === 'Escape') {
      setDdOpen(false);
      setHi(-1);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!username.trim() || !password) return toast.error('أدخل اسم المستخدم وكلمة المرور');
    setSubmitting('__form__');
    try {
      const u = await login(username.trim(), password);
      toast.success('مرحباً ' + (u.fullNameAr || u.username));
      nav(u?.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      toast.error(errMsg(err));
      setSubmitting(null);
    }
  }

  async function pickAccount(accUsername) {
    if (submitting) return;
    setSubmitting(accUsername);
    try {
      const u = await login(accUsername, 'Admin@12345');
      toast.success('مرحباً ' + (u.fullNameAr || u.username));
      nav('/');
    } catch (err) {
      toast.error(errMsg(err));
      setSubmitting(null);
    }
  }

  function toggleLang() {
    const nl = lang === 'ar' ? 'en' : 'ar';
    setLang(nl);
    setLangState(nl);
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-600 text-white items-center justify-center text-2xl font-bold mb-3">ناضج</div>
          <h1 className="h1">{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
          <p className="text-xs text-ink-400 mt-1">{t('app.copyright')}</p>
        </div>
        <div className="card-padded shadow-pop">
          <div className="flex justify-between items-center mb-4">
            <h2 className="h3">تسجيل الدخول</h2>
            <button onClick={toggleLang} className="text-xs text-primary-600 hover:underline">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div ref={userWrapRef} className="relative">
              <label htmlFor="login-username" className="block text-sm font-medium mb-1">اسم المستخدم</label>
              <input
                id="login-username"
                type="text"
                autoComplete="username"
                dir="ltr"
                className="input w-full"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setDdOpen(true); setHi(-1); }}
                onMouseDown={() => setDdOpen(true)}
                onFocus={() => setDdOpen(true)}
                onKeyDown={onUsernameKeyDown}
                disabled={!!submitting}
                role="combobox"
                aria-expanded={ddOpen}
                aria-controls="login-userlist"
                aria-autocomplete="list"
                autoFocus
              />
              {ddOpen && filteredUsers.length > 0 && (
                <ul
                  id="login-userlist"
                  role="listbox"
                  className="absolute z-40 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-ink-200 bg-white shadow-pop py-1"
                >
                  {filteredUsers.map((u, i) => (
                    <li key={u.username} role="option" aria-selected={i === hi}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); pickUser(u); }}
                        onMouseEnter={() => setHi(i)}
                        className={`w-full text-right px-3 py-2 transition ${i === hi ? 'bg-primary-50' : 'bg-white hover:bg-primary-50'}`}
                        disabled={!!submitting}
                      >
                        <div className="w-full flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-ink-900">{u.fullNameAr || u.username}</span>
                          <span className="text-[11px] font-mono text-ink-500" dir="ltr">{u.username}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium mb-1">كلمة المرور</label>
              <div className="relative">
                <input
                  ref={pwdRef}
                  id="login-password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  dir="ltr"
                  className="input w-full pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!!submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-ink-500 hover:text-primary-600"
                  tabIndex={-1}
                  aria-label={showPwd ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >{showPwd ? 'إخفاء' : 'إظهار'}</button>
              </div>
            </div>
            <button type="submit" className="btn-primary mx-auto block min-w-[12rem]" disabled={!!submitting}>
              {submitting === '__form__' ? 'جاري الدخول...' : 'دخول'}
            </button>
          </form>

          {DEMO_MODE && (
            <div className="mt-5 pt-4 border-t border-ink-100">
              <p className="text-xs text-ink-500 mb-2">دخول سريع تجريبي (بيئة العرض فقط):</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {QUICK_ACCOUNTS.map((acc) => {
                  const busy = submitting === acc.username;
                  return (
                    <button
                      key={acc.username}
                      onClick={() => pickAccount(acc.username)}
                      disabled={!!submitting}
                      className="rounded-xl border p-2 text-right transition shadow-sm border-ink-200 bg-white hover:border-primary-400 hover:bg-primary-50"
                    >
                      <div className="font-medium text-ink-900 text-xs">{acc.label}</div>
                      <div className="text-[10px] text-ink-500 font-mono" dir="ltr">{acc.username}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
