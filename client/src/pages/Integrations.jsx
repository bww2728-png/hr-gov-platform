import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function Integrations() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code: '', nameAr: '', nameEn: '', baseUrl: '', authType: 'api_key', isActive: true });

  function load() {
    client.get('/admin/integrations').then(({ data }) => setList(data.endpoints));
  }
  useEffect(load, []);

  function save() {
    client.post('/admin/integrations', form).then(() => { toast.success('تم الإضافة'); setShowNew(false); load(); }).catch((e) => toast.error(e.response?.data?.error));
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="h1">التكاملات الخارجية</h1>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ تكامل جديد</button>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">الكود</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input" /></div>
            <div><label className="label">نوع المصادقة</label>
              <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })} className="input">
                <option value="api_key">API Key</option>
                <option value="oauth">OAuth</option>
                <option value="basic">Basic</option>
                <option value="none">بدون</option>
              </select>
            </div>
            <div><label className="label">الاسم (عربي)</label><input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className="input" /></div>
            <div><label className="label">الاسم (English)</label><input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className="input" /></div>
            <div className="col-span-2"><label className="label">URL الأساسي</label><input type="url" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="input" dir="ltr" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((ep) => (
          <div key={ep.id} className="card-padded">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{ep.nameAr}</div>
                <div className="text-xs text-ink-500">{ep.nameEn}</div>
              </div>
              <span className={`${ep.healthStatus === 'healthy' ? 'badge-success' : 'badge-warn'}`}>{ep.healthStatus}</span>
            </div>
            <div className="mt-2 text-xs font-mono text-ink-700 break-all" dir="ltr">{ep.baseUrl}</div>
            <div className="mt-2 flex gap-2">
              <span className="badge-ink">{ep.authType}</span>
              <span className={ep.isActive ? 'badge-success' : 'badge-ink'}>{ep.isActive ? 'مفعّل' : 'متوقف'}</span>
            </div>
            <div className="mt-2 text-xs text-ink-500">{ep._count?.logs || 0} طلب</div>
          </div>
        ))}
      </div>
    </div>
  );
}