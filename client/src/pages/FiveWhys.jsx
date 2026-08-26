import React, { useEffect, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

export default function FiveWhys() {
  const toast = useToast();
  const [list, setList] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', problemDesc: '', treeJson: { why1: { text: '' } }, rootCause: '', correctiveAction: '' });

  function load() {
    client.get('/analytics/fivewhys').then(({ data }) => setList(data.analyses));
  }
  useEffect(load, []);

  function save() {
    client.post('/analytics/fivewhys', form).then(() => {
      toast.success('تم حفظ التحليل');
      setShowNew(false);
      setForm({ title: '', problemDesc: '', treeJson: { why1: { text: '' } }, rootCause: '', correctiveAction: '' });
      load();
    });
  }

  function updateWhy(level, text) {
    const newTree = JSON.parse(JSON.stringify(form.treeJson));
    newTree[`why${level}`] = { ...newTree[`why${level}`], text };
    setForm({ ...form, treeJson: newTree });
  }

  return (
    <div className="page space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h1">تحليل 5 Whys</h1>
          <p className="muted">يكشف الجذر وليس الأعراض</p>
        </div>
        <button onClick={() => setShowNew((s) => !s)} className="btn-primary">+ تحليل جديد</button>
      </div>

      {showNew && (
        <div className="card-padded space-y-3">
          <div><label className="label">العنوان</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" /></div>
          <div><label className="label">وصف المشكلة</label><textarea value={form.problemDesc} onChange={(e) => setForm({ ...form, problemDesc: e.target.value })} className="textarea" /></div>
          <div className="space-y-2 border-s-4 border-primary-400 ps-4">
            {[1,2,3,4,5].map((lvl) => (
              <div key={lvl}>
                <label className="label text-sm">لماذا #{lvl}</label>
                <input value={form.treeJson[`why${lvl}`]?.text || ''} onChange={(e) => updateWhy(lvl, e.target.value)} className="input" />
              </div>
            ))}
          </div>
          <div><label className="label">السبب الجذري</label><textarea value={form.rootCause} onChange={(e) => setForm({ ...form, rootCause: e.target.value })} className="textarea" /></div>
          <div><label className="label">الإجراء التصحيحي</label><textarea value={form.correctiveAction} onChange={(e) => setForm({ ...form, correctiveAction: e.target.value })} className="textarea" /></div>
          <div className="flex gap-2">
            <button onClick={save} className="btn-primary">حفظ</button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">إلغاء</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {list.map((fw) => (
          <div key={fw.id} className="card-padded">
            <h3 className="h3">{fw.title}</h3>
            <p className="muted mt-1">{fw.problemDesc}</p>
            <div className="mt-3 border-s-4 border-primary-300 ps-4 space-y-2">
              {fw.treeJson && [1,2,3,4,5].map((lvl) => {
                const w = fw.treeJson[`why${lvl}`];
                if (!w?.text) return null;
                return (
                  <div key={lvl} className="text-sm">
                    <span className="badge-primary ms-2">لماذا #{lvl}</span>
                    <span className="text-ink-700">{w.text}</span>
                  </div>
                );
              })}
            </div>
            {fw.rootCause && <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm"><strong>الجذر:</strong> {fw.rootCause}</div>}
            {fw.correctiveAction && <div className="mt-2 p-3 bg-green-50 rounded-lg text-sm"><strong>الإجراء:</strong> {fw.correctiveAction}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}