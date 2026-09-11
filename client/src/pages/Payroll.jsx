import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const RUN_STATUS = { draft: 'مسودة', calculated: 'محسوب', reviewed: 'تمت المراجعة', approved: 'معتمد', paid: 'مصروف', archived: 'مؤرشف' };
const money = (n) => `${Number(n || 0).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س`;

export default function Payroll() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [runs, setRuns] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loans, setLoans] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [eosList, setEosList] = useState([]);
  const [wpsFiles, setWpsFiles] = useState([]);
  const [tab, setTab] = useState('runs');
  const [newRun, setNewRun] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [eosForm, setEosForm] = useState({ employeeId: '', reason: 'resignation' });
  const [eosResult, setEosResult] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [wpsRows, setWpsRows] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [adjForm, setAdjForm] = useState({ payrollRunId: '', reason: '', items: [{ employeeId: '', kind: 'reversal_loan', amount: '', note: '' }] });

  const canPrepare = hasAny('payroll.prepare');
  const canReview = hasAny('payroll.review');
  const canApprove = hasAny('payroll.approve');

  function load() {
    client.get('/payroll/runs').then(({ data }) => setRuns(data.runs)).catch(() => {});
    client.get('/payroll/loans').then(({ data }) => setLoans(data.loans)).catch(() => {});
    client.get('/payroll/bonuses').then(({ data }) => setBonuses(data.bonuses)).catch(() => {});
    client.get('/payroll/eos').then(({ data }) => setEosList(data.calculations)).catch(() => {});
    client.get('/payroll/wps').then(({ data }) => setWpsFiles(data.files)).catch(() => {});
    client.get('/hr/employees').then(({ data }) => setEmployees(data.employees || [])).catch(() => {});
    client.get('/payroll/wps/dashboard').then(({ data }) => setWpsRows(data.rows)).catch(() => {});
    client.get('/payroll/adjustments').then(({ data }) => setAdjustments(data.adjustments)).catch(() => {});
  }
  useEffect(load, []);

  function createRun(e) {
    e.preventDefault();
    client.post('/payroll/runs', newRun)
      .then(() => { toast.success('تم إنشاء المسير'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function runAction(id, action, label) {
    client.post(`/payroll/runs/${id}/${action}`)
      .then(() => { toast.success(label); load(); openRun({ id }); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function openRun(run) {
    client.get(`/payroll/runs/${run.id}/items`).then(({ data }) => {
      setItems(data.items);
      setSelectedRun(runs.find((r) => r.id === run.id) || run);
    });
  }
  function decideLoan(id, decision) {
    client.post(`/payroll/loans/${id}/decision`, { decision }).then(() => { toast.success('تم'); load(); });
  }
  function decideBonus(id, decision) {
    client.post(`/payroll/bonuses/${id}/decision`, { decision }).then(() => { toast.success('تم'); load(); });
  }
  function calcEos(e) {
    e.preventDefault();
    client.post('/payroll/eos/calculate', eosForm)
      .then(({ data }) => { setEosResult(data); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function genWps(month, year) {
    const run = month ? { month, year } : runs.find((r) => ['approved', 'paid'].includes(r.status));
    if (!run) return toast.error('لا يوجد مسير معتمد');
    client.post('/payroll/wps/generate', { month: run.month, year: run.year })
      .then(({ data }) => {
        toast.success(`تم توليد ملف SIF/WPS (${data.recordCount} سجل)`);
        // تنزيل الملف تلقائياً (CSV بترميز UTF-8 مع BOM من الخادم)
        const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = data.file?.fileRef || `SIF-${run.year}-${String(run.month).padStart(2, '0')}.csv`;
        a.click(); URL.revokeObjectURL(url);
        load();
      })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function wpsStatus(id, status) {
    client.post(`/payroll/wps/${id}/status`, { status }).then(() => { toast.success('تم تحديث الحالة'); load(); }).catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function submitAdjustment(e) {
    e.preventDefault();
    const payload = {
      payrollRunId: Number(adjForm.payrollRunId),
      reason: adjForm.reason,
      items: adjForm.items.filter((i) => i.employeeId && i.amount !== '').map((i) => ({ employeeId: i.employeeId, kind: i.kind, amount: Number(i.amount), note: i.note || undefined })),
    };
    client.post('/payroll/adjustments', payload)
      .then(() => { toast.success('تم إرسال الطلب — بانتظار الاعتماد المالي'); setAdjForm({ payrollRunId: '', reason: '', items: [{ employeeId: '', kind: 'reversal_loan', amount: '', note: '' }] }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function decideAdjustment(id, stage, decision) {
    client.post(`/payroll/adjustments/${id}/${stage}`, { decision })
      .then(() => { toast.success('تم'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  const tabs = [
    { id: 'runs', label: 'المسيرات' },
    { id: 'loans', label: `السلف (${loans.length})` },
    { id: 'bonuses', label: `المكافآت (${bonuses.length})` },
    { id: 'eos', label: 'نهاية الخدمة' },
    { id: 'wps', label: 'حماية الأجور WPS' },
    { id: 'adjustments', label: `تعديلات الفترات (${adjustments.length})` },
  ];

  return (
    <div className="page space-y-4">
      <h1 className="h1">الرواتب والمستحقات</h1>

      <div className="flex gap-2 border-b border-ink-100 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'runs' && (
        <>
          {canPrepare && (
            <form onSubmit={createRun} className="card-padded flex items-end gap-2 flex-wrap">
              <div><label className="muted block mb-1">الشهر</label>
                <input type="number" min={1} max={12} value={newRun.month} onChange={(e) => setNewRun({ ...newRun, month: Number(e.target.value) })} className="input w-24" /></div>
              <div><label className="muted block mb-1">السنة</label>
                <input type="number" value={newRun.year} onChange={(e) => setNewRun({ ...newRun, year: Number(e.target.value) })} className="input w-28" /></div>
              <button className="btn-primary">إنشاء مسير</button>
            </form>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {runs.map((r) => (
              <div key={r.id} className="card-padded space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold">{r.code}</span>
                  <span className={r.status === 'paid' ? 'badge-success' : r.status === 'approved' ? 'badge-primary' : 'badge-warn'}>{RUN_STATUS[r.status]}</span>
                </div>
                <div className="text-sm text-ink-600 space-y-1">
                  <div>إجمالي: {money(r.totalGross)} — صافي: {money(r.totalNet)}</div>
                  <div>GOSI منشأة: {money(r.totalGosi)}</div>
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => openRun(r)} className="btn-secondary text-xs">البنود</button>
                  {r.status === 'draft' && canPrepare && <button onClick={() => runAction(r.id, 'calculate', 'تم الحساب')} className="btn-primary text-xs">حساب</button>}
                  {r.status === 'calculated' && canReview && <button onClick={() => runAction(r.id, 'review', 'تمت المراجعة')} className="btn-primary text-xs">مراجعة</button>}
                  {r.status === 'reviewed' && canApprove && <button onClick={() => runAction(r.id, 'approve', 'تم الاعتماد')} className="btn-primary text-xs">اعتماد</button>}
                  {r.status === 'approved' && canApprove && <button onClick={() => runAction(r.id, 'pay', 'تم الصرف')} className="btn-primary text-xs">صرف</button>}
                </div>
              </div>
            ))}
          </div>

          {selectedRun && (
            <div className="card-padded">
              <h2 className="h3 mb-3">بنود المسير {selectedRun.code} ({items.length})</h2>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>الموظف</th><th>أساسي</th><th>سكن</th><th>إضافي</th><th>مكافآت</th><th>GOSI</th><th>سلف</th><th>غياب</th><th>تأخر</th><th>الصافي</th></tr></thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id}>
                        <td>{i.employee?.fullNameAr}</td>
                        <td>{money(i.baseSalary)}</td>
                        <td>{money(i.housing)}</td>
                        <td>{money(i.overtimePay)}</td>
                        <td>{money(i.bonusPay)}</td>
                        <td className="text-danger-600">-{money(i.gosiEmployee)}</td>
                        <td className="text-danger-600">-{money(i.loanDeduct)}</td>
                        <td className="text-danger-600">-{money(i.absenceDeduct)}</td>
                        <td className="text-danger-600">-{money(i.lateDeduct)}</td>
                        <td className="font-bold">{money(i.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'loans' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>الموظف</th><th>المبلغ</th><th>القسط</th><th>المتبقي</th><th>الحالة</th><th>إجراء</th></tr></thead>
              <tbody>
                {loans.map((l) => (
                  <tr key={l.id}>
                    <td>{l.employee?.fullNameAr}</td>
                    <td>{money(l.amount)}</td>
                    <td>{money(l.monthlyDeduct)}</td>
                    <td>{money(l.remaining)}</td>
                    <td><span className={l.status === 'active' ? 'badge-success' : l.status === 'pending' ? 'badge-warn' : 'badge-ink'}>{{ pending: 'معلقة', active: 'نشطة', settled: 'مسددة', rejected: 'مرفوضة' }[l.status]}</span></td>
                    <td>
                      {l.status === 'pending' && hasAny('loans.approve') && (
                        <div className="flex gap-1">
                          <button onClick={() => decideLoan(l.id, 'approve')} className="btn-primary text-xs">اعتماد</button>
                          <button onClick={() => decideLoan(l.id, 'reject')} className="btn-secondary text-xs">رفض</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!loans.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد سلف</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'bonuses' && (
        <div className="card-padded">
          <div className="table-wrap">
            <table>
              <thead><tr><th>الموظف</th><th>المبلغ</th><th>النوع</th><th>السبب</th><th>الحالة</th><th>إجراء</th></tr></thead>
              <tbody>
                {bonuses.map((b) => (
                  <tr key={b.id}>
                    <td>{b.employee?.fullNameAr}</td>
                    <td>{money(b.amount)}</td>
                    <td>{{ performance: 'أداء', annual: 'سنوية', exceptional: 'استثنائية', eid: 'عيد' }[b.type]}</td>
                    <td className="text-xs">{b.reason}</td>
                    <td><span className={b.status === 'paid' ? 'badge-success' : b.status === 'approved' ? 'badge-primary' : 'badge-warn'}>{{ pending: 'معلقة', approved: 'معتمدة', paid: 'مصروفة', rejected: 'مرفوضة' }[b.status]}</span></td>
                    <td>
                      {b.status === 'pending' && hasAny('bonus.approve') && (
                        <div className="flex gap-1">
                          <button onClick={() => decideBonus(b.id, 'approve')} className="btn-primary text-xs">اعتماد</button>
                          <button onClick={() => decideBonus(b.id, 'reject')} className="btn-secondary text-xs">رفض</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!bonuses.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد مكافآت</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'eos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {hasAny('eos.calculate') && (
            <div className="card-padded">
              <h2 className="h3 mb-3">حاسبة نهاية الخدمة (نظام العمل السعودي)</h2>
              <form onSubmit={calcEos} className="space-y-2">
                <select value={eosForm.employeeId} onChange={(e) => setEosForm({ ...eosForm, employeeId: e.target.value })} required className="input w-full">
                  <option value="">اختر الموظف…</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullNameAr}</option>)}
                </select>
                <select value={eosForm.reason} onChange={(e) => setEosForm({ ...eosForm, reason: e.target.value })} className="input w-full">
                  <option value="resignation">استقالة</option>
                  <option value="termination">إنهاء من صاحب العمل</option>
                  <option value="retirement">تقاعد</option>
                </select>
                <button className="btn-primary w-full">احسب</button>
              </form>
              {eosResult && (
                <div className="mt-3 p-3 rounded-lg bg-primary-50 space-y-1 text-sm">
                  <div>سنوات الخدمة: {eosResult.breakdown.years} سنة</div>
                  {eosResult.breakdown.segments.map((s, i) => <div key={i} className="text-ink-600">• {s.note}: {money(s.amount)}</div>)}
                  <div className="text-lg font-bold text-primary-700 pt-1 border-t border-primary-100">المكافأة: {money(eosResult.eos.eosAmount)}</div>
                </div>
              )}
            </div>
          )}
          <div className="card-padded">
            <h2 className="h3 mb-3">الحسابات السابقة ({eosList.length})</h2>
            <div className="space-y-2">
              {eosList.map((e) => (
                <div key={e.id} className="p-3 rounded-lg border border-ink-100 flex justify-between">
                  <div>
                    <div className="font-medium">{e.employee?.fullNameAr}</div>
                    <div className="text-xs text-ink-500">{{ resignation: 'استقالة', termination: 'إنهاء', retirement: 'تقاعد' }[e.reason]} — {e.serviceYears} سنة</div>
                  </div>
                  <div className="font-bold text-primary-700">{money(e.totalPayable)}</div>
                </div>
              ))}
              {!eosList.length && <div className="text-ink-400 text-sm">لا توجد حسابات</div>}
            </div>
          </div>
        </div>
      )}

      {tab === 'wps' && (
        <div className="space-y-3">
          <div className="card-padded">
            <h2 className="h3 mb-3">لوحة المواعيد والعقوبات المتوقعة</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>المسير</th><th>الحالة</th><th>WPS</th><th>الموعد النظامي</th><th>الأيام المتبقية</th><th>عدد الموظفين</th><th>العقوبة المتوقعة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {wpsRows.map((r) => (
                    <tr key={r.runId}>
                      <td>{r.month}/{r.year}</td>
                      <td><span className={r.status === 'paid' ? 'badge-success' : 'badge-primary'}>{RUN_STATUS[r.status]}</span></td>
                      <td><span className={r.wpsStatus === 'accepted' ? 'badge-success' : r.wpsStatus === 'uploaded' ? 'badge-primary' : 'badge-warn'}>{{ pending: 'بانتظار التوليد', generated: 'مولد', uploaded: 'مرفوع', accepted: 'مقبول', rejected: 'مرفوض' }[r.wpsStatus]}</span></td>
                      <td>{r.wpsDeadline ? String(r.wpsDeadline).slice(0, 10) : '—'}</td>
                      <td className={r.daysLeft < 0 ? 'text-danger-600 font-bold' : r.daysLeft <= 5 ? 'text-warn-600' : ''}>{r.daysLeft == null ? '—' : r.daysLeft < 0 ? `متأخر ${-r.daysLeft} يوم` : `${r.daysLeft} يوم`}</td>
                      <td>{r.employees}</td>
                      <td className={r.penalty > 0 ? 'text-danger-600 font-bold' : 'text-ink-400'}>{r.penalty > 0 ? `${money(r.penalty)} (${r.penaltyBand}×موظف)` : 'لا شيء'}</td>
                      <td>
                        {['approved', 'paid'].includes(r.status) && hasAny('wps.write') && (
                          <button onClick={() => genWps(r.month, r.year)} className="btn-primary text-xs">توليد SIF</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!wpsRows.length && <tr><td colSpan={8} className="text-center text-ink-400">لا توجد مسيرات معتمدة</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-padded">
            <h2 className="h3 mb-3">ملفات WPS المرفوعة</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>الفترة</th><th>المرجع</th><th>الحالة</th><th>تاريخ الرفع</th><th>إجراء</th></tr></thead>
                <tbody>
                  {wpsFiles.map((f) => (
                    <tr key={f.id}>
                      <td>{f.month}/{f.year}</td>
                      <td className="text-xs">{f.fileRef}</td>
                      <td><span className={f.status === 'confirmed' ? 'badge-success' : 'badge-warn'}>{{ generated: 'مولد', uploaded: 'مرفوع', confirmed: 'مؤكد', failed: 'فشل' }[f.status]}</span></td>
                      <td className="text-xs text-ink-500">{f.uploadedAt ? new Date(f.uploadedAt).toLocaleDateString('ar-SA') : '—'}</td>
                      <td>
                        {hasAny('wps.write') && f.status === 'generated' && <button onClick={() => wpsStatus(f.id, 'uploaded')} className="btn-primary text-xs">تم الرفع عبر قوى</button>}
                        {hasAny('wps.write') && f.status === 'uploaded' && <button onClick={() => wpsStatus(f.id, 'confirmed')} className="btn-primary text-xs">تأكيد القبول</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'adjustments' && (
        <div className="space-y-3">
          {hasAny('adjustments.request') && (
            <form onSubmit={submitAdjustment} className="card-padded space-y-2">
              <h2 className="h3">طلب تعديل فترة مقفولة (HR ← مالي ← CEO)</h2>
              <div className="text-xs text-ink-500">المسيرات المصروفة ممنوع تعديلها مباشرة — كل تصحيح يمر بهذا ال workflow ويولد قيود عكسية append-only في الدفتر.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <select required value={adjForm.payrollRunId} onChange={(e) => setAdjForm({ ...adjForm, payrollRunId: e.target.value })} className="input">
                  <option value="">اختر المسير المقفول…</option>
                  {runs.filter((r) => ['paid', 'archived'].includes(r.status)).map((r) => <option key={r.id} value={r.id}>{r.code} ({r.month}/{r.year} — مصروف)</option>)}
                </select>
                <input required minLength={5} value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} className="input" placeholder="سبب التعديل (5 أحرف على الأقل)" />
              </div>
              {adjForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <select value={item.employeeId} onChange={(e) => { const items = [...adjForm.items]; items[idx] = { ...item, employeeId: e.target.value }; setAdjForm({ ...adjForm, items }); }} className="input">
                    <option value="">الموظف…</option>
                    {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullNameAr}</option>)}
                  </select>
                  <select value={item.kind} onChange={(e) => { const items = [...adjForm.items]; items[idx] = { ...item, kind: e.target.value }; setAdjForm({ ...adjForm, items }); }} className="input">
                    <option value="reversal_loan">عكس قسط سلفة</option>
                    <option value="reversal_bonus">عكس مكافأة</option>
                    <option value="late_deduction">تصحيح خصم تأخر</option>
                    <option value="absence_deduction">تصحيح خصم غياب</option>
                    <option value="other">أخرى</option>
                  </select>
                  <input type="number" step="0.01" value={item.amount} onChange={(e) => { const items = [...adjForm.items]; items[idx] = { ...item, amount: e.target.value }; setAdjForm({ ...adjForm, items }); }} className="input" placeholder="المبلغ (سالب للعكس)" />
                  <input value={item.note} onChange={(e) => { const items = [...adjForm.items]; items[idx] = { ...item, note: e.target.value }; setAdjForm({ ...adjForm, items }); }} className="input" placeholder="ملاحظة" />
                </div>
              ))}
              <button className="btn-primary">إرسال الطلب</button>
            </form>
          )}
          <div className="card-padded">
            <h2 className="h3 mb-3">الطلبات ({adjustments.length})</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>المسير</th><th>السبب</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {adjustments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.run ? `${a.run.code} (${a.run.month}/${a.run.year})` : a.payrollRunId}</td>
                      <td className="text-xs max-w-md">{a.reason}</td>
                      <td><span className={a.status === 'approved' ? 'badge-success' : a.status === 'rejected' ? 'badge-danger' : 'badge-warn'}>{{ pending: 'بانتظار الاعتماد المالي', finance_approved: 'بانتظار اعتماد CEO', approved: 'معتمد — قيود عكسية', rejected: 'مرفوض' }[a.status]}</span></td>
                      <td>
                        <div className="flex gap-1">
                          {a.status === 'pending' && hasAny('adjustments.finance') && (
                            <>
                              <button onClick={() => decideAdjustment(a.id, 'finance', 'approve')} className="btn-primary text-xs">اعتماد مالي</button>
                              <button onClick={() => decideAdjustment(a.id, 'finance', 'reject')} className="btn-secondary text-xs">رفض</button>
                            </>
                          )}
                          {a.status === 'finance_approved' && hasAny('adjustments.ceo') && (
                            <>
                              <button onClick={() => decideAdjustment(a.id, 'ceo', 'approve')} className="btn-primary text-xs">اعتماد نهائي</button>
                              <button onClick={() => decideAdjustment(a.id, 'ceo', 'reject')} className="btn-secondary text-xs">رفض</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!adjustments.length && <tr><td colSpan={4} className="text-center text-ink-400">لا توجد طلبات</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
