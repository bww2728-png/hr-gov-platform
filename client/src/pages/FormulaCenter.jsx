import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const CAT_AR = { salary: 'حسابات الرواتب', service: 'حسابات مدة الخدمة', leave: 'حسابات الإجازات', kpi: 'مؤشرات الأداء KPIs' };
const ROLE_AR = {
  hr_specialist: 'أخصائي HR', payroll_officer: 'مسؤول رواتب', hr_director: 'مدير HR',
  finance_manager: 'المدير المالي', ceo: 'المدير التنفيذي', sysadmin: 'مسؤول النظام', compliance_officer: 'مسؤول امتثال',
};
const rolesAr = (arr) => (Array.isArray(arr) && arr.length ? arr.map((r) => ROLE_AR[r] || r).join(' + ') : '—');

export default function FormulaCenter() {
  const { hasAny } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState(null);
  const [inputs, setInputs] = useState({});
  const [result, setResult] = useState(null);
  const canPropose = hasAny('formulas.propose');

  useEffect(() => {
    client.get('/formulas').then(({ data }) => setItems(data.items)).catch((e) => toast.error(errMsg(e)));
  }, []);

  const shown = items.filter((f) => !filter || f.category === filter);

  function toggle(f) {
    if (open?.id === f.id) { setOpen(null); setResult(null); return; }
    setOpen(f);
    setResult(null);
    const init = {};
    (f.variablesJson || []).forEach((v) => { init[v.key] = v.example ?? ''; });
    setInputs(init);
  }

  function run(f) {
    const casted = {};
    (f.variablesJson || []).forEach((v) => {
      const raw = inputs[v.key];
      casted[v.key] = v.type === 'date' ? raw : (raw === '' ? 0 : Number(raw));
    });
    client.post(`/formulas/${f.code}/simulate`, casted)
      .then(({ data }) => setResult(data.result))
      .catch((e) => toast.error(errMsg(e)));
  }

  function proposeEdit(f) {
    const newExpr = window.prompt('الصيغة العربية الجديدة للمعادلة:', f.expressionAr);
    if (!newExpr || newExpr === f.expressionAr) return;
    const reason = window.prompt('سبب التعديل (إلزامي):');
    if (!reason) return;
    client.post(`/formulas/${f.code}/propose`, { expressionAr: newExpr, reason })
      .then(({ data }) => toast.success(`أُرسل للاعتماد (السلسلة: ${rolesAr(data.chain)})`))
      .catch((e) => toast.error(errMsg(e)));
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="h1">مركز الحسابات والمعادلات</h1>
          <p className="muted">شفافية كاملة: 32 معادلة موثقة بصياغتها ومتغيراتها ومثالها — جرّبها بحاسبة حية.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('')} className={!filter ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>الكل ({items.length})</button>
          {Object.entries(CAT_AR).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(k)} className={filter === k ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{v}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {shown.map((f) => {
          const isOpen = open?.id === f.id;
          const ex = f.exampleJson;
          return (
            <div key={f.id} className="card-padded">
              <button onClick={() => toggle(f)} className="w-full flex justify-between items-center text-start gap-2">
                <div className="flex items-center gap-3">
                  <span className="badge-primary font-mono text-xs">{f.code}</span>
                  <div>
                    <div className="font-medium">{f.nameAr}</div>
                    <div className="text-xs text-ink-500">{CAT_AR[f.category]}</div>
                  </div>
                </div>
                <span className="text-ink-400">{isOpen ? 'إغلاق' : 'عرض'}</span>
              </button>

              {isOpen && (
                <div className="mt-4 space-y-4 border-t border-ink-100 pt-4">
                  {/* الصيغة */}
                  <div className="p-3 rounded-lg bg-primary-50 text-primary-900 font-medium">{f.expressionAr}</div>

                  {/* المتغيرات والمثال */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="h3 mb-2">المتغيرات</h4>
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>المتغير</th><th>الاسم</th></tr></thead>
                          <tbody>
                            {(f.variablesJson || []).map((v) => (
                              <tr key={v.key}><td className="font-mono text-xs">{v.key}</td><td>{v.nameAr}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {ex && (
                      <div>
                        <h4 className="h3 mb-2">مثال موثق</h4>
                        <div className="p-3 rounded-lg bg-ink-50 text-sm space-y-1">
                          {Object.entries(ex.inputs || {}).map(([k, v]) => (
                            <div key={k} className="flex justify-between"><span className="text-ink-500">{(f.variablesJson || []).find((x) => x.key === k)?.nameAr || k}</span><span className="font-mono">{String(v)}</span></div>
                          ))}
                          <div className="flex justify-between border-t border-ink-200 pt-1 font-bold text-primary-700">
                            <span>النتيجة</span><span className="font-mono">{String(ex.result)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* الحاسبة الحية */}
                  {f.hasEngine && (
                    <div className="p-3 rounded-lg border border-primary-200 bg-white space-y-2">
                      <h4 className="h3">حاسبة حية — جرّب بمدخلاتك</h4>
                      <div className="flex flex-wrap gap-2 items-end">
                        {(f.variablesJson || []).map((v) => (
                          <label key={v.key} className="text-xs">
                            <span className="block text-ink-500 mb-1">{v.nameAr}</span>
                            <input
                              type={v.type === 'date' ? 'date' : 'number'}
                              value={inputs[v.key] ?? ''}
                              onChange={(e) => setInputs({ ...inputs, [v.key]: e.target.value })}
                              className="input w-36"
                            />
                          </label>
                        ))}
                        <button onClick={() => run(f)} className="btn-primary text-xs">احسب</button>
                        {result != null && (
                          <span className="text-lg font-bold text-primary-700 font-mono">= {result}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* الحوكمة */}
                  <div className="flex flex-wrap gap-4 items-center text-xs text-ink-600 border-t border-ink-100 pt-3">
                    <span>مالك التعديل: <b>{rolesAr(f.ownerRoles)}</b></span>
                    <span>سلسلة الاعتماد: <b className="text-primary-700">{rolesAr(f.approverRoles)}{f.requiresCeo ? ' (يتطلب CEO)' : ''}</b></span>
                    <span className="badge-ink">إصدار {f.version}</span>
                    {canPropose && <button onClick={() => proposeEdit(f)} className="btn-secondary text-xs">اقتراح تعديل</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!shown.length && <div className="text-ink-400 text-sm">لا توجد معادلات في هذه الفئة.</div>}
      </div>
    </div>
  );
}
