import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { fmtDateTime } from '../utils/datetime';

export default function Decisions() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [verify, setVerify] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ titleAr: '', contextMarkdown: '', decisionMarkdown: '' });

  function load() {
    client.get('/knowledge/decisions').then(({ data }) => setList(data.decisions));
    client.get('/knowledge/decisions/verify').then(({ data }) => setVerify(data)).catch(() => {});
  }
  useEffect(load, []);

  function save() {
    client.post('/knowledge/decisions', form).then(() => {
      toast.success('تم تسجيل القرار + hash chain');
      setShowNew(false);
      setForm({ titleAr: '', contextMarkdown: '', decisionMarkdown: '' });
      load();
    }).catch((e) => toast.error(e.response?.data?.error));
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">سجل القرارات (ADR)</h1>
          <p className="muted">سلسلة SHA-256 غير قابلة للتعديل</p>
        </div>
        <div className="flex gap-2">
          {verify && (
            <div className={`px-3 py-2 rounded-lg text-sm ${verify.intact ? 'bg-green-50 text-success-600' : 'bg-red-50 text-danger-600'}`}>
              {verify.intact ? '✓ السلسلة سليمة' : '✗ السلسلة مكسورة'} ({verify.total} قرار)
            </div>
          )}
          <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ قرار جديد</button>
        </div>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <h3 className="h3">تسجيل قرار</h3>
          <div><label className="label">العنوان</label><input value={form.titleAr} onChange={(e) => setForm({ ...form, titleAr: e.target.value })} className="input" /></div>
          <div><label className="label">السياق (لماذا)</label><textarea value={form.contextMarkdown} onChange={(e) => setForm({ ...form, contextMarkdown: e.target.value })} className="textarea min-h-[80px]" /></div>
          <div><label className="label">القرار (ماذا)</label><textarea value={form.decisionMarkdown} onChange={(e) => setForm({ ...form, decisionMarkdown: e.target.value })} className="textarea min-h-[80px]" /></div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">تسجيل</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {list.map((d) => (
          <div key={d.id} className="card-padded">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="h3">{d.titleAr}</h3>
                <p className="muted text-xs">{d.code} • {fmtDateTime(d.decidedAt)}</p>
              </div>
              <div className="text-xs">
                <span className="badge-ink font-mono">hash: {d.currentHash?.slice(0, 16)}...</span>
              </div>
            </div>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-primary-600 hover:underline">السياق والقرار</summary>
              <div className="mt-2 space-y-2">
                <div><strong>السياق:</strong> {d.contextMarkdown}</div>
                <div><strong>القرار:</strong> {d.decisionMarkdown}</div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}