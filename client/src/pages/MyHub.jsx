import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const STATUS_AR = {
  pending: 'بانتظار المدير', manager_approved: 'بانتظار HR', approved: 'معتمدة', rejected: 'مرفوضة',
  cancelled: 'ملغاة', submitted: 'مقدم', in_approval: 'قيد الاعتماد', done: 'منفذ', active: 'نشط',
  enrolled: 'مسجل', completed: 'مكتمل', present: 'حاضر', absent: 'غائب',
};

export default function MyHub() {
  const { user } = useAuth();
  const toast = useToast();
  const [payslips, setPayslips] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [reqTypes, setReqTypes] = useState([]);
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
  const [reqForm, setReqForm] = useState({ typeId: '', details: '' });
  const [workWindow, setWorkWindow] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());

  // عداد حي — تكة كل ثانية فقط أثناء وجود حضور بلا انصراف
  const ticking = !!todayRecord?.checkIn && !todayRecord?.checkOut;
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking]);

  function load() {
    client.get('/payroll/payslips/me').then(({ data }) => setPayslips(data.payslips)).catch(() => {});
    client.get('/leaves/balances/me').then(({ data }) => setBalances(data.balances || [])).catch(() => {});
    client.get('/leaves/requests').then(({ data }) => setRequests(data.requests.slice(0, 10))).catch(() => {});
    client.get('/lnd/enrollments/me').then(({ data }) => setEnrollments(data.enrollments)).catch(() => {});
    client.get('/insurance/me').then(({ data }) => setInsurance(data.memberships)).catch(() => {});
    client.get('/leaves/types').then(({ data }) => setLeaveTypes(data.types)).catch(() => {});
    client.get('/requests/types').then(({ data }) => setReqTypes(data.types)).catch(() => {});
    const today = new Date().toISOString().slice(0, 10);
    client.get('/attendance/records', { params: { from: today, to: today } })
      .then(({ data }) => setTodayRecord(data.records[0] || null)).catch(() => {});
    client.get('/attendance/work-window').then(({ data }) => setWorkWindow(data)).catch(() => {});
  }
  useEffect(load, []);

  function checkIn() {
    client.post('/attendance/check-in', { method: 'gps' })
      .then(({ data }) => {
        const late = data.lateMins ? ` — تأخير ${data.lateMins} دقيقة` : '';
        const ded = data.lateDeduction > 0 ? ` — قيمة الخصم ${data.lateDeduction} ر.س` : '';
        toast.success(`تم تسجيل الحضور${late}${ded}`);
        if (data.shift?.source) toast.info(`الوردية الفعّالة: ${data.shift.nameAr}`);
        (data.warnings || []).forEach((w) => toast.warn(w));
        load();
      })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }
  function checkOut() {
    client.post('/attendance/check-out')
      .then(({ data }) => {
        const early = data.earlyMins > 0 ? ` — انصراف مبكر ${data.earlyMins} دقيقة` : '';
        toast.success(`تم تسجيل الانصراف — ${data.workedHours} ساعة${early}`);
        (data.warnings || []).forEach((w) => toast.warn(w));
        load();
      })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }
  function submitLeave(e) {
    e.preventDefault();
    client.post('/leaves/requests', { ...leaveForm, leaveTypeId: Number(leaveForm.leaveTypeId) })
      .then(() => { toast.success('تم تقديم طلب الإجازة'); setLeaveForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function submitRequest(e) {
    e.preventDefault();
    client.post('/requests', { typeId: Number(reqForm.typeId), payload: { details: reqForm.details } })
      .then(() => { toast.success('تم تقديم الطلب'); setReqForm({ typeId: '', details: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  const latest = payslips[0];
  const fmtH = (h) => `${String(h).padStart(2, '0')}:00`;
  const elapsedMs = todayRecord?.checkIn && !todayRecord?.checkOut
    ? Math.max(0, nowTick - new Date(todayRecord.checkIn).getTime()) : null;
  const fmtDur = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  return (
    <div className="page space-y-4">
      <h1 className="h1">بوابتي — {user?.fullNameAr}</h1>

      {/* حضور اليوم + الراتب */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card-padded">
          <div className="muted mb-2">حضور اليوم</div>
          {workWindow && (
            <div className="text-xs text-ink-500 mb-2">
              {workWindow.shift ? (
                <>
                  الوردية: <b className="font-mono">{workWindow.shift.code}</b> — {workWindow.shift.nameAr}
                  {' '}(من {fmtH(Math.floor(workWindow.shift.startMin / 60))} إلى {fmtH(Math.floor(workWindow.shift.endMin / 60) % 24)}
                  {workWindow.shift.graceInMins > 0 ? `، سماحية ${workWindow.shift.graceInMins}د` : ''})
                </>
              ) : (
                <>الدوام: {fmtH(workWindow.startHour)} — {fmtH(workWindow.endHour)}
                {workWindow.lateGraceMins > 0 ? ` (سماحية ${workWindow.lateGraceMins} دقيقة)` : ''}</>
              )}
              {workWindow.shift && !workWindow.shift.isWorkDay && <div className="text-warn-600">اليوم راحة حسب الوردية</div>}
            </div>
          )}
          {todayRecord ? (
            <div className="space-y-1 text-sm">
              <div>الحضور: {todayRecord.checkIn ? new Date(todayRecord.checkIn).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
              {elapsedMs != null ? (
                <div className="text-lg font-bold text-primary-700 font-mono" data-testid="live-counter">
                  {fmtDur(elapsedMs)}
                </div>
              ) : (
                <div>الانصراف: {todayRecord.checkOut ? new Date(todayRecord.checkOut).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
              )}
              {todayRecord.checkOut && <div className="text-success-700">ساعات العمل: {todayRecord.workedHours}</div>}
              {todayRecord.lateMins > 0 && (
                <div className="text-warn-600">
                  تأخير: {todayRecord.lateMins} دقيقة
                  {workWindow?.todayLate ? ` — قيمة الخصم ${workWindow.todayLate.deduction} ر.س` : ''}
                </div>
              )}
            </div>
          ) : <div className="text-sm text-ink-500 mb-2">لم تسجل حضورك اليوم</div>}
          <div className="flex gap-2 mt-3">
            {!todayRecord?.checkIn && <button onClick={checkIn} className="btn-primary text-xs">تسجيل حضور</button>}
            {todayRecord?.checkIn && !todayRecord?.checkOut && <button onClick={checkOut} className="btn-secondary text-xs">تسجيل انصراف</button>}
          </div>
        </div>

        <div className="card-padded">
          <div className="muted mb-2">آخر قسيمة راتب</div>
          {latest ? (
            <div className="space-y-1 text-sm">
              <div>الفترة: {latest.run?.month}/{latest.run?.year}</div>
              <div>الإجمالي: {Number(latest.gross).toLocaleString('ar-SA')} ر.س</div>
              {Number(latest.gosiEmployee) > 0 && <div className="text-ink-500">التأمينات (حصتي): {Number(latest.gosiEmployee).toLocaleString('ar-SA')} ر.س</div>}
              {Number(latest.loanDeduct) > 0 && <div className="text-ink-500">قسط السلف: {Number(latest.loanDeduct).toLocaleString('ar-SA')} ر.س</div>}
              {Number(latest.absenceDeduct) > 0 && <div className="text-ink-500">خصم الغياب: {Number(latest.absenceDeduct).toLocaleString('ar-SA')} ر.س</div>}
              {Number(latest.lateDeduct) > 0 && <div className="text-ink-500">خصم التأخر: {Number(latest.lateDeduct).toLocaleString('ar-SA')} ر.س</div>}
              <div className="text-lg font-bold text-primary-700">الصافي: {Number(latest.net).toLocaleString('ar-SA')} ر.س</div>
            </div>
          ) : <div className="text-sm text-ink-500">لا توجد قسائم بعد</div>}
        </div>

        <div className="card-padded">
          <div className="muted mb-2">تأميني الصحي</div>
          {insurance.length ? insurance.map((m) => (
            <div key={m.id} className="text-sm space-y-1">
              <div>{m.policy?.provider}</div>
              <div className="text-ink-500">{m.policy?.planName} — بطاقة {m.cardNumber || '—'}</div>
            </div>
          )) : <div className="text-sm text-ink-500">غير مسجل في وثيقة تأمين</div>}
        </div>
      </div>

      {/* أرصدة الإجازات */}
      <div className="card-padded">
        <h2 className="h3 mb-3">أرصدة إجازاتي</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map((b) => (
            <div key={b.id} className="p-3 rounded-lg border border-ink-100 text-center">
              <div className="text-sm text-ink-600">{b.leaveType?.nameAr}</div>
              <div className="text-2xl font-bold text-primary-700 mt-1">{(b.entitled + b.carried - b.used).toFixed(1)}</div>
              <div className="text-xs text-ink-400">من {b.entitled} يوم</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* طلب إجازة */}
        <div className="card-padded">
          <h2 className="h3 mb-3">طلب إجازة جديد</h2>
          <form onSubmit={submitLeave} className="space-y-2">
            <select value={leaveForm.leaveTypeId} onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })} required className="input w-full">
              <option value="">نوع الإجازة…</option>
              {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required className="input" />
              <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required className="input" />
            </div>
            <input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="السبب (اختياري)" className="input w-full" />
            <button className="btn-primary w-full">تقديم الطلب</button>
          </form>
        </div>

        {/* طلب عام */}
        <div className="card-padded">
          <h2 className="h3 mb-3">طلب خدمة (مركز الطلبات)</h2>
          <form onSubmit={submitRequest} className="space-y-2">
            <select value={reqForm.typeId} onChange={(e) => setReqForm({ ...reqForm, typeId: e.target.value })} required className="input w-full">
              <option value="">نوع الطلب…</option>
              {reqTypes.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
            </select>
            <textarea value={reqForm.details} onChange={(e) => setReqForm({ ...reqForm, details: e.target.value })} required placeholder="التفاصيل" className="input w-full" rows={3} />
            <button className="btn-primary w-full">إرسال</button>
          </form>
        </div>
      </div>

      {/* طلباتي */}
      <div className="card-padded">
        <h2 className="h3 mb-3">طلبات إجازاتي الأخيرة</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>الحالة</th></tr></thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.leaveType?.nameAr}</td>
                  <td>{fmtDate(r.startDate)}</td>
                  <td>{fmtDate(r.endDate)}</td>
                  <td>{r.days}</td>
                  <td><span className={r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warn'}>{STATUS_AR[r.status] || r.status}</span></td>
                </tr>
              ))}
              {!requests.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* دوراتي */}
      <div className="card-padded">
        <h2 className="h3 mb-3">دوراتي التدريبية</h2>
        <div className="space-y-2">
          {enrollments.map((en) => (
            <div key={en.id} className="flex items-center justify-between p-3 rounded-lg border border-ink-100">
              <div>
                <div className="font-medium">{en.session?.course?.titleAr}</div>
                <div className="text-xs text-ink-500">{fmtDate(en.session?.startDate)} — {en.session?.location === 'online' ? 'عن بعد' : 'حضوري'}</div>
              </div>
              <span className={en.status === 'completed' ? 'badge-success' : 'badge-primary'}>{STATUS_AR[en.status] || en.status}</span>
            </div>
          ))}
          {!enrollments.length && <div className="text-ink-400 text-sm">لا توجد تسجيلات</div>}
        </div>
      </div>
    </div>
  );
}
