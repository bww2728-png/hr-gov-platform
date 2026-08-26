import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { SmartSelect } from '../components/fields/SmartSelect';
import { DateDual } from '../components/fields/DateDual';

export default function EmployeeNew() {
  const toast = useToast();
  const nav = useNavigate();
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employeeNumber: '', fullNameAr: '', fullNameEn: '', nationalId: '',
    nationality: 'SAU', gender: 'M', maritalStatus: 'single',
    dobGregorian: '', email: '', phone: '', hireDate: new Date().toISOString().slice(0, 10),
    contractType: 'full_time', branchId: '', deptId: '', positionId: '', managerId: '',
    salary: '', iban: '', bankName: '', notes: '',
  });

  useEffect(() => {
    client.get('/hr/branches').then(({ data }) => setBranches(data.branches));
    client.get('/hr/departments').then(({ data }) => setDepartments(data.departments));
    client.get('/hr/positions').then(({ data }) => setPositions(data.positions));
    client.get('/hr/employees').then(({ data }) => setEmployees(data.employees || []));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e) {
    e.preventDefault();
    client.post('/hr/employees', {
      ...form,
      branchId: Number(form.branchId), deptId: Number(form.deptId), positionId: Number(form.positionId),
      managerId: form.managerId || null, salary: Number(form.salary) || 0,
      dobGregorian: form.dobGregorian || null,
    }).then(() => { toast.success('تم إنشاء الموظف بنجاح'); nav('/employees'); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل الإنشاء'));
  }

  return (
    <div className="page space-y-4 max-w-4xl">
      <h1 className="h1">إضافة موظف جديد</h1>
      <form onSubmit={submit} className="space-y-4">
        <div className="card-padded space-y-3">
          <h2 className="h3">البيانات الأساسية</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="muted block mb-1">الرقم الوظيفي *</label>
              <input value={form.employeeNumber} onChange={(e) => set('employeeNumber', e.target.value)} required className="input w-full" placeholder="EMP-00026" /></div>
            <div><label className="muted block mb-1">الاسم الكامل (عربي) *</label>
              <input value={form.fullNameAr} onChange={(e) => set('fullNameAr', e.target.value)} required className="input w-full" /></div>
            <div><label className="muted block mb-1">الاسم (إنجليزي)</label>
              <input value={form.fullNameEn} onChange={(e) => set('fullNameEn', e.target.value)} className="input w-full" /></div>
            <div><label className="muted block mb-1">رقم الهوية/الإقامة</label>
              <input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} className="input w-full" /></div>
            <SmartSelect category="nationality" label="الجنسية" value={form.nationality} onChange={(v) => set('nationality', v)} />
            <SmartSelect category="gender" label="الجنس" value={form.gender} onChange={(v) => set('gender', v)} />
            <SmartSelect category="marital_status" label="الحالة الاجتماعية" value={form.maritalStatus} onChange={(v) => set('maritalStatus', v)} />
            <DateDual label="تاريخ الميلاد" value={form.dobGregorian} onChange={(v) => set('dobGregorian', v)} />
          </div>
        </div>

        <div className="card-padded space-y-3">
          <h2 className="h3">التواصل</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="muted block mb-1">البريد الإلكتروني</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="input w-full" /></div>
            <div><label className="muted block mb-1">الجوال</label>
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="input w-full" placeholder="05xxxxxxxx" /></div>
          </div>
        </div>

        <div className="card-padded space-y-3">
          <h2 className="h3">التوظيف</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DateDual label="تاريخ المباشرة *" value={form.hireDate} onChange={(v) => set('hireDate', v)} />
            <div><label className="muted block mb-1">الفرع *</label>
              <select value={form.branchId} onChange={(e) => set('branchId', e.target.value)} required className="input w-full">
                <option value="">اختر…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.nameAr}</option>)}
              </select></div>
            <div><label className="muted block mb-1">الإدارة *</label>
              <select value={form.deptId} onChange={(e) => set('deptId', e.target.value)} required className="input w-full">
                <option value="">اختر…</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.nameAr}</option>)}
              </select></div>
            <div><label className="muted block mb-1">المنصب *</label>
              <select value={form.positionId} onChange={(e) => set('positionId', e.target.value)} required className="input w-full">
                <option value="">اختر…</option>
                {positions.filter((p) => !form.deptId || p.deptId === Number(form.deptId)).map((p) => <option key={p.id} value={p.id}>{p.titleAr}</option>)}
              </select></div>
            <div><label className="muted block mb-1">المدير المباشر</label>
              <select value={form.managerId} onChange={(e) => set('managerId', e.target.value)} className="input w-full">
                <option value="">بدون</option>
                {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.fullNameAr}</option>)}
              </select></div>
            <SmartSelect category="contract_type" label="نوع العقد" value={form.contractType} onChange={(v) => set('contractType', v)} />
          </div>
        </div>

        <div className="card-padded space-y-3">
          <h2 className="h3">الراتب والبنك</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="muted block mb-1">الراتب الأساسي *</label>
              <input type="number" min={0} value={form.salary} onChange={(e) => set('salary', e.target.value)} required className="input w-full" /></div>
            <div><label className="muted block mb-1">البنك</label>
              <input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} className="input w-full" /></div>
            <div><label className="muted block mb-1">IBAN</label>
              <input value={form.iban} onChange={(e) => set('iban', e.target.value)} className="input w-full" placeholder="SA…" /></div>
          </div>
        </div>

        <div className="card-padded">
          <label className="muted block mb-1">ملاحظات</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} className="input w-full" rows={2} />
        </div>

        <div className="flex gap-2">
          <button className="btn-primary">حفظ الموظف</button>
          <button type="button" onClick={() => nav('/employees')} className="btn-secondary">إلغاء</button>
        </div>
      </form>
    </div>
  );
}
