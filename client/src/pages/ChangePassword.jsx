import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../api/client';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (next !== confirm) { toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقتين'); return; }
    if (next.length < 8) { toast.error('يجب أن تكون 8 أحرف على الأقل'); return; }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      toast.success('تم تغيير كلمة المرور');
      nav('/');
    } catch (err) { toast.error(errMsg(err)); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="h-full flex items-center justify-center bg-ink-50 p-4">
      <div className="card-padded w-full max-w-md shadow-pop">
        <h1 className="h2 mb-1">تغيير كلمة المرور</h1>
        <p className="muted mb-4">يُطلب منك تغيير كلمة المرور لمتابعة الاستخدام.</p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="label">كلمة المرور الحالية</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="label">كلمة المرور الجديدة (8 أحرف على الأقل)</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className="input" required minLength={8} />
          </div>
          <div>
            <label className="label">تأكيد كلمة المرور</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" required />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center">
            {submitting ? 'جاري...' : 'حفظ ومتابعة'}
          </button>
        </form>
      </div>
    </div>
  );
}