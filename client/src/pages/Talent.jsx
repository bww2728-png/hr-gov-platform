import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const READY_AR = { ready_now: 'جاهز الآن', ready_1y: 'جاهز خلال سنة', ready_2_3y: 'جاهز خلال 2-3 سنوات' };

export default function Talent() {
  const toast = useToast();
  const [plans, setPlans] = useState([]);
  const [hipo, setHipo] = useState([]);

  function load() {
    client.get('/talent/succession').then(({ data }) => setPlans(data.plans)).catch(() => {});
    client.get('/talent/hipo').then(({ data }) => setHipo(data.members)).catch(() => {});
  }
  useEffect(load, []);

  return (
    <div className="page space-y-4">
      <h1 className="h1">المواهب والتعاقب الوظيفي</h1>

      <div className="card-padded">
        <h2 className="h3 mb-3">خطط التعاقب ({plans.length})</h2>
        <div className="space-y-3">
          {plans.map((p) => (
            <div key={p.id} className="p-4 rounded-lg border border-ink-100">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold">{p.position?.titleAr || `منصب #${p.positionId}`}</span>
                <span className={p.approvedById ? 'badge-success' : 'badge-warn'}>{p.approvedById ? 'معتمدة' : 'قيد الاعتماد'}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {p.candidates.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg bg-ink-50">
                    <div className="font-medium">{c.employee?.fullNameAr}</div>
                    <div className="text-xs text-primary-700 mt-1">{READY_AR[c.readiness]}</div>
                    {c.developmentNote && <div className="text-xs text-ink-500 mt-1">{c.developmentNote}</div>}
                  </div>
                ))}
                {!p.candidates.length && <div className="text-ink-400 text-sm">لا يوجد مرشحون</div>}
              </div>
            </div>
          ))}
          {!plans.length && <div className="text-ink-400 text-sm">لا توجد خطط تعاقب</div>}
        </div>
      </div>

      <div className="card-padded">
        <h2 className="h3 mb-3">برنامج المواهب عالية الإمكانات HiPo ({hipo.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {hipo.map((m) => (
            <div key={m.id} className="p-4 rounded-lg border border-primary-100 bg-primary-50">
              <div className="font-bold">{m.employee?.fullNameAr}</div>
              <div className="text-xs text-ink-500 mt-1">{m.employee?.employeeNumber}</div>
              {m.programJson?.track && <div className="text-xs text-primary-700 mt-1">مسار: {m.programJson.track}</div>}
              <span className={m.status === 'active' ? 'badge-success mt-2 inline-block' : 'badge-ink mt-2 inline-block'}>
                {{ active: 'نشط', graduated: 'متخرج', removed: 'مستبعد' }[m.status]}
              </span>
            </div>
          ))}
          {!hipo.length && <div className="text-ink-400 text-sm">لا يوجد أعضاء</div>}
        </div>
      </div>
    </div>
  );
}
