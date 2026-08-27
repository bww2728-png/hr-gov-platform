import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_AR = {
  employee: 'موظف', line_manager: 'مدير مباشر', hr_specialist: 'أخصائي HR', recruiter: 'مسؤول توظيف',
  payroll_officer: 'مسؤول رواتب', ld_specialist: 'مسؤول تعلم', hr_director: 'مدير HR',
  finance_manager: 'المدير المالي', ceo: 'المدير التنفيذي', auditor: 'مراقب داخلي',
  sysadmin: 'مسؤول النظام', security_admin: 'مسؤول الأمن', data_analyst: 'محلل بيانات', compliance_officer: 'مسؤول امتثال',
};
const rolesAr = (arr) => (Array.isArray(arr) && arr.length ? arr.map((r) => ROLE_AR[r] || r).join(' + ') : '—');

export default function LookupAdmin() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState([]);
  const [form, setForm] = useState({ code: '', valueAr: '', valueEn: '', reason: '' });
  const [editing, setEditing] = useState(null);
  const canPropose = hasAny('governance.propose');

  function load() {
    client.get('/lookups/governance').then(({ data }) => setCategories(data.categories)).catch((e) => toast.error(errMsg(e)));
  }
  useEffect(load, []);

  function openCategory(cat) {
    setSelected(cat);
    setEditing(null);
    setForm({ code: '', valueAr: '', valueEn: '', reason: '' });
    client.get(`/lookups/governance/${cat.code}/values`)
      .then(({ data }) => setValues(data.values))
      .catch(() => setValues([]));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.reason.trim()) return toast.error('سبب التغيير إلزامي');
    const req = editing
      ? client.put(`/lookups/governance/${selected.code}/${editing.code}`, { valueAr: form.valueAr, valueEn: form.valueEn, reason: form.reason })
      : client.post(`/lookups/governance/${selected.code}`, { code: form.code, valueAr: form.valueAr, valueEn: form.valueEn, reason: form.reason });
    req.then(({ data }) => {
        if (data.applied) toast.success('طُبّق التغيير مباشرة');
        else toast.success(`أُرسل للاعتماد (السلسلة: ${rolesAr(data.chain)})`);
        setForm({ code: '', valueAr: '', valueEn: '', reason: '' });
        setEditing(null);
        openCategory(selected);
      })
      .catch((err) => toast.error(errMsg(err)));
  }

  function deactivate(v) {
    const reason = window.prompt('سبب التعطيل (إلزامي):');
    if (!reason) return;
    client.delete(`/lookups/governance/${selected.code}/${v.code}`, { data: { reason } })
      .then(({ data }) => { toast.success(data.applied ? 'عُطّلت القيمة' : 'أُرسل للاعتماد'); openCategory(selected); })
      .catch((err) => toast.error(errMsg(err)));
  }

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">الجداول الفرعية (القوائم المرجعية)</h1>
        <p className="muted">إدارة الـ 21 جدولاً فرعياً بمبدأ «اللامركزية الخاضعة للرقابة» — المالك يقترح والمعتمد يقرر.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* قائمة الفئات */}
        <div className="card-padded space-y-1 max-h-[70vh] overflow-y-auto">
          {categories.map((c) => (
            <button key={c.code} onClick={() => openCategory(c)}
              className={`w-full text-start p-3 rounded-lg border transition ${selected?.code === c.code ? 'border-primary-300 bg-primary-50' : 'border-ink-100 hover:bg-ink-50'}`}>
              <div className="flex justify-between items-center">
                <span className="font-medium text-sm">{c.nameAr}</span>
                {c.valuesCount != null && <span className="badge-ink text-xs">{c.valuesCount}</span>}
              </div>
              <div className="text-xs text-ink-500 mt-1">المالك: {rolesAr(c.ownerRoles)}</div>
              <div className="text-xs text-ink-500">
                {c.requiresApproval ? <>المعتمد: <span className="text-primary-700">{rolesAr(c.approverRoles)}</span></> : <span className="text-ink-400">بدون موافقة — تعديل مباشر</span>}
              </div>
            </button>
          ))}
          {!categories.length && <div className="text-ink-400 text-sm">جاري التحميل…</div>}
        </div>

        {/* قيم الفئة المختارة */}
        <div className="lg:col-span-2 space-y-4">
          {!selected ? (
            <div className="card-padded text-ink-400 text-sm">اختر جدولاً فرعياً من القائمة لعرض قيمه وإدارته.</div>
          ) : (
            <>
              <div className="card-padded">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h2 className="h3">{selected.nameAr}</h2>
                    <div className="text-xs text-ink-500 mt-1">{selected.notes}</div>
                  </div>
                  <div className="text-left text-xs space-y-1">
                    <div><span className="text-ink-500">المصدر:</span> {selected.source === 'lookup' ? 'قائمة مرجعية' : `جدول حي (${selected.sourceTable})`}</div>
                    {selected.sensitive && <span className="badge-warn">حساس — أربع عيون</span>}
                  </div>
                </div>
                {selected.source === 'table' && (
                  <div className="mt-3 p-3 rounded-lg bg-ink-50 text-sm text-ink-600">
                    هذه الفئة مرتبطة بجدول حي ({selected.sourceTable}) — تُدار قيمها من شاشتها المخصصة، وكل تغيير يُوثَّق هنا.
                  </div>
                )}
              </div>

              {selected.source === 'lookup' && (
                <>
                  <div className="card-padded">
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>الرمز</th><th>العربية</th><th>الإنجليزية</th><th>الحالة</th><th></th></tr></thead>
                        <tbody>
                          {values.map((v) => (
                            <tr key={v.id} className={!v.isActive ? 'opacity-50' : ''}>
                              <td className="font-mono text-xs">{v.code}</td>
                              <td>{v.valueAr}</td>
                              <td className="text-ink-500">{v.valueEn}</td>
                              <td>{v.isActive ? <span className="badge-success">نشطة</span> : <span className="badge-ink">معطلة</span>}</td>
                              <td className="space-x-1 space-x-reverse">
                                {canPropose && (
                                  <>
                                    <button className="btn-secondary text-xs" onClick={() => { setEditing(v); setForm({ code: v.code, valueAr: v.valueAr, valueEn: v.valueEn, reason: '' }); }}>تعديل</button>
                                    {v.isActive && <button className="btn-secondary text-xs text-danger-600" onClick={() => deactivate(v)}>تعطيل</button>}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                          {!values.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد قيم</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {canPropose && (
                    <form onSubmit={submit} className="card-padded space-y-2">
                      <h3 className="h3">{editing ? `تعديل: ${editing.valueAr}` : 'إضافة قيمة جديدة'}</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {!editing && <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="الرمز (CODE)" className="input font-mono" />}
                        <input value={form.valueAr} onChange={(e) => setForm({ ...form, valueAr: e.target.value })} required placeholder="القيمة بالعربية" className="input" />
                        <input value={form.valueEn} onChange={(e) => setForm({ ...form, valueEn: e.target.value })} placeholder="بالإنجليزية (اختياري)" className="input" />
                      </div>
                      <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required placeholder="سبب التغيير (إلزامي — يُوثَّق في سجل التدقيق)" className="input w-full" />
                      <div className="flex gap-2 items-center">
                        <button className="btn-primary">{selected.requiresApproval ? 'إرسال للاعتماد' : 'تطبيق مباشر'}</button>
                        {editing && <button type="button" className="btn-secondary" onClick={() => { setEditing(null); setForm({ code: '', valueAr: '', valueEn: '', reason: '' }); }}>إلغاء</button>}
                        {selected.requiresApproval && <span className="text-xs text-ink-500">سيُرسل إلى: {rolesAr(selected.approverRoles)}</span>}
                      </div>
                    </form>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
