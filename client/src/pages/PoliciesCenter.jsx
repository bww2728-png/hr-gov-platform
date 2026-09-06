import React, { useEffect, useState, useCallback } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const CAT_AR = {
  gosi: 'التأمينات الاجتماعية', overtime: 'العمل الإضافي', workHours: 'ساعات العمل',
  absence: 'الغياب', leave: 'الإجازات', general: 'عام',
};
const VT_AR = { number: 'رقم', percent: 'نسبة %', hours: 'ساعة', days: 'يوم' };
const ROLE_AR = {
  hr_specialist: 'أخصائي HR', payroll_officer: 'مسؤول رواتب', hr_director: 'مدير HR',
  finance_manager: 'المدير المالي', ceo: 'المدير التنفيذي', sysadmin: 'مسؤول النظام',
};
const rolesAr = (arr) => (Array.isArray(arr) && arr.length ? arr.map((r) => ROLE_AR[r] || r).join(' + ') : '—');
const fmtDate = (d) => (d ? new Date(d).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function PoliciesCenter() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('params');
  const [params, setParams] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [versions, setVersions] = useState(null);
  const [editing, setEditing] = useState(null); // { param, value, effectiveFrom, reason }
  const [ltEditing, setLtEditing] = useState(null); // { code, nameAr, rulesText, reason }
  const [filter, setFilter] = useState('');
  const canPropose = hasAny('policies.propose');
  const canRead = hasAny('policies.read') || hasAny('formulas.read');

  const refresh = useCallback(() => {
    client.get('/policies').then(({ data }) => setParams(data.params)).catch((e) => toast.error(errMsg(e)));
    client.get('/policies/leave-types').then(({ data }) => setLeaveTypes(data.types)).catch(() => {});
  }, [toast]);

  useEffect(() => { if (canRead) refresh(); }, [canRead, refresh]);

  function openEdit(p) {
    const num = typeof p.currentValue === 'number' ? p.currentValue : Number(p.currentValue);
    setEditing({ param: p, value: num, effectiveFrom: '', reason: '' });
  }

  function submitEdit() {
    const { param, value, effectiveFrom, reason } = editing;
    if (!Number.isFinite(Number(value))) return toast.error('القيمة يجب أن تكون رقماً');
    if (param.minValue != null && Number(value) < param.minValue) return toast.error(`أدنى حد مسموح: ${param.minValue}`);
    if (param.maxValue != null && Number(value) > param.maxValue) return toast.error(`أقصى حد مسموح: ${param.maxValue}`);
    if (!reason || reason.trim().length < 3) return toast.error('سبب التغيير إلزامي (مبدأ التوثيق)');
    const body = { value: Number(value), reason: reason.trim() };
    if (effectiveFrom) body.effectiveFrom = new Date(effectiveFrom).toISOString();
    client.post(`/policies/${param.code}/propose`, body)
      .then(({ data }) => {
        toast.success(data.applied
          ? 'سُرّي التغيير فوراً'
          : `أُرسل للاعتماد (السلسلة: ${rolesAr(data.chain)})`);
        setEditing(null);
        refresh();
      })
      .catch((e) => toast.error(errMsg(e)));
  }

  function submitLeaveRules() {
    const { code, rulesText, reason } = ltEditing;
    let rules;
    try { rules = JSON.parse(rulesText); } catch { return toast.error('القواعد يجب أن تكون JSON صالحاً'); }
    client.post(`/policies/leave-types/${code}/propose-rules`, { rules, reason: reason.trim() })
      .then(({ data }) => {
        toast.success(`أُرسل للاعتماد (السلسلة: ${rolesAr(data.chain)})`);
        setLtEditing(null);
      })
      .catch((e) => toast.error(errMsg(e)));
  }

  function showVersions(code) {
    client.get(`/policies/${code}/versions`).then(({ data }) => setVersions({ code, items: data.versions })).catch((e) => toast.error(errMsg(e)));
  }

  const cats = [...new Set(params.map((p) => p.category))];
  const shown = params.filter((p) => !filter || p.category === filter);

  if (!canRead) return <div className="page"><h1 className="h1">مركز قواعد وسياسات العمل</h1><p className="muted">ممنوع: لا تملك صلاحية قراءة المعايير.</p></div>;

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">مركز قواعد وسياسات العمل</h1>
        <p className="muted">الاستقلالية التشغيلية: عدّل المعايير والقواعد من هنا — تنعكس على الحسابات فوراً بدون إعادة نشر، وكل تغيير يمر بسلسلة اعتماد موثقة.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('params')} className={tab === 'params' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>المعايير ({params.length})</button>
        <button onClick={() => setTab('leaves')} className={tab === 'leaves' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>سقوف الإجازات ({leaveTypes.length})</button>
        <button onClick={() => setTab('history')} className={tab === 'history' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>سجل التغييرات</button>
      </div>

      {tab === 'params' && (
        <>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('')} className={!filter ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>الكل</button>
            {cats.map((c) => (
              <button key={c} onClick={() => setFilter(c)} className={filter === c ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{CAT_AR[c] || c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {shown.map((p) => (
              <div key={p.code} className="card-padded space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="badge-primary font-mono text-xs">{p.code}</span>
                  <span className="text-xs text-ink-500">{VT_AR[p.valueType] || p.valueType}{p.unitAr ? ` (${p.unitAr})` : ''}</span>
                </div>
                <div className="font-medium">{p.nameAr}</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary-700">{p.currentValue ?? '—'}</span>
                  <span className="text-xs text-ink-500">نسخة v{p.version}</span>
                </div>
                <div className="text-xs text-ink-500">
                  {(p.minValue != null || p.maxValue != null) && `النطاق المسموح: ${p.minValue ?? '∞'} – ${p.maxValue ?? '∞'}`}
                </div>
                <div className="text-xs text-ink-500">المقترحون: {rolesAr(p.ownerRoles)} · المعتمدون: {rolesAr(p.approverRoles)}</div>
                <div className="flex gap-2 pt-1">
                  {canPropose && <button onClick={() => openEdit(p)} className="btn-primary text-xs">تعديل</button>}
                  <button onClick={() => showVersions(p.code)} className="btn-secondary text-xs">السجل</button>
                </div>
              </div>
            ))}
            {!shown.length && <p className="muted">لا توجد معايير — سيتم توليدها تلقائياً من القيم الافتراضية عند أول تشغيل.</p>}
          </div>
        </>
      )}

      {tab === 'leaves' && (
        <div className="space-y-2">
          {leaveTypes.map((lt) => (
            <div key={lt.code} className="card-padded flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-medium">{lt.nameAr}</div>
                <pre className="text-xs text-ink-500 mt-1 whitespace-pre-wrap">{JSON.stringify(lt.rulesJson || {}, null, 1)}</pre>
              </div>
              {canPropose && (
                <button
                  onClick={() => setLtEditing({ code: lt.code, nameAr: lt.nameAr, rulesText: JSON.stringify(lt.rulesJson || {}, null, 2), reason: '' })}
                  className="btn-secondary text-xs"
                >تعديل القواعد</button>
              )}
            </div>
          ))}
          {!leaveTypes.length && <p className="muted">لا توجد أنواع إجازات.</p>}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2">
          <p className="muted text-sm">اختر "السجل" من أي معامل لعرض نسخه (Append-only: لا تُعدّل النسخ القديمة أبداً).</p>
          {versions && (
            <div className="card-padded space-y-2">
              <h3 className="h3">نسخ المعامل: <span className="font-mono">{versions.code}</span></h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>النسخة</th><th>القيمة</th><th>سريان من</th><th>السبب</th><th>بواسطة</th><th>مسجل</th></tr>
                  </thead>
                  <tbody>
                    {versions.items.map((v) => (
                      <tr key={v.id}>
                        <td className="font-mono">v{v.version}</td>
                        <td className="font-bold">{typeof v.valueJson === 'object' ? JSON.stringify(v.valueJson) : v.valueJson}</td>
                        <td className="text-xs">{fmtDate(v.effectiveFrom)}</td>
                        <td className="text-xs">{v.reason || '—'}</td>
                        <td className="text-xs font-mono">{v.createdBy || '—'}</td>
                        <td className="text-xs">{fmtDate(v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* نافذة تعديل معامل */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="card-padded w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="h3">تعديل: {editing.param.nameAr}</h3>
            <div className="text-xs text-ink-500 font-mono">{editing.param.code} — القيمة الحالية: {String(editing.param.currentValue)}</div>
            <label className="block text-sm">القيمة الجديدة{editing.param.unitAr ? ` (${editing.param.unitAr})` : ''}</label>
            <input type="number" step="any" className="input w-full" value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
            {(editing.param.minValue != null || editing.param.maxValue != null) && (
              <div className="text-xs text-ink-500">النطاق: {editing.param.minValue ?? '∞'} – {editing.param.maxValue ?? '∞'}</div>
            )}
            <label className="block text-sm">تاريخ السريان (اختياري — الفارغ يعني فوراً)</label>
            <input type="datetime-local" className="input w-full" value={editing.effectiveFrom}
              onChange={(e) => setEditing({ ...editing, effectiveFrom: e.target.value })} />
            <label className="block text-sm">سبب التغيير (إلزامي — يُوثق في سجل التدقيق)</label>
            <textarea className="input w-full h-20" value={editing.reason}
              onChange={(e) => setEditing({ ...editing, reason: e.target.value })}
              placeholder="مثال: قرار مجلس الإدارة رقم 1447/12 بتغيير نسبة الاشتراك" />
            <div className="flex gap-2 justify-start">
              <button onClick={submitEdit} className="btn-primary text-xs">إرسال للاعتماد</button>
              <button onClick={() => setEditing(null)} className="btn-secondary text-xs">إلغاء</button>
            </div>
            <p className="text-xs text-ink-500">مبدأ الفصل: من يقترح لا يعتمد — سيمر الطلب على سلسلة المعتمدين ({rolesAr(editing.param.approverRoles)}).</p>
          </div>
        </div>
      )}

      {/* نافذة تعديل قواعد إجازة */}
      {ltEditing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setLtEditing(null)}>
          <div className="card-padded w-full max-w-lg space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="h3">قواعد إجازة: {ltEditing.nameAr}</h3>
            <textarea className="input w-full h-40 font-mono text-xs" dir="ltr" value={ltEditing.rulesText}
              onChange={(e) => setLtEditing({ ...ltEditing, rulesText: e.target.value })} />
            <label className="block text-sm">سبب التغيير (إلزامي)</label>
            <textarea className="input w-full h-16" value={ltEditing.reason}
              onChange={(e) => setLtEditing({ ...ltEditing, reason: e.target.value })} />
            <div className="flex gap-2 justify-start">
              <button onClick={submitLeaveRules} className="btn-primary text-xs">إرسال للاعتماد</button>
              <button onClick={() => setLtEditing(null)} className="btn-secondary text-xs">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
