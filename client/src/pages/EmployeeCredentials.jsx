import React, { useEffect, useMemo, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { exportExcel } from '../utils/exporters';
import { normArClient } from '../utils/arabic';

export default function EmployeeCredentials() {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    client.get('/hr/employees/credentials')
      .then(({ data }) => setRows(data.rows || []))
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = normArClient(search);
    if (!q) return rows;
    return rows.filter((r) =>
      normArClient(r.fullNameAr).includes(q) ||
      normArClient(r.username).includes(q) ||
      normArClient(r.employeeNumber).includes(q)
    );
  }, [rows, search]);

  function copyRow(r) {
    navigator.clipboard.writeText(`${r.fullNameAr} | دخول: ${r.username} | كلمة السر: ${r.password}`)
      .then(() => toast.success('نُسخت بيانات الدخول'));
  }

  function copyAll() {
    const text = filtered.map((r) => `${r.fullNameAr} | دخول: ${r.username} | كلمة السر: ${r.password}`).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success(`نُسخت بيانات ${filtered.length} موظف`));
  }

  async function doExport() {
    setExporting(true);
    try {
      await exportExcel(
        { code: 'CRED-01', nameAr: 'تقرير كلمات المرور المُصدرة', by: user?.fullNameAr || '' },
        { rows: filtered.map((r) => ({
          'الاسم': r.fullNameAr,
          'الرقم الوظيفي': r.employeeNumber,
          'اسم الدخول': r.username,
          'كلمة السر': r.password || '—',
          'الدور': r.roleName || '—',
          'الحالة': r.changed ? 'غُيّرت بواسطة المستخدم' : 'سارية (المُصدرة)',
          'تاريخ الإصدار': r.issuedAt ? new Date(r.issuedAt).toLocaleDateString('ar-SA') : '—',
        })) }
      );
      toast.success('تم تصدير ملف Excel بنجاح');
    } catch (e) {
      toast.error('تعذر التصدير: ' + (e?.message || 'خطأ غير متوقع'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">تقرير كلمات المرور المُصدرة</h1>
          <p className="muted">{filtered.length} حساب — لكل موظف كلمة سره المولّدة تلقائياً</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={copyAll} disabled={!filtered.length}>نسخ الكل</button>
          <button type="button" className="btn-secondary" onClick={doExport} disabled={!filtered.length || exporting}>
            {exporting ? 'جاري التصدير...' : 'تصدير Excel'}
          </button>
        </div>
      </div>

      <div className="card-padded">
        <label className="label">بحث</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بالاسم، رقم وظيفي، أو اسم دخول..."
          className="input w-full"
        />
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الرقم الوظيفي</th>
              <th>اسم الدخول</th>
              <th>كلمة السر</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-6 text-ink-500">جاري التحميل...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-ink-500">
                {rows.length === 0 ? 'لا توجد كلمات مرور مُصدرة بعد — ستظهر عند إضافة موظفين جدد' : 'لا نتائج مطابقة للبحث'}
              </td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.username + i}>
                <td className="font-medium">{r.fullNameAr}</td>
                <td className="font-mono text-xs">{r.employeeNumber}</td>
                <td className="font-mono text-xs" dir="ltr">{r.username}</td>
                <td className="font-mono text-xs" dir="ltr">
                  {r.changed
                    ? <span className="muted">غُيّرت</span>
                    : (revealed[i] ? r.password : '••••••••••')}
                </td>
                <td>{r.changed ? <span className="badge-warn">غُيّرت</span> : <span className="badge-success">سارية</span>}</td>
                <td className="whitespace-nowrap">
                  {!r.changed && (
                    <>
                      <button type="button" className="text-primary-600 hover:underline text-sm ml-2" onClick={() => setRevealed((s) => ({ ...s, [i]: !s[i] }))}>
                        {revealed[i] ? 'إخفاء' : 'إظهار'}
                      </button>
                      <button type="button" className="text-primary-600 hover:underline text-sm" onClick={() => copyRow(r)}>نسخ</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted text-xs">ملاحظة أمنية: كلمات السر مخزنة مشفّرة في قاعدة البيانات، وهذه الشاشة تُسجَّل مشاهداتها في سجل التدقيق، وتُمسح الكلمة من التقرير تلقائياً عند تغييرها أو تصفيرها إدارياً.</p>
    </div>
  );
}
