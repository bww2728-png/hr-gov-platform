import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';

export default function Insurance() {
  const { has } = useAuth();
  const toast = useToast();
  const [policies, setPolicies] = useState([]);
  const [members, setMembers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [me, setMe] = useState([]);

  function load() {
    if (has('insurance.read')) {
      client.get('/insurance/policies').then(({ data }) => setPolicies(data.policies)).catch(() => {});
    } else {
      client.get('/insurance/me').then(({ data }) => setMe(data.memberships)).catch(() => {});
    }
  }
  useEffect(load, [has]);

  function showMembers(p) {
    client
      .get(`/insurance/policies/${p.id}/members`)
      .then(({ data }) => { setMembers(data.members); setSelected(p); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل تحميل الأعضاء'));
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">التأمين الصحي</h1>

      {me.length > 0 && (
        <div className="card-padded">
          <h2 className="h3 mb-3">عضويتي في التأمين</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>الجهة</th><th>الخطة</th><th>الصلة</th><th>انتهاء العضوية</th><th>رقم البطاقة</th></tr></thead>
              <tbody>
                {me.map((m) => (
                  <tr key={m.id}>
                    <td>{m.policy?.provider}</td>
                    <td>{m.policy?.planName}</td>
                    <td>{{ self: 'نفسه', spouse: 'زوج/زوجة', child: 'ابن/ابنة' }[m.relation]}</td>
                    <td>{fmtDate(m.policy?.endDate)}</td>
                    <td>{m.cardNumber || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {policies.map((p) => {
          const active = new Date(p.endDate) > new Date();
          return (
            <div key={p.id} className="card-padded space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-bold">{p.provider}</span>
                <span className={active ? 'badge-success' : 'badge-danger'}>{active ? 'سارية' : 'منتهية'}</span>
              </div>
              <div className="text-sm text-ink-600">{p.planName}</div>
              <div className="text-xs text-ink-500">{fmtDate(p.startDate)} — {fmtDate(p.endDate)}</div>
              <div className="text-sm">القسط السنوي: {Number(p.premium).toLocaleString('ar-SA')} ر.س</div>
              <button onClick={() => showMembers(p)} className="btn-secondary text-xs">الأعضاء ({p._count?.members || 0})</button>
            </div>
          );
        })}
        {!policies.length && <div className="text-ink-400">لا توجد وثائق تأمين</div>}
      </div>

      {selected && (
        <div className="card-padded">
          <h2 className="h3 mb-3">أعضاء الوثيقة {selected.policyNumber}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>الموظف</th><th>الصلة</th><th>رقم البطاقة</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.employee?.fullNameAr}</td>
                    <td>{{ self: 'نفسه', spouse: 'زوج/زوجة', child: 'ابن/ابنة' }[m.relation]}</td>
                    <td>{m.cardNumber || '—'}</td>
                  </tr>
                ))}
                {!members.length && <tr><td colSpan={3} className="text-center text-ink-400">لا يوجد أعضاء</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
