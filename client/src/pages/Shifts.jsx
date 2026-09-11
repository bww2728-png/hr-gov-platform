import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const DAY_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const minsToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const EMPTY_FORM = {
  code: '', nameAr: '', startMin: 480, endMin: 960, graceInMins: 15,
  earlyLeaveThresholdMins: 15, checkInWindowBeforeMins: 60, checkInWindowAfterMins: 120,
  workDays: [0, 1, 2, 3, 4], allowHolidayCheckIn: false,
  lateDeductionMultiplier: 1.5, weeklyHourCap: 45, isRamadan: false, active: true,
};

export default function Shifts() {
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [tab, setTab] = useState('shifts');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [assignShiftId, setAssignShiftId] = useState(null);
  const [assign, setAssign] = useState({ scope: 'employee', refId: '', startDate: '', endDate: '' });
  const [assignments, setAssignments] = useState([]);
  const [resolveId, setResolveId] = useState('');
  const [resolved, setResolved] = useState(null);

  function load() {
    client.get('/shifts').then(({ data }) => setShifts(data.shifts)).catch((e) => toast.error(e.response?.data?.error || 'فشل التحميل'));
    client.get('/shifts/assignments').then(({ data }) => setAssignments(data.assignments)).catch(() => {});
  }
  useEffect(load, []);

  function toggleDay(d) {
    setForm((f) => ({ ...f, workDays: f.workDays.includes(d) ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort() }));
  }

  function save(e) {
    e.preventDefault();
    const payload = { ...form, startMin: Number(form.startMin), endMin: Number(form.endMin), graceInMins: Number(form.graceInMins), earlyLeaveThresholdMins: Number(form.earlyLeaveThresholdMins), checkInWindowBeforeMins: Number(form.checkInWindowBeforeMins), checkInWindowAfterMins: Number(form.checkInWindowAfterMins), lateDeductionMultiplier: Number(form.lateDeductionMultiplier), weeklyHourCap: Number(form.weeklyHourCap) };
    const req = editingId ? client.patch(`/shifts/${editingId}`, payload) : client.post('/shifts', payload);
    req.then(() => { toast.success(editingId ? 'تم التعديل' : 'تمت الإضافة'); setForm(EMPTY_FORM); setEditingId(null); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  function edit(s) {
    setEditingId(s.id);
    setForm({ ...EMPTY_FORM, ...s });
    setTab('shifts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitAssign(e) {
    e.preventDefault();
    client.post(`/shifts/${assignShiftId}/assign`, { ...assign, endDate: assign.endDate || null })
      .then(({ data }) => { toast.success(`تم التعيين${data.closed?.length ? ` (أغلقت ${data.closed.length} تعيين ساري)` : ''}`); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  function unassign(id) {
    client.delete(`/shifts/assignments/${id}`).then(() => { toast.success('تم إلغاء التعيين'); load(); }).catch((e) => toast.error(e.response?.data?.error || 'فشل'));
  }

  function preview(e) {
    e.preventDefault();
    client.get(`/shifts/resolve/${resolveId}`).then(({ data }) => setResolved(data)).catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">إدارة الورديات</h1>

      <div className="flex gap-2 border-b border-ink-100">
        {[
          { id: 'shifts', label: `الورديات (${shifts.length})` },
          { id: 'assign', label: `التعيينات (${assignments.length})` },
          { id: 'preview', label: 'معاينة الوردية الفعّالة' },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm ${tab === t.id ? 'border-b-2 border-primary-600 text-primary-700 font-medium' : 'text-ink-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shifts' && (
        <>
          <form onSubmit={save} className="card-padded grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <label className="text-sm">الرمز (لاتيني)
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} disabled={!!editingId} className="input" placeholder="EVENING" /></label>
            <label className="text-sm">الاسم بالعربية
              <input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" /></label>
            <label className="text-sm">البداية (دقائق من منتصف الليل)
              <input type="number" min="0" max="1439" value={form.startMin} onChange={(e) => setForm({ ...form, startMin: e.target.value })} className="input" />
              <span className="text-xs text-ink-400">{minsToHHMM(Number(form.startMin) || 0)}</span></label>
            <label className="text-sm">النهاية
              <input type="number" min="0" max="1440" value={form.endMin} onChange={(e) => setForm({ ...form, endMin: e.target.value })} className="input" />
              <span className="text-xs text-ink-400">{minsToHHMM(Number(form.endMin) || 0)}</span></label>
            <label className="text-sm">سماحية التأخر (د)
              <input type="number" min="0" max="180" value={form.graceInMins} onChange={(e) => setForm({ ...form, graceInMins: e.target.value })} className="input" /></label>
            <label className="text-sm">عتبة الانصراف المبكر (د)
              <input type="number" min="0" max="180" value={form.earlyLeaveThresholdMins} onChange={(e) => setForm({ ...form, earlyLeaveThresholdMins: e.target.value })} className="input" /></label>
            <label className="text-sm">نافذة قبل البداية (د)
              <input type="number" min="0" max="240" value={form.checkInWindowBeforeMins} onChange={(e) => setForm({ ...form, checkInWindowBeforeMins: e.target.value })} className="input" /></label>
            <label className="text-sm">نافذة بعد البداية (د)
              <input type="number" min="0" max="240" value={form.checkInWindowAfterMins} onChange={(e) => setForm({ ...form, checkInWindowAfterMins: e.target.value })} className="input" /></label>
            <label className="text-sm">معامل خصم التأخر
              <input type="number" min="0" max="5" step="0.1" value={form.lateDeductionMultiplier} onChange={(e) => setForm({ ...form, lateDeductionMultiplier: e.target.value })} className="input" /></label>
            <label className="text-sm">سقف الساعات الأسبوعية
              <input type="number" min="0" max="60" value={form.weeklyHourCap} onChange={(e) => setForm({ ...form, weeklyHourCap: e.target.value })} className="input" /></label>
            <div className="col-span-2 md:col-span-4">
              <div className="text-sm mb-1">أيام العمل</div>
              <div className="flex flex-wrap gap-1">
                {DAY_AR.map((day, d) => (
                  <button type="button" key={d} onClick={() => toggleDay(d)}
                    className={`px-2.5 py-1 rounded text-xs ${form.workDays.includes(d) ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-500'}`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2 md:col-span-4 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.allowHolidayCheckIn} onChange={(e) => setForm({ ...form, allowHolidayCheckIn: e.target.checked })} /> مسموح التسجيل يوم العطلة الرسمية</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.isRamadan} onChange={(e) => setForm({ ...form, isRamadan: e.target.checked })} /> وردية رمضان (تلقائية بالشهر الهجري 9)</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> مفعلة</label>
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2">
              <button className="btn-primary">{editingId ? 'حفظ التعديل' : 'إضافة وردية'}</button>
              {editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>إلغاء</button>}
            </div>
          </form>

          <div className="card-padded">
            <div className="table-wrap">
              <table>
                <thead><tr><th>الرمز</th><th>الاسم</th><th>البداية</th><th>النهاية</th><th>سماحية</th><th>أيام العمل</th><th>عطلة؟</th><th>رمضان</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {shifts.map((s) => (
                    <tr key={s.id} className={!s.active ? 'opacity-50' : ''}>
                      <td className="font-mono text-xs">{s.code}</td>
                      <td>{s.nameAr}</td>
                      <td>{minsToHHMM(s.startMin)}</td>
                      <td>{minsToHHMM(s.endMin)}</td>
                      <td>{s.graceInMins} د</td>
                      <td className="text-xs">{(s.workDays || []).map((d) => DAY_AR[d]).join('، ')}</td>
                      <td className="text-xs">{s.allowHolidayCheckIn ? 'مسموح' : 'ممنوع'}</td>
                      <td className="text-xs">{s.isRamadan ? 'نعم' : '—'}</td>
                      <td><span className={s.active ? 'badge-success' : 'badge-ink'}>{s.active ? 'مفعلة' : 'معطلة'}</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn-secondary text-xs px-2 py-1" onClick={() => edit(s)}>تعديل</button>
                          <button className="btn-secondary text-xs px-2 py-1" onClick={() => { setAssignShiftId(s.id); setTab('assign'); }}>تعيين</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!shifts.length && <tr><td colSpan={10} className="text-center text-ink-400">لا توجد ورديات</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'assign' && (
        <>
          <form onSubmit={submitAssign} className="card-padded grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <label className="text-sm">الوردية
              <select required value={assignShiftId || ''} onChange={(e) => setAssignShiftId(Number(e.target.value))} className="input">
                <option value="">اختر…</option>
                {shifts.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.nameAr}</option>)}
              </select></label>
            <label className="text-sm">النطاق
              <select value={assign.scope} onChange={(e) => setAssign({ ...assign, scope: e.target.value, refId: '' })} className="input">
                <option value="employee">موظف</option>
                <option value="department">قسم (ID)</option>
                <option value="branch">فرع (ID)</option>
              </select></label>
            <label className="text-sm">{assign.scope === 'employee' ? 'ID الموظف' : 'ID النطاق'}
              <input required value={assign.refId} onChange={(e) => setAssign({ ...assign, refId: e.target.value })} className="input" placeholder={assign.scope === 'employee' ? '53789f33-…' : '9'} /></label>
            <label className="text-sm">من تاريخ
              <input required type="date" value={assign.startDate} onChange={(e) => setAssign({ ...assign, startDate: e.target.value })} className="input" /></label>
            <label className="text-sm">إلى (اختياري — فراغ = ساري)
              <input type="date" value={assign.endDate} onChange={(e) => setAssign({ ...assign, endDate: e.target.value })} className="input" /></label>
            <div className="md:col-span-5"><button className="btn-primary">تعيين الوردية</button></div>
          </form>

          <div className="card-padded">
            <div className="table-wrap">
              <table>
                <thead><tr><th>الوردية</th><th>النطاق</th><th>المرجع</th><th>من</th><th>إلى</th><th>الحالة</th><th>إجراء</th></tr></thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs">{a.shift?.code}</td>
                      <td className="text-xs">{{ employee: 'موظف', department: 'قسم', branch: 'فرع' }[a.scope]}</td>
                      <td className="font-mono text-[11px] text-ink-500">{a.refId.length > 20 ? `${a.refId.slice(0, 8)}…` : a.refId}</td>
                      <td>{String(a.startDate).slice(0, 10)}</td>
                      <td>{a.endDate ? String(a.endDate).slice(0, 10) : '—'}</td>
                      <td><span className={a.endDate ? 'badge-ink' : 'badge-success'}>{a.endDate ? 'منتهي' : 'ساري'}</span></td>
                      <td><button className="btn-secondary text-xs px-2 py-1" onClick={() => unassign(a.id)}>إلغاء</button></td>
                    </tr>
                  ))}
                  {!assignments.length && <tr><td colSpan={7} className="text-center text-ink-400">لا توجد تعيينات</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'preview' && (
        <form onSubmit={preview} className="card-padded space-y-3 max-w-xl">
          <label className="text-sm block">ID الموظف
            <input required value={resolveId} onChange={(e) => setResolveId(e.target.value)} className="input" placeholder="53789f33-…" /></label>
          <button className="btn-primary">معاينة</button>
          {resolved && (
            <div className="border border-ink-200 rounded-lg p-3 space-y-1 text-sm">
              <div>الموظف: <b>{resolved.name}</b></div>
              <div>الوردية الفعّالة: <b className="font-mono">{resolved.shift.code}</b> — {resolved.shift.nameAr}
                <span className="text-xs text-ink-400"> (المصدر: {{ employee: 'تعيين موظف', department: 'تعيين قسم', branch: 'تعيين فرع', ramadan: 'رمضان تلقائي', default: 'افتراضية من مركز المعايير' }[resolved.source]})</span></div>
              <div>من {minsToHHMM(resolved.shift.startMin)} إلى {minsToHHMM(resolved.shift.endMin)} — سماحية {resolved.shift.graceInMins}د</div>
              <div>أيام العمل: {(resolved.shift.workDays || []).map((d) => DAY_AR[d]).join('، ')}</div>
              <div className={resolved.officialHoliday ? 'text-warn-600' : ''}>
                {resolved.officialHoliday ? `عطلة رسمية: ${resolved.officialHoliday.nameAr}${resolved.shift.allowHolidayCheckIn ? ' (التسجيل مسموح حسب الوردية)' : ' (التسجيل ممنوع حسب الوردية)'}` : 'لا عطلة رسمية'}
              </div>
              <div className={resolved.isWorkDay ? '' : 'text-warn-600'}>{resolved.isWorkDay ? 'يوم عمل' : 'يوم راحة أسبوعي حسب الوردية'}</div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
