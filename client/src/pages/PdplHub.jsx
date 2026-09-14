import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDate } from '../utils/datetime';
import TabShell from '../components/TabShell';

const DSAR_STATUS_AR = {
  submitted: 'مقدم', in_progress: 'قيد المعالجة', completed: 'منفذ',
  rejected: 'مرفوض', extended: 'مُمدد',
};
const DSAR_TYPES_AR = {
  access: 'وصول', portable_copy: 'نسخة قابلة للنقل',
  rectification: 'تصحيح', erasure: 'إتلاف',
};
const SEVERITY_AR = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };

// ===== تبويب: طلبات أصحاب البيانات =====
function DsarQueue() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [decision, setDecision] = useState({ id: null, outcome: 'completed', resolution: '' });
  const [extend, setExtend] = useState({ id: null, reason: '' });

  function load() {
    client.get('/dsar', { params: status ? { status } : {} })
      .then(({ data }) => setRows(data.requests))
      .catch((e) => toast.error(e.response?.data?.error || 'فشل التحميل'));
  }
  useEffect(load, [status]);

  function submitDecision(e) {
    e.preventDefault();
    client.post(`/dsar/${decision.id}/decision`, { outcome: decision.outcome, resolution: decision.resolution })
      .then(() => { toast.success('تم البت في الطلب'); setDecision({ id: null, outcome: 'completed', resolution: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function submitExtend(e) {
    e.preventDefault();
    client.post(`/dsar/${extend.id}/extend`, { reason: extend.reason })
      .then(({ data }) => { toast.success(`تم التمديد ${data.extensionDays} يوماً`); setExtend({ id: null, reason: '' }); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function runErasure(id) {
    client.post(`/dsar/${id}/erasure`)
      .then(({ data }) => { toast.success(data.erasure || 'تم محو البيانات الشخصية'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  const active = rows.filter((r) => ['submitted', 'in_progress', 'extended'].includes(r.status));
  const closed = rows.filter((r) => !['submitted', 'in_progress', 'extended'].includes(r.status));

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <span className="text-sm text-ink-500">تصفية:</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input text-sm w-44">
          <option value="">الكل</option>
          {Object.entries(DSAR_STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <a href="#" onClick={(e) => { e.preventDefault(); client.get('/dsar', { params: status ? { status } : {} }).then(({ data }) => setRows(data.requests)); }} className="text-xs text-primary-600">تحديث</a>
      </div>

      <div className="card-padded">
        <h3 className="h3 mb-3">قائمة الانتظار ({active.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>صاحب الطلب</th><th>النوع</th><th>الحالة</th><th>موعد الرد</th><th>إجراءات</th></tr></thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.employee ? `${r.employee.fullNameAr} (${r.employee.employeeNumber})` : r.requesterName}</td>
                  <td>{DSAR_TYPES_AR[r.type] || r.type}</td>
                  <td><span className={r.status === 'extended' ? 'badge-warn' : 'badge-primary'}>{DSAR_STATUS_AR[r.status]}</span></td>
                  <td>{fmtDate(r.extendedDueDate || r.dueDate)}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setDecision({ id: r.id, outcome: 'completed', resolution: '' })} className="btn-primary text-xs px-2 py-1">تنفيذ</button>
                      <button onClick={() => setDecision({ id: r.id, outcome: 'rejected', resolution: '' })} className="btn-secondary text-xs px-2 py-1">رفض مسبب</button>
                      <button onClick={() => setExtend({ id: r.id, reason: '' })} className="btn-secondary text-xs px-2 py-1">تمديد 30</button>
                      <a href={`/api/dsar/${r.id}/export?format=json`} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-2 py-1">نسخة JSON</a>
                      <a href={`/api/dsar/${r.id}/export?format=csv`} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-2 py-1">CSV</a>
                      {r.type === 'erasure' && <button onClick={() => runErasure(r.id)} className="btn-danger text-xs px-2 py-1">محو البيانات</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!active.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد طلبات مفتوحة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card-padded">
        <h3 className="h3 mb-3">المنتهية ({closed.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>صاحب الطلب</th><th>النوع</th><th>الحالة</th><th>النتيجة</th></tr></thead>
            <tbody>
              {closed.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.employee ? r.employee.fullNameAr : r.requesterName}</td>
                  <td>{DSAR_TYPES_AR[r.type] || r.type}</td>
                  <td><span className={r.status === 'completed' ? 'badge-success' : 'badge-danger'}>{DSAR_STATUS_AR[r.status]}</span></td>
                  <td className="text-xs text-ink-500 max-w-[300px] truncate">{r.resolution || '—'}</td>
                </tr>
              ))}
              {!closed.length && <tr><td colSpan={5} className="text-center text-ink-400">لا توجد طلبات منتهية</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {decision.id && (
        <form onSubmit={submitDecision} className="card-padded space-y-2">
          <h3 className="h3">بت الطلب #{decision.id} — {decision.outcome === 'completed' ? 'تنفيذ' : 'رفض مسبب'}</h3>
          <textarea value={decision.resolution} onChange={(e) => setDecision({ ...decision, resolution: e.target.value })} required minLength={3} placeholder="القرار والسبب (إلزامي وفق م12)" className="input w-full" rows={2} />
          <div className="flex gap-2">
            <button className="btn-primary">تثبيت القرار</button>
            <button type="button" onClick={() => setDecision({ id: null, outcome: 'completed', resolution: '' })} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      )}

      {extend.id && (
        <form onSubmit={submitExtend} className="card-padded space-y-2">
          <h3 className="h3">تمديد مهلة الطلب #{extend.id} (+30 يوماً بإشعار مسبب)</h3>
          <textarea value={extend.reason} onChange={(e) => setExtend({ ...extend, reason: e.target.value })} required minLength={3} placeholder="سبب التمديد (إلزامي — إشعار مسبب)" className="input w-full" rows={2} />
          <div className="flex gap-2">
            <button className="btn-primary">تثبيت التمديد</button>
            <button type="button" onClick={() => setExtend({ id: null, reason: '' })} className="btn-secondary">إلغاء</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ===== تبويب: سجل أنشطة المعالجة (م33) =====
const EMPTY_ROPA = {
  activityName: '', purpose: '', legalBasis: '', dataCategories: '',
  dataSubjectCategories: '', recipientCategories: '', retentionPeriod: '',
  securityMeasures: '', internationalTransfer: false, transferDestination: '', transferSafeguards: '',
};
function RopaRegister() {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState(EMPTY_ROPA);
  const [editingId, setEditingId] = useState(null);

  function load() {
    client.get('/ropa').then(({ data }) => setEntries(data.entries)).catch((e) => toast.error(e.response?.data?.error || 'فشل التحميل'));
  }
  useEffect(load, []);

  function save(e) {
    e.preventDefault();
    const req = editingId ? client.patch(`/ropa/${editingId}`, form) : client.post('/ropa', form);
    req.then(() => { toast.success(editingId ? 'تم التعديل' : 'تمت الإضافة'); setForm(EMPTY_ROPA); setEditingId(null); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function edit(x) {
    setEditingId(x.id);
    setForm({ ...EMPTY_ROPA, ...x });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card-padded space-y-2">
        <h3 className="h3">{editingId ? `تعديل سجل #${editingId}` : 'إضافة نشاط معالجة (حقول المادة 33)'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={form.activityName} onChange={(e) => setForm({ ...form, activityName: e.target.value })} required placeholder="اسم نشاط المعالجة" className="input" />
          <input value={form.legalBasis} onChange={(e) => setForm({ ...form, legalBasis: e.target.value })} required placeholder="الأساس القانوني (موافقة/تعاقد/التزام نظامي…)" className="input" />
          <input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required placeholder="الغرض" className="input" />
          <input value={form.dataCategories} onChange={(e) => setForm({ ...form, dataCategories: e.target.value })} required placeholder="فئات البيانات (هوية/مالية/صحية…)" className="input" />
          <input value={form.dataSubjectCategories} onChange={(e) => setForm({ ...form, dataSubjectCategories: e.target.value })} required placeholder="فئات أصحاب البيانات (موظفين/مرشحين…)" className="input" />
          <input value={form.recipientCategories} onChange={(e) => setForm({ ...form, recipientCategories: e.target.value })} required placeholder="فئات المستلمين (داخلي/خارجي)" className="input" />
          <input value={form.retentionPeriod} onChange={(e) => setForm({ ...form, retentionPeriod: e.target.value })} required placeholder="مدة الاحتفاظ" className="input" />
          <input value={form.securityMeasures} onChange={(e) => setForm({ ...form, securityMeasures: e.target.value })} required placeholder="التدابير الأمنية" className="input" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.internationalTransfer} onChange={(e) => setForm({ ...form, internationalTransfer: e.target.checked })} />
            نقل خارجي للبيانات
          </label>
          {form.internationalTransfer && (
            <>
              <input value={form.transferDestination || ''} onChange={(e) => setForm({ ...form, transferDestination: e.target.value })} placeholder="وجهة النقل" className="input" />
              <input value={form.transferSafeguards || ''} onChange={(e) => setForm({ ...form, transferSafeguards: e.target.value })} placeholder="الضمانات" className="input" />
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary">{editingId ? 'حفظ التعديل' : 'إضافة للسجل'}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_ROPA); }} className="btn-secondary">إلغاء</button>}
        </div>
      </form>

      <div className="card-padded">
        <h3 className="h3 mb-3">سجل أنشطة المعالجة ({entries.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>النشاط</th><th>الغرض</th><th>الأساس</th><th>فئات البيانات</th><th>الاحتفاظ</th><th>نقل خارجي</th><th></th></tr></thead>
            <tbody>
              {entries.map((x) => (
                <tr key={x.id} className={x.active === false ? 'opacity-50' : ''}>
                  <td>{x.activityName}</td>
                  <td className="max-w-[200px] truncate">{x.purpose}</td>
                  <td className="max-w-[140px] truncate">{x.legalBasis}</td>
                  <td className="max-w-[160px] truncate">{x.dataCategories}</td>
                  <td>{x.retentionPeriod}</td>
                  <td>{x.internationalTransfer ? `${x.transferDestination || 'نعم'}` : 'لا'}</td>
                  <td><button onClick={() => edit(x)} className="btn-secondary text-xs px-2 py-1">تعديل</button></td>
                </tr>
              ))}
              {!entries.length && <tr><td colSpan={7} className="text-center text-ink-400">السجل فارغ — أضف أول نشاط معالجة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== تبويب: حوادث التسرب + عداد سدايا =====
const EMPTY_BREACH = { title: '', severity: 'medium', description: '', affectedCategories: '', containmentActions: '' };
function Breaches() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [sdaiaHours, setSdaiaHours] = useState(72);
  const [form, setForm] = useState(EMPTY_BREACH);

  function load() {
    client.get('/breaches')
      .then(({ data }) => { setRows(data.incidents); setSdaiaHours(data.sdaiaHours); })
      .catch((e) => toast.error(e.response?.data?.error || 'فشل التحميل'));
  }
  useEffect(load, []);

  function save(e) {
    e.preventDefault();
    client.post('/breaches', form)
      .then(() => { toast.success('تم تسجيل الحادث وإشعار مسؤول حماية البيانات'); setForm(EMPTY_BREACH); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function notifySdaia(id) {
    client.post(`/breaches/${id}/notify-sdaia`)
      .then(() => { toast.success('تم تثبيت وقت الإبلاغ لسدايا'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }
  function setStatus(id, status) {
    client.post(`/breaches/${id}/status`, { status })
      .then(() => { toast.success('تم تحديث الحالة'); load(); })
      .catch((err) => toast.error(err.response?.data?.error || 'فشل'));
  }

  function windowBadge(w) {
    if (w.overdue) return <span className="badge-danger">انقضت المهلة</span>;
    if (w.urgent) return <span className="badge-danger">متبقٍ {w.remainingHours} ساعة</span>;
    return <span className="badge-warn">متبقٍ {w.remainingHours} ساعة</span>;
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card-padded space-y-2">
        <h3 className="h3">تسجيل حادث تسرب بيانات</h3>
        <p className="text-xs text-ink-500">الإبلاغ لسدايا إلزامي خلال {sdaiaHours} ساعة من الاكتشاف — يُنشأ إشعار تلقائي لمسؤول حماية البيانات</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="عنوان الحادث" className="input" />
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="input">
            {Object.entries(SEVERITY_AR).map(([k, v]) => <option key={k} value={k}>خطورة {v}</option>)}
          </select>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="الوصف" className="input md:col-span-2" rows={2} />
          <input value={form.affectedCategories} onChange={(e) => setForm({ ...form, affectedCategories: e.target.value })} placeholder="فئات البيانات المتأثرة (اختياري)" className="input" />
          <input value={form.containmentActions} onChange={(e) => setForm({ ...form, containmentActions: e.target.value })} placeholder="إجراءات الاحتواء (اختياري)" className="input" />
        </div>
        <button className="btn-primary">تسجيل الحادث</button>
      </form>

      <div className="card-padded">
        <h3 className="h3 mb-3">الحوادث ({rows.length})</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>العنوان</th><th>الخطورة</th><th>الاكتشاف</th><th>عداد سدايا</th><th>الحالة</th><th>إجراءات</th></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.title}</td>
                  <td><span className={b.severity === 'critical' || b.severity === 'high' ? 'badge-danger' : 'badge-warn'}>{SEVERITY_AR[b.severity]}</span></td>
                  <td>{fmtDate(b.detectedAt)}</td>
                  <td>{b.sdaiaNotifiedAt ? <span className="badge-success">أُبلغ {fmtDate(b.sdaiaNotifiedAt)}</span> : windowBadge(b.sdaiaWindow)}</td>
                  <td>{b.status === 'closed' ? 'مغلق' : b.status === 'contained' ? 'محتوى' : 'مفتوح'}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {!b.sdaiaNotifiedAt && <button onClick={() => notifySdaia(b.id)} className="btn-primary text-xs px-2 py-1">تثبيت الإبلاغ لسدايا</button>}
                      {b.status === 'open' && <button onClick={() => setStatus(b.id, 'contained')} className="btn-secondary text-xs px-2 py-1">احتواء</button>}
                      {b.status !== 'closed' && <button onClick={() => setStatus(b.id, 'closed')} className="btn-secondary text-xs px-2 py-1">إغلاق</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-center text-ink-400">لا توجد حوادث مسجلة</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PdplHub() {
  return (
    <div className="page space-y-4">
      <h1 className="h1">حماية البيانات الشخصية — PDPL</h1>
      <p className="text-sm text-ink-500">منظومة مسؤول حماية البيانات: طلبات أصحاب البيانات (م12)، سجل أنشطة المعالجة (م33)، حوادث التسرب والإبلاغ لسدايا (72 ساعة)</p>
      <TabShell
        tabs={[
          { key: 'dsar', label: 'طلبات أصحاب البيانات', perm: 'pdpl.read', component: DsarQueue },
          { key: 'ropa', label: 'سجل المعالجة (RoPA)', perm: 'pdpl.read', component: RopaRegister },
          { key: 'breaches', label: 'حوادث التسرب', perm: 'pdpl.read', component: Breaches },
        ]}
      />
    </div>
  );
}
