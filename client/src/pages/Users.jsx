import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDateTime } from '../utils/datetime';

export default function Users() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [emps, setEmps] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ username: '', fullNameAr: '', email: '', password: '', roleId: null, status: 'active' });

  function load() {
    client.get('/admin/users').then(({ data }) => setList(data.users));
    client.get('/admin/roles').then(({ data }) => setRoles(data.roles));
    client.get('/hr/employees', { params: { search: '' } }).then(({ data }) => setEmps(data.employees));
  }
  useEffect(load, []);

  function save() {
    client.post('/admin/users', form).then(() => { toast.success('تم إنشاء المستخدم'); setShowNew(false); setForm({ username: '', fullNameAr: '', email: '', password: '', roleId: null, status: 'active' }); load(); }).catch((e) => toast.error(e.response?.data?.error));
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="h1">المستخدمون ({list.length})</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ مستخدم جديد</button>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">اسم المستخدم</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="input" /></div>
            <div><label className="label">الاسم الكامل</label><input value={form.fullNameAr} onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })} className="input" /></div>
            <div><label className="label">البريد</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" /></div>
            <div><label className="label">كلمة المرور (8+)</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" /></div>
            <div><label className="label">الدور</label>
              <select value={form.roleId || ''} onChange={(e) => setForm({ ...form, roleId: +e.target.value })} className="input">
                <option value="">اختر</option>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nameAr} ({r.code})</option>)}
              </select>
            </div>
            <div><label className="label">الحالة</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
                <option value="locked">مقفل</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>اسم المستخدم</th><th>الاسم</th><th>البريد</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th></tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="font-mono">{u.username}</td>
                <td className="font-medium">{u.fullNameAr}</td>
                <td className="text-xs">{u.email}</td>
                <td><span className="badge-primary">{u.role?.nameAr}</span></td>
                <td><span className={u.status === 'active' ? 'badge-success' : 'badge-ink'}>{u.status}</span></td>
                <td className="text-xs text-ink-500">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}