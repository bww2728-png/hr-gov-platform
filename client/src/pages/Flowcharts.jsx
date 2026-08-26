import React, { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import client from '../api/client';

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose', flowchart: { htmlLabels: true } });

function MermaidDiagram({ code, id }) {
  const ref = useRef(null);
  const [svg, setSvg] = useState('');
  useEffect(() => {
    let alive = true;
    mermaid.render(`mmd-${id}`, code).then(({ svg }) => { if (alive) setSvg(svg); }).catch(() => setSvg('<p class="text-danger-600 text-xs">تعذر عرض المخطط</p>'));
    return () => { alive = false; };
  }, [code, id]);
  return <div ref={ref} className="overflow-x-auto bg-white rounded-lg p-3" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function Flowcharts() {
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    client.get('/knowledge/documents', { params: { category: 'flowchart', limit: 100 } })
      .then(({ data }) => setDocs(data.documents || data.docs || []))
      .catch(() => {});
  }, []);

  const modules = useMemo(() => [...new Set(docs.map((d) => d.tags?.[1]).filter(Boolean))], [docs]);
  const filtered = useMemo(() => docs.filter((d) => {
    if (moduleFilter && d.tags?.[1] !== moduleFilter) return false;
    if (search && !d.titleAr.includes(search)) return false;
    return true;
  }), [docs, search, moduleFilter]);

  function extractMermaid(md) {
    const m = md?.match(/```mermaid\n([\s\S]*?)```/);
    return m ? m[1] : null;
  }

  return (
    <div className="page space-y-4">
      <h1 className="h1">مرجع المعاملات — 69 مخططاً حياً</h1>
      <p className="text-sm text-ink-500">كل معاملة موثقة بمخطط تدفقي تفاعلي ومربوطة بوحدتها في النظام.</p>

      <div className="flex gap-2 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المعاملات…" className="input w-64" />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="input w-48">
          <option value="">كل الوحدات</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span className="badge-primary self-center">{filtered.length} معاملة</span>
      </div>

      <div className="space-y-2">
        {filtered.map((d) => {
          const code = extractMermaid(d.contentMarkdown);
          const isOpen = openId === d.id;
          return (
            <div key={d.id} className="card-padded">
              <button onClick={() => setOpenId(isOpen ? null : d.id)} className="w-full flex justify-between items-center text-start">
                <span className="font-medium">{d.titleAr}</span>
                <span className="flex gap-2 items-center">
                  <span className="badge-ink">{d.tags?.[1]}</span>
                  <span className="text-ink-400">{isOpen ? '▲' : '▼'}</span>
                </span>
              </button>
              {isOpen && code && <div className="mt-3"><MermaidDiagram code={code} id={d.id} /></div>}
            </div>
          );
        })}
        {!filtered.length && <div className="text-ink-400 text-sm">لا توجد نتائج</div>}
      </div>
    </div>
  );
}
