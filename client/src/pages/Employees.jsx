import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client, { errMsg } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SmartSelect } from '../components/fields/SmartSelect';
import ImportEmployeesModal from '../components/ImportEmployeesModal';

export default function Employees() {
  const { has } = useAuth();
  const toast = useToast();
  const [list, setList] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    client.get('/hr/branches').then(({ data }) => setBranches(data.branches));
    client.get('/hr/departments').then(({ data }) => setDepartments(data.departments));
  }, []);

  function load() {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (branchFilter) params.branchId = branchFilter;
    if (statusFilter) params.status = statusFilter;
    client.get('/hr/employees', { params }).then(({ data }) => setList(data.employees)).finally(() => setLoading(false));
  }
  useEffect(load, [search, branchFilter, statusFilter]);

  function statusBadge(s) {
    const map = {
      active: 'badge-success',
      notice_period: 'badge-warn',
      on_leave: 'badge-primary',
      terminated: 'badge-danger',
    };
    const labels = { active: 'نشط', notice_period: 'فترة إنذار', on_leave: 'إجازة', terminated: 'منتهية' };
    return <span className={map[s] || 'badge-ink'}>{labels[s] || s}</span>;
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">الموظفون</h1>
          <p className="muted">{list.length} موظف</p>
        </div>
        {has('hr.employee.write') && (
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setImportOpen(true)}>⬆ استيراد من Excel</button>
            <Link to="/employees/new" className="btn-primary">+ إضافة موظف</Link>
          </div>
        )}
      </div>

      <ImportEmployeesModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => load()}
      />

      <div className="card-padded flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label">بحث</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اسم، رقم وظيفي، هوية..." className="input" />
        </div>
        <div className="w-48">
          <label className="label">الفرع</label>
          <select value={branchFilter || ''} onChange={(e) => setBranchFilter(e.target.value ? +e.target.value : null)} className="input">
            <option value="">كل الفروع</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
          </select>
        </div>
        <div className="w-48">
          <label className="label">الحالة</label>
          <select value={statusFilter || ''} onChange={(e) => setStatusFilter(e.target.value || null)} className="input">
            <option value="">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="notice_period">فترة إنذار</option>
            <option value="on_leave">إجازة</option>
            <option value="terminated">منتهية</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الاسم</th>
              <th>المنصب</th>
              <th>القسم</th>
              <th>الفرع</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-6 text-ink-500">جاري التحميل...</td></tr>}
            {!loading && list.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-ink-500">لا توجد بيانات</td></tr>}
            {list.map((e) => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{e.employeeNumber}</td>
                <td className="font-medium">{e.fullNameAr}</td>
                <td>{e.position?.titleAr}</td>
                <td>{e.department?.nameAr}</td>
                <td>{e.branch?.nameAr}</td>
                <td>{statusBadge(e.employmentStatus)}</td>
                <td><Link to={`/employees/${e.id}`} className="text-primary-600 hover:underline text-sm">عرض</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}