import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';

const CAT_AR = { financial: 'مالية', operational: 'تشغيلية', strategic: 'استراتيجية' };
const CAT_ORDER = ['financial', 'operational', 'strategic'];

export default function ReportsCenter() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [views, setViews] = useState([]);
  const [cat, setCat] = useState('financial');
  const [running, setRunning] = useState(null);
  const [output, setOutput] = useState(null);

  useEffect(() => {
    client.get('/reports/catalog')
      .then(({ data }) => { setReports(data.reports); setViews(data.views); })
      .catch((e) => toast.error(errMsg(e)));
  }, []);

  function runReport(code) {
    setRunning(code);
    setOutput(null);
    client.get(`/reports/run/${code}`)
      .then(({ data }) => setOutput({ kind: 'report', ...data }))
      .catch((e) => { toast.error(errMsg(e)); setRunning(null); });
  }
  function runView(code) {
    setRunning(code);
    setOutput(null);
    client.get(`/reports/view/${code}`)
      .then(({ data }) => setOutput({ kind: 'view', ...data }))
      .catch((e) => { toast.error(errMsg(e)); setRunning(null); });
  }

  function exportCsv() {
    if (!output?.data) return;
    const rows = Array.isArray(output.data) ? output.data
      : output.data.employees || output.data.contracts || output.data.requests || output.data.transfers || output.data.promotions || output.data.records || output.data.rows || [];
    if (!rows.length) return toast.error('لا توجد صفوف للتصدير');
    const cols = Object.keys(rows[0]).filter((k) => typeof rows[0][k] !== 'object');
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${output.report?.code || output.view?.code || 'report'}.csv`;
    a.click();
  }

  const shown = reports.filter((r) => r.cat === cat);

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">مركز التقارير</h1>
        <p className="muted">28 تقريراً + 12 طريقة عرض بالأعمدة الموثقة — شركة الناضج.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CAT_ORDER.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cat === c ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
            {CAT_AR[c]} ({reports.filter((r) => r.cat === c).length})
          </button>
        ))}
        <button onClick={() => setCat('views')} className={cat === 'views' ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
          طرق العرض الـ 12
        </button>
      </div>

      {cat !== 'views' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((r) => (
            <div key={r.code} className="card-padded space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs badge-ink">{r.code}</span>
                <span className="text-xs text-ink-400">{r.audience}</span>
              </div>
              <div className="font-medium">{r.nameAr}</div>
              <button
                onClick={() => runReport(r.code)}
                disabled={!r.allowed || running === r.code}
                className={r.allowed ? 'btn-primary text-xs' : 'btn-secondary text-xs opacity-50 cursor-not-allowed'}>
                {running === r.code ? 'جاري التوليد…' : r.allowed ? 'توليد التقرير' : 'لا تملك الصلاحية'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {views.map((v) => (
            <div key={v.code} className="card-padded space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-mono text-xs badge-primary">{v.code}</span>
                <span className="text-xs text-ink-400">{v.cols} عموداً</span>
              </div>
              <div className="font-medium">{v.nameAr}</div>
              <button onClick={() => runView(v.code)} disabled={running === v.code} className="btn-primary text-xs">
                {running === v.code ? 'جاري التحميل…' : 'عرض البيانات'}
              </button>
            </div>
          ))}
        </div>
      )}

      {output && (
        <div className="card-padded space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="h3">
              {output.kind === 'report' ? `${output.report.code} — ${output.report.nameAr}` : `${output.view.code} — ${output.view.nameAr}`}
            </h2>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-ink-400">شركة الناضج — {new Date(output.generatedAt).toLocaleString('ar-SA')}</span>
              <button onClick={exportCsv} className="btn-secondary text-xs">تصدير CSV</button>
              <button onClick={() => setOutput(null)} className="btn-secondary text-xs">إغلاق</button>
            </div>
          </div>
          <DataTable data={output.data} />
        </div>
      )}
    </div>
  );
}

function DataTable({ data }) {
  const rows = Array.isArray(data) ? data
    : data.employees || data.contracts || data.requests || data.transfers || data.promotions || data.records || data.rows || data.runs || data.loans || data.visas || data.iqamas || data.reviews || null;

  if (!rows) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(data).filter(([, v]) => typeof v !== 'object').map(([k, v]) => (
          <div key={k} className="p-3 rounded-lg bg-ink-50">
            <div className="text-xs text-ink-500">{k}</div>
            <div className="font-bold text-lg">{String(v)}</div>
          </div>
        ))}
      </div>
    );
  }
  if (!rows.length) return <div className="text-ink-400 text-sm">لا توجد بيانات.</div>;

  const flat = rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (v && typeof v === 'object') {
        if (v.nameAr) o[k] = v.nameAr;
        else if (v.fullNameAr) o[k] = v.fullNameAr;
        else if (v.titleAr) o[k] = v.titleAr;
      } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        o[k] = new Date(v).toLocaleDateString('ar-SA');
      } else if (typeof v !== 'object') {
        o[k] = v;
      }
    }
    return o;
  });
  const cols = Object.keys(flat[0]).slice(0, 12);

  return (
    <div className="table-wrap max-h-[60vh] overflow-auto">
      <table className="text-xs">
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {flat.slice(0, 200).map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c}>{r[c] == null ? '—' : String(r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {flat.length > 200 && <div className="text-xs text-ink-400 p-2">يعرض أول 200 صف من {flat.length}</div>}
    </div>
  );
}
