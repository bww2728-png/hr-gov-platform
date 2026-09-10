import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

const KIND_AR = { lookup: 'قائمة مرجعية', formula: 'معادلة', salary_structure: 'هيكل رواتب', employee: 'موظف' };
const STATUS_AR = { pending: 'بانتظار الاعتماد', approved: 'اعتُمد', applied: 'طُبّق', rejected: 'مرفوض', cancelled: 'ملغى' };
const STATUS_CLS = { pending: 'badge-warn', approved: 'badge-primary', applied: 'badge-success', rejected: 'badge-danger', cancelled: 'badge-ink' };

function Diff({ before, after }) {
  if (!before && !after) return null;
  const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const changed = keys.filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
  if (!changed.length) return null;
  return (
    <div className="table-wrap mt-2">
      <table className="text-xs">
        <thead><tr><th>الحقل</th><th>قبل</th><th>بعد</th></tr></thead>
        <tbody>
          {changed.map((k) => (
            <tr key={k}>
              <td className="font-medium">{k}</td>
              <td className="text-danger-700">{before?.[k] == null ? '—' : String(before[k])}</td>
              <td className="text-success-700">{after?.[k] == null ? '—' : String(after[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApprovalsInbox() {
  const { user, has } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState([]);
  const [all, setAll] = useState([]);
  const [openId, setOpenId] = useState(null);
  const canGov = has('governance.read');

  function load() {
    if (!canGov) return;
    client.get('/governance/pending').then(({ data }) => setPending(data.items)).catch(() => setPending([]));
    client.get('/governance/all').then(({ data }) => setAll(data.items)).catch(() => setAll([]));
  }
  useEffect(load, []);

  function decide(id, decision) {
    const note = decision === 'reject' ? window.prompt('سبب الرفض:') : null;
    if (decision === 'reject' && note === null) return;
    client.post(`/governance/${id}/decision`, { decision, note })
      .then(() => { toast.success(decision === 'approve' ? 'اعتُمد' : 'رُفض'); load(); })
      .catch((e) => toast.error(errMsg(e)));
  }

  const items = tab === 'pending' ? pending : all;

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="h1">صندوق الاعتمادات</h1>
          <p className="muted">طلبات التغيير المحكومة على القوائم والمعادلات — الفصل الوظيفي والأربع عيون مطبَّقان.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('pending')} className={tab === 'pending' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>بانتظار اعتمادي ({pending.length})</button>
          <button onClick={() => setTab('all')} className={tab === 'all' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>كل الطلبات ({all.length})</button>
        </div>
      </div>

      <div className="space-y-2">
        {!canGov && (
          <div className="card-padded text-center text-ink-400">
            لا تملك صلاحية عرض طلبات التغيير المحكومة — هذه الشاشة مخصصة لأصحاب صلاحية الحوكمة
          </div>
        )}
        {canGov && items.map((cr) => {
          const chain = Array.isArray(cr.approverChain) ? cr.approverChain : [];
          const approvals = Array.isArray(cr.approvalsJson) ? cr.approvalsJson : [];
          const isOpen = openId === cr.id;
          const isPendingMine = tab === 'pending';
          return (
            <div key={cr.id} className="card-padded">
              <button onClick={() => setOpenId(isOpen ? null : cr.id)} className="w-full flex justify-between items-start text-start gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge-primary">{KIND_AR[cr.kind] || cr.kind}</span>
                    <span className="font-mono text-xs text-ink-500">{cr.targetKey}</span>
                    <span className={STATUS_CLS[cr.status] || 'badge-ink'}>{STATUS_AR[cr.status] || cr.status}</span>
                  </div>
                  <div className="text-sm mt-1">{cr.reason}</div>
                  <div className="text-xs text-ink-500 mt-1">
                    اقترحه: {cr.proposer?.fullNameAr} — {fmtDate(cr.createdAt)}
                  </div>
                </div>
                <span className="text-ink-400">{isOpen ? 'إغلاق' : 'تفاصيل'}</span>
              </button>

              {isOpen && (
                <div className="mt-3 border-t border-ink-100 pt-3 space-y-3">
                  {/* مسار الاعتماد */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-ink-500">مسار الاعتماد:</span>
                    {chain.map((role, i) => {
                      const done = approvals[i];
                      const current = i === cr.currentStage && cr.status === 'pending';
                      return (
                        <span key={i} className={`px-2 py-1 rounded ${done ? 'bg-success-50 text-success-700' : current ? 'bg-warn-50 text-warn-700 font-bold' : 'bg-ink-50 text-ink-400'}`}>
                          {role}{done ? ' تم' : current ? ' (الحالية)' : ''}
                        </span>
                      );
                    })}
                  </div>

                  {/* قبل/بعد */}
                  <Diff before={cr.beforeJson} after={cr.payloadJson} />

                  {/* الاعتمادات السابقة */}
                  {approvals.length > 0 && (
                    <div className="text-xs space-y-1">
                      {approvals.map((a, i) => (
                        <div key={i} className="text-ink-600">اعتماد {i + 1}: دور {a.role} — {a.decision === 'approve' ? 'قبول' : 'رفض'} {a.note ? `(${a.note})` : ''}</div>
                      ))}
                    </div>
                  )}

                  {/* أزرار القرار */}
                  {isPendingMine && cr.status === 'pending' && (
                    <div className="flex gap-2">
                      <button onClick={() => decide(cr.id, 'approve')} className="btn-primary text-xs">اعتماد</button>
                      <button onClick={() => decide(cr.id, 'reject')} className="btn-secondary text-xs text-danger-600">رفض</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canGov && !items.length && (
          <div className="card-padded text-center text-ink-400">
            {tab === 'pending' ? 'لا توجد طلبات بانتظار اعتمادك' : 'لا توجد طلبات تغيير بعد'}
          </div>
        )}
      </div>
    </div>
  );
}
