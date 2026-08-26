import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../api/client';
import { setLang, getLang } from '../i18n';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lang, setLangState] = useState(getLang());

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const u = await login(username, password);
      toast.success('مرحباً ' + (u.fullNameAr || u.username));
      nav(u.mustChangePassword ? '/change-password' : '/');
    } catch (err) {
      toast.error(errMsg(err));
    } finally { setSubmitting(false); }
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
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-600 text-white items-center justify-center text-3xl font-bold mb-3">ح</div>
          <h1 className="h1">منصة حوكمة الموارد البشرية</h1>
          <p className="muted">نظام حوكمة وتحول مؤسسي متكامل</p>
        </div>
        <div className="card-padded shadow-pop">
          <div className="flex justify-between items-center mb-4">
            <h2 className="h3">تسجيل الدخول</h2>
            <button onClick={toggleLang} className="text-xs text-primary-600 hover:underline">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">اسم المستخدم</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input" required autoFocus />
            </div>
            <div>
              <label className="label">كلمة المرور</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" required />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
              {submitting ? 'جاري...' : 'دخول'}
            </button>
          </form>
          <div className="mt-4 pt-4 border-t border-ink-100 text-xs text-ink-500">
            <div className="font-medium text-ink-700 mb-1">حسابات تجريبية:</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span>admin</span><span>مدير النظام</span>
              <span>executive</span><span>تنفيذي</span>
              <span>hrmgr</span><span>مدير HR</span>
              <span>recruiter</span><span>مسؤول توظيف</span>
              <span>manager</span><span>مدير مباشر</span>
              <span>keeper</span><span>أمين معرفة</span>
              <span>employee</span><span>موظف</span>
              <span>auditor</span><span>مراقب</span>
            </div>
            <div className="mt-2">كلمة المرور: <span className="font-mono">Admin@12345</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}