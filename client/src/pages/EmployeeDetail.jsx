import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { fmtDate, toHijri, relativeDays } from '../utils/datetime';
import { DateDual } from '../components/fields/DateDual';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { has } = useAuth();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.get(`/hr/employees/${id}`).then(({ data }) => setEmp(data.employee)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page text-ink-500">جاري التحميل...</div>;
  if (!emp) return <div className="page">الموظف غير موجود</div>;

  const canSeeSalary = has('hr.employee.read.salary');

  return (
    <div className="page space-y-4">
      <Link to="/employees" className="text-sm text-primary-600 hover:underline">← العودة للقائمة</Link>

      <div className="card-padded flex items-start gap-4 flex-wrap">
        <div className="w-20 h-20 rounded-2xl bg-primary-100 text-primary-700 flex items-center justify-center text-3xl font-bold">
          {(emp.fullNameAr || '?')[0]}
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="h1">{emp.fullNameAr}</h1>
          {emp.fullNameEn && <p className="muted">{emp.fullNameEn}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="badge-primary">{emp.employeeNumber}</span>
            <span className="badge-ink">{emp.position?.titleAr}</span>
            <span className="badge-ink">{emp.department?.nameAr}</span>
            <span className="badge-ink">{emp.branch?.nameAr}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-padded">
          <h3 className="h3 mb-3">البيانات الأساسية</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="muted">الهوية</dt><dd>{emp.nationalId || '—'}</dd></div>
            <div><dt className="muted">الجنسية</dt><dd>{emp.nationality || '—'}</dd></div>
            <div><dt className="muted">الجنس</dt><dd>{emp.gender === 'M' ? 'ذكر' : emp.gender === 'F' ? 'أنثى' : '—'}</dd></div>
            <div><dt className="muted">الحالة الاجتماعية</dt><dd>{emp.maritalStatus || '—'}</dd></div>
            <div><dt className="muted">تاريخ الميلاد (ميلادي)</dt><dd>{emp.dobGregorian ? fmtDate(emp.dobGregorian) : '—'}</dd></div>
            <div><dt className="muted">تاريخ الميلاد (هجري)</dt><dd className="font-mono">{toHijri(emp.dobGregorian) || '—'}</dd></div>
            <div><dt className="muted">البريد</dt><dd>{emp.email || '—'}</dd></div>
            <div><dt className="muted">الجوال</dt><dd className="font-mono">{emp.phone || '—'}</dd></div>
          </dl>
        </div>

        <div className="card-padded">
          <h3 className="h3 mb-3">بيانات التوظيف</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="muted">تاريخ التعيين</dt><dd>{fmtDate(emp.hireDate)}</dd></div>
            <div><dt className="muted">نوع العقد</dt><dd>{emp.contractType}</dd></div>
            <div><dt className="muted">نهاية العقد</dt><dd>{emp.contractEndDate ? fmtDate(emp.contractEndDate) + ' (' + relativeDays(emp.contractEndDate) + ')' : '—'}</dd></div>
            <div><dt className="muted">المدير المباشر</dt><dd>{emp.manager?.fullNameAr || '—'}</dd></div>
            {canSeeSalary && (
              <>
                <div><dt className="muted">الراتب</dt><dd className="font-mono font-bold">{emp.salary} {emp.currency}</dd></div>
                <div><dt className="muted">البنك</dt><dd>{emp.bankName || '—'}</dd></div>
                <div className="col-span-2"><dt className="muted">IBAN</dt><dd className="font-mono text-xs">{emp.iban || '—'}</dd></div>
              </>
            )}
            {!canSeeSalary && <div className="col-span-2 text-ink-500 text-xs">الراتب والبيانات البنكية محجوبة بصلاحية</div>}
          </dl>
        </div>
      </div>

      {emp.history && emp.history.length > 0 && (
        <div className="card-padded">
          <h3 className="h3 mb-3">سجل التغييرات ({emp.history.length})</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>النوع</th><th>التفاصيل</th></tr></thead>
              <tbody>
                {emp.history.map((h) => (
                  <tr key={h.id}>
                    <td>{fmtDate(h.effectiveDate)}</td>
                    <td><span className="badge-primary">{h.changeType}</span></td>
                    <td className="text-xs font-mono">{JSON.stringify({ before: h.beforeJson, after: h.afterJson })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {emp.onboardingTasks && emp.onboardingTasks.length > 0 && (
        <div className="card-padded">
          <h3 className="h3 mb-3">قائمة الانضمام</h3>
          <div className="space-y-2">
            {emp.onboardingTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg border border-ink-100">
                <span>{t.titleAr}</span>
                <span className={`badge ${t.status === 'done' ? 'badge-success' : t.status === 'in_progress' ? 'badge-warn' : 'badge-ink'}`}>{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}