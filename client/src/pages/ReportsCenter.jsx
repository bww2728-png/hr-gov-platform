import React, { useEffect, useState } from 'react';
import client, { errMsg } from '../api/client';
import { useToast } from '../context/ToastContext';
import { normalize, label, cell, exportExcel, exportPdf, exportCsv, COMPANY, PLATFORM } from '../utils/exporters';

const CAT_AR = { financial: 'مالية', operational: 'تشغيلية', strategic: 'استراتيجية' };
const CAT_ORDER = ['financial', 'operational', 'strategic'];

export default function ReportsCenter() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [views, setViews] = useState([]);
  const [cat, setCat] = useState('financial');
  const [running, setRunning] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [output, setOutput] = useState(null);
  const [by, setBy] = useState('');

  useEffect(() => {
    client.get('/reports/catalog')
      .then(({ data }) => { setReports(data.reports); setViews(data.views); })
      .catch((e) => toast.error(errMsg(e)));
    client.get('/auth/me').then(({ data }) => setBy(data.user?.fullNameAr || data.user?.username || '')).catch(() => {});
  }, []);

  function run(url, code) {
    setRunning(code);
    setOutput(null);
    client.get(url)
      .then(({ data }) => { setOutput(data); setRunning(null); })
      .catch((e) => { toast.error(errMsg(e)); setRunning(null); });
  }
  const runReport = (code) => run(`/reports/run/${code}`, code);
  const runView = (code) => run(`/reports/view/${code}`, code);

  function doExport(kind) {
    if (!output) return;
    const meta = {
      code: output.report?.code || output.view?.code || 'REPORT',
      nameAr: output.report?.nameAr || output.view?.nameAr || '',
      by,
    };
    setExporting(kind);
    const p = kind === 'xlsx' ? exportExcel(meta, output.data)
      : kind === 'pdf' ? Promise.resolve(exportPdf(meta, output.data))
      : Promise.resolve(exportCsv(meta, output.data) ? null : Promise.reject(new Error('لا توجد جداول للتصدير CSV')));
    Promise.resolve(p)
      .then(() => toast.success(`تم تصدير ${kind === 'xlsx' ? 'ملف Excel' : kind === 'pdf' ? 'ملف PDF' : 'ملف CSV'} بنجاح`))
      .catch((e) => toast.error('تعذر التصدير: ' + (e?.message || 'خطأ غير متوقع')))
      .finally(() => setExporting(null));
  }

  const shown = reports.filter((r) => r.cat === cat);
  const sections = output ? normalize(output.data) : [];

  return (
    <div className="page space-y-4">
      <div>
        <h1 className="h1">مركز التقارير</h1>
        <p className="muted">28 تقريراً + 12 طريقة عرض — تصدير Excel وPDF بهوية {COMPANY}.</p>
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
        <div className="card-padded space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="h3">{output.report ? `${output.report.code} — ${output.report.nameAr}` : `${output.view.code} — ${output.view.nameAr}`}</h2>
              <div className="text-xs text-ink-400 mt-1">{COMPANY} — {new Date(output.generatedAt).toLocaleString('ar-SA')}</div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <button onClick={() => doExport('xlsx')} disabled={exporting === 'xlsx'} className="btn-primary text-xs">
                {exporting === 'xlsx' ? 'جاري التصدير…' : 'تصدير Excel'}
              </button>
              <button onClick={() => doExport('pdf')} disabled={exporting === 'pdf'} className="btn-primary text-xs">
                {exporting === 'pdf' ? 'جاري التصدير…' : 'تصدير PDF'}
              </button>
              <button onClick={() => doExport('csv')} disabled={exporting === 'csv'} className="btn-secondary text-xs">CSV</button>
              <button onClick={() => setOutput(null)} className="btn-secondary text-xs">إغلاق</button>
            </div>
          </div>

          {sections.map((s, i) => (
            <div key={i} className="space-y-2">
              {s.type === 'note' ? (
                <div className="p-3 rounded-lg bg-ink-50 text-sm text-ink-500">{s.text}</div>
              ) : s.type === 'kpi' ? (
                <>
                  <h3 className="h4">{s.title}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {s.kpis.map(({ k, v }, j) => (
                      <div key={j} className="p-3 rounded-lg bg-ink-50">
                        <div className="text-xs text-ink-500">{k}</div>
                        <div className="font-bold text-lg">{typeof v === 'number' ? v.toLocaleString('en-US') : String(v)}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <h3 className="h4">{s.title} <span className="text-xs text-ink-400">({s.rows.length})</span></h3>
                  <SectionTable section={s} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionTable({ section }) {
  const cols = [];
  for (const r of section.rows) for (const k of Object.keys(r)) if (!cols.includes(k) && cols.length < 40) cols.push(k);
  if (!cols.length) return <div className="text-ink-400 text-sm">لا توجد بيانات.</div>;
  return (
    <div className="table-wrap max-h-[60vh] overflow-auto">
      <table className="text-xs">
        <thead><tr>{cols.map((c) => <th key={c}>{label(c)}</th>)}</tr></thead>
        <tbody>
          {section.rows.slice(0, 200).map((r, i) => (
            <tr key={i}>{cols.map((c) => (
              <td key={c} className={typeof r[c] === 'number' ? 'font-semibold' : ''}>
                {typeof r[c] === 'number' ? r[c].toLocaleString('en-US') : String(cell(r[c]))}
              </td>
            ))}</tr>
          ))}
        </tbody>
      </table>
      {section.rows.length > 200 && <div className="text-xs text-ink-400 p-2">يعرض أول 200 صف من {section.rows.length}</div>}
    </div>
  );
}
