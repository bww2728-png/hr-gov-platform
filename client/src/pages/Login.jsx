import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../api/client';
import { setLang, getLang, t } from '../i18n';

const QUICK_ACCOUNTS = [
  { username: 'admin',      label: 'مسؤول النظام' },
  { username: 'executive',  label: 'المدير التنفيذي' },
  { username: 'hrdir',      label: 'مدير الموارد البشرية' },
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

  async function pickAccount(username) {
    if (submitting) return;
    setSubmitting(username);
    try {
      const u = await login(username, 'Admin@12345');
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
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-600 text-white items-center justify-center text-2xl font-bold mb-3">ناضج</div>
          <h1 className="h1">{t('app.title')}</h1>
          <p className="muted">{t('app.subtitle')}</p>
          <p className="text-xs text-ink-400 mt-1">{t('app.copyright')}</p>
        </div>
        <div className="card-padded shadow-pop">
          <div className="flex justify-between items-center mb-4">
            <h2 className="h3">اختر الحساب للدخول</h2>
            <button onClick={toggleLang} className="text-xs text-primary-600 hover:underline">
              {lang === 'ar' ? 'English' : 'العربية'}
            </button>
          </div>
          <p className="text-sm text-ink-500 mb-4">
            اضغط على الحساب المناسب لدخوله مباشرة. هذا الإعداد مخصص للبيئة التجريبية فقط — في الإنتاج يجب استخدام نافذة اسم المستخدم وكلمة المرور.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_ACCOUNTS.map((acc) => {
              const busy = submitting === acc.username;
              const disabled = !!submitting && !busy;
              return (
                <button
                  key={acc.username}
                  onClick={() => pickAccount(acc.username)}
                  disabled={!!submitting}
                  className={
                    'rounded-xl border p-3 text-right transition shadow-sm ' +
                    (busy
                      ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-300'
                      : 'border-ink-200 bg-white hover:border-primary-400 hover:bg-primary-50') +
                    (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')
                  }
                  aria-busy={busy || undefined}
                >
                  <div className="font-medium text-ink-900 text-sm">{acc.label}</div>
                  <div className="text-xs text-ink-500 mt-1 font-mono" dir="ltr">{acc.username}</div>
                  {busy && <div className="text-xs text-primary-700 mt-2">جاري الدخول...</div>}
                </button>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-ink-100 text-xs text-ink-500 text-center">
            بيئة الناضج التجريبية — اضغط أي حساب للدخول مباشرة دون كلمة مرور.
          </div>
        </div>
      </div>
    </div>
  );
}
