/**
 * محرك التصدير الفاخر — Excel (exceljs) + PDF (html2pdf.js)
 * هوية موحدة: شركة الناضج — RTL — عربية مشكّلة مثالية.
 */
import ExcelJS from 'exceljs';
import html2pdf from 'html2pdf.js';

export const COMPANY = 'شركة الناضج';
export const PLATFORM = 'منصة الناضج لإدارة الموارد البشرية';
const BRAND = '3730A3'; // indigo-800
const BRAND_LIGHT = 'EEF2FF';
const BRAND_TEXT = '312E81';
const GRAY = '6B7280';
const BORDER = 'D1D5DB';

// ---------- قاموس التسميات العربية ----------
const AR_LABELS = {
  employeeNumber: 'الرقم الوظيفي', fullNameAr: 'الاسم', fullNameEn: 'الاسم (إنجليزي)', nameAr: 'الاسم',
  titleAr: 'المسمى', department: 'الإدارة', dept: 'الإدارة', section: 'القسم', branch: 'الفرع', position: 'المنصب',
  nationality: 'الجنسية', residentType: 'نوع الإقامة', gender: 'الجنس', birthDate: 'تاريخ الميلاد',
  email: 'البريد الإلكتروني', phone: 'الجوال', iban: 'الآيبان', nationalId: 'الهوية الوطنية',
  iqamaNumber: 'رقم الإقامة', passportNumber: 'رقم الجواز', sponsorCode: 'رمز الكفيل',
  jobCategoryCode: 'الفئة الوظيفية', employmentStatus: 'حالة التوظيف',
  salary: 'الراتب الأساسي', baseSalary: 'الراتب الأساسي', basicSalary: 'الراتب الأساسي',
  housing: 'بدل السكن', housingAllowance: 'بدل السكن', transport: 'بدل النقل', transportAllowance: 'بدل النقل',
  otherAllow: 'بدلات أخرى', otherAllowances: 'بدلات أخرى', overtimePay: 'أجر الإضافي', bonusPay: 'مكافآت',
  gosiEmployee: 'حصة التأمينات (الموظف)', gosiEmployer: 'حصة التأمينات (صاحب العمل)',
  loanDeduct: 'خصم السلف', absenceDeduct: 'خصم الغياب', otherDeduct: 'خصومات أخرى',
  gross: 'الإجمالي', net: 'الصافي',
  code: 'الكود', month: 'الشهر', year: 'السنة', status: 'الحالة', paymentDate: 'تاريخ الصرف',
  startDate: 'تاريخ البداية', endDate: 'تاريخ النهاية', hireDate: 'تاريخ التعيين',
  contractEndDate: 'انتهاء العقد', probationEndDate: 'نهاية التجربة', expiryDate: 'تاريخ الانتهاء',
  effectiveDate: 'تاريخ السريان', createdAt: 'تاريخ الإنشاء', date: 'التاريخ', withinDays: 'خلال أيام',
  amount: 'المبلغ', months: 'عدد الأشهر', employees: 'عدد الموظفين', totalSalary: 'إجمالي الرواتب',
  category: 'الفئة', count: 'العدد', saudi: 'سعوديون', total: 'الإجمالي',
  saudizationPct: 'نسبة السعودة %', turnoverPct: 'معدل الدوران %', monthlyEstimate: 'تقدير شهري',
  annualEstimate: 'تقدير سنوي', totalMonthlyCost: 'التكلفة الشهرية', costPerEmployee: 'التكلفة لكل موظف',
  objectives: 'الأهداف', keyResultsCompleted: 'نتائج مكتملة', keyResultsTotal: 'إجمالي النتائج',
  completionPct: 'نسبة الإنجاز %', criticalGaps: 'فجوات حرجة', openPostings: 'وظائف مفتوحة',
  pendingRequests: 'طلبات معلقة', type: 'النوع', reason: 'السبب', notes: 'ملاحظات',
  leaveType: 'نوع الإجازة', employee: 'الموظف', run: 'المسير', reviews: 'تقييمات التجربة',
};

const SECTION_TITLES = {
  employees: 'الموظفون', contracts: 'العقود', requests: 'الطلبات', transfers: 'التحويلات',
  promotions: 'الترقيات', records: 'السجلات', rows: 'الصفوف', runs: 'المسيرات', loans: 'السلف',
  visas: 'التأشيرات', iqamas: 'الإقامات', reviews: 'تقييمات فترة التجربة', balances: 'أرصدة الإجازات',
  overtime: 'العمل الإضافي', eos: 'حسابات نهاية الخدمة', plans: 'خطط التعاقب', items: 'البنود',
  payslip: 'كشف الراتب',
};

export function label(key) {
  if (AR_LABELS[key]) return AR_LABELS[key];
  return String(key).replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim();
}

// ---------- تطبيع المخرجات إلى أقسام ----------
export function cell(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    if (v.nameAr) return v.nameAr;
    if (v.fullNameAr) return v.fullNameAr;
    if (v.titleAr) return v.titleAr;
    if (v.code) return v.code;
    return '—';
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10);
  return v;
}

const isNum = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) && v.length < 15);
const CURRENCY_RE = /(salary|allow|net|gross|deduct|pay|gosi|amount|total|cost|estimate|transport|housing)/i;

function splitRow(row) {
  const flat = {};
  const childArrays = {};
  for (const [k, v] of Object.entries(row)) {
    if (Array.isArray(v)) { childArrays[k] = v.map((c) => splitRow(c)); continue; }
    if (v && typeof v === 'object') { flat[k] = cell(v); continue; }
    flat[k] = v;
  }
  return { flat, childArrays };
}

function sectionFromRows(title, arr) {
  const rows = [];
  const children = {};
  for (const item of arr) {
    const { flat, childArrays } = item && typeof item === 'object' ? splitRow(item) : { flat: { القيمة: item }, childArrays: {} };
    rows.push(flat);
    for (const [k, arr2] of Object.entries(childArrays)) {
      (children[k] = children[k] || []).push(...arr2.map((r) => ({ ...r, _parent: flat.fullNameAr || flat.code || flat.nameAr || '' })));
    }
  }
  const out = [{ title, type: 'table', rows }];
  for (const [k, arr2] of Object.entries(children)) {
    if (arr2.length) out.push(...sectionFromRows(`${SECTION_TITLES[k] || label(k)} (${title})`, arr2));
  }
  return out;
}

export function normalize(data) {
  if (data?.note) return [{ title: 'ملاحظة', type: 'note', text: data.note }];
  // كشف الراتب
  if (data?.payslip) {
    const p = data.payslip;
    const emp = p.employee || {};
    const run = p.run || {};
    return [
      { title: 'بيانات كشف الراتب', type: 'kpi', kpis: [
        { k: 'الموظف', v: emp.fullNameAr || '—' }, { k: 'الرقم الوظيفي', v: emp.employeeNumber || '—' },
        { k: 'الإدارة', v: emp.department?.nameAr || '—' }, { k: 'المنصب', v: emp.position?.titleAr || '—' },
        { k: 'المسير', v: `${run.code || ''} (${run.month}/${run.year})` }, { k: 'حالة المسير', v: run.status || '—' },
        { k: 'الآيبان', v: p.iban || '—' },
      ] },
      { title: 'المستحقات', type: 'table', rows: Object.entries(p.earnings || {}).map(([k, v]) => ({ البند: label(k), القيمة: Number(v) })) },
      { title: 'الاستقطاعات', type: 'table', rows: Object.entries(p.deductions || {}).map(([k, v]) => ({ البند: label(k), القيمة: Number(v) })) },
      { title: 'الملخص', type: 'kpi', kpis: [ { k: 'الإجمالي', v: Number(p.gross) }, { k: 'الصافي', v: Number(p.net) } ], money: true },
    ];
  }
  const sections = [];
  const kpis = [];
  for (const [k, v] of Object.entries(data || {})) {
    if (Array.isArray(v)) {
      if (v.length) sections.push(...sectionFromRows(SECTION_TITLES[k] || label(k), v));
    } else if (v && typeof v === 'object') {
      for (const [k2, v2] of Object.entries(v)) {
        if (Array.isArray(v2)) { if (v2.length) sections.push(...sectionFromRows(`${SECTION_TITLES[k2] || label(k2)} (${SECTION_TITLES[k] || label(k)})`, v2)); }
        else if (!['object'].includes(typeof v2)) kpis.push({ k: label(k2), v: cell(v2) });
      }
    } else {
      kpis.push({ k: label(k), v: cell(v) });
    }
  }
  if (kpis.length) sections.unshift({ title: 'مؤشرات التقرير', type: 'kpi', kpis, money: kpis.some((x) => CURRENCY_RE.test(x.k)) });
  return sections.length ? sections : [{ title: 'بيانات', type: 'note', text: 'لا توجد بيانات' }];
}

const sectionRowsFlat = (s) => {
  const cols = [];
  for (const r of s.rows) for (const k of Object.keys(r)) if (!cols.includes(k) && cols.length < 40) cols.push(k);
  return { cols, rows: s.rows };
};

const fmtVal = (v, col) => {
  if (isNum(v)) {
    const n = Number(v);
    return { num: n, money: CURRENCY_RE.test(col || '') };
  }
  return null;
};

// ---------- Excel ----------
export async function exportExcel(meta, data) {
  const sections = normalize(data).filter((s) => s.type !== 'note' || true);
  const wb = new ExcelJS.Workbook();
  wb.creator = PLATFORM;
  wb.created = new Date();
  const stamp = new Date().toISOString().slice(0, 10);

  for (const s of sections) {
    const ws = wb.addWorksheet((s.title || 'ورقة').slice(0, 30), { views: [{ rightToLeft: true, showGridLines: false }] });
    ws.columns = [{ width: 3 }, ...Array.from({ length: 12 }, () => ({ width: 18 }))];
    let r = 1;
    // الترويسة
    ws.mergeCells(r, 2, r, 8);
    ws.getCell(r, 2).value = `${COMPANY} — ${PLATFORM}`;
    ws.getCell(r, 2).font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
    ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(r).height = 30; r += 1;
    ws.mergeCells(r, 2, r, 8);
    ws.getCell(r, 2).value = `${meta.code} — ${meta.nameAr}`;
    ws.getCell(r, 2).font = { size: 12, bold: true, color: { argb: `FF${BRAND_TEXT}` } };
    ws.getCell(r, 2).alignment = { horizontal: 'center' }; r += 1;
    ws.mergeCells(r, 2, r, 8);
    ws.getCell(r, 2).value = `تاريخ التوليد: ${stamp}   |   المُصدِّر: ${meta.by || ''}`;
    ws.getCell(r, 2).font = { size: 9, color: { argb: `FF${GRAY}` } };
    ws.getCell(r, 2).alignment = { horizontal: 'center' }; r += 2;

    if (s.type === 'note') {
      ws.mergeCells(r, 2, r, 8);
      ws.getCell(r, 2).value = s.text;
      ws.getCell(r, 2).font = { size: 11, italic: true, color: { argb: `FF${GRAY}` } };
      continue;
    }
    if (s.type === 'kpi') {
      for (const { k, v } of s.kpis) {
        ws.getCell(r, 2).value = k;
        ws.getCell(r, 2).font = { bold: true, color: { argb: `FF${BRAND_TEXT}` } };
        ws.getCell(r, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_LIGHT}` } };
        ws.getCell(r, 2).border = { bottom: { style: 'thin', color: { argb: `FF${BRAND}` } } };
        const f = fmtVal(v, k);
        ws.getCell(r, 3).value = f ? f.num : String(v);
        if (f?.money) ws.getCell(r, 3).numFmt = '#,##0.00';
        ws.getCell(r, 3).border = { bottom: { style: 'thin', color: { argb: `FF${BORDER}` } } };
        r += 1;
      }
      r += 1; continue;
    }
    // جدول
    const { cols, rows } = sectionRowsFlat(s);
    const headerRow = ws.getRow(r);
    headerRow.getCell(2).value = '';
    cols.forEach((c, i) => {
      const cellH = headerRow.getCell(i + 2);
      cellH.value = label(c);
      cellH.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cellH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
      cellH.alignment = { horizontal: 'center', vertical: 'middle' };
      cellH.border = { bottom: { style: 'thin', color: { argb: `FF${BRAND_TEXT}` } } };
      ws.getColumn(i + 2).width = Math.min(30, Math.max(12, label(c).length + 4));
    });
    headerRow.height = 22;
    r += 1;
    rows.forEach((row, idx) => {
      const xrow = ws.getRow(r);
      cols.forEach((c, i) => {
        const xcell = xrow.getCell(i + 2);
        const f = fmtVal(row[c], c);
        xcell.value = f ? f.num : cell(row[c]);
        if (f?.money) xcell.numFmt = '#,##0.00';
        else if (f) xcell.numFmt = '#,##0';
        xcell.alignment = { horizontal: f ? 'right' : 'center' };
        if (idx % 2 === 1) xcell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_LIGHT}` } };
        xcell.border = { bottom: { style: 'hair', color: { argb: `FF${BORDER}` } } };
      });
      r += 1;
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${meta.code}-${stamp}.xlsx`);
}

// ---------- PDF ----------
export function exportPdf(meta, data) {
  const sections = normalize(data);
  const stamp = new Date().toISOString().slice(0, 10);
  const esc = (v) => String(v ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const secHtml = sections.map((s) => {
    if (s.type === 'note') return `<div class="note avoid">${esc(s.text)}</div>`;
    if (s.type === 'kpi') {
      return `<h2 class="avoid">${esc(s.title)}</h2><div class="kpis avoid">${s.kpis.map(({ k, v }) => `
        <div class="kpi"><div class="k">${esc(k)}</div><div class="v">${esc(typeof v === 'number' ? v.toLocaleString('en-US') : v)}</div></div>`).join('')}</div>`;
    }
    const { cols, rows } = sectionRowsFlat(s);
    const shown = rows.slice(0, 120);
    return `<h2 class="avoid">${esc(s.title)} <span class="cnt">(${rows.length})</span></h2>
      <table class="avoid"><thead><tr>${cols.map((c) => `<th>${esc(label(c))}</th>`).join('')}</tr></thead>
      <tbody>${shown.map((row, i) => `<tr class="${i % 2 ? 'z' : ''}">${cols.map((c) => {
        const f = fmtVal(row[c], c);
        return `<td class="${f ? 'num' : ''}">${esc(f ? f.num.toLocaleString('en-US', { minimumFractionDigits: f.money ? 2 : 0 }) : cell(row[c]))}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table>
      ${rows.length > shown.length ? `<div class="note">يعرض أول ${shown.length} صفاً من ${rows.length}</div>` : ''}`;
  }).join('');

  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, 'Noto Kufi Arabic', sans-serif; direction: rtl; color: #111827; font-size: 11px; }
    .head { background: linear-gradient(135deg, #312E81, #4338CA); color: #fff; padding: 18px 22px; border-radius: 0 0 14px 14px; }
    .head .co { font-size: 17px; font-weight: 800; }
    .head .pf { font-size: 10px; opacity: .85; margin-top: 2px; }
    .head .rt { font-size: 14px; font-weight: 700; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.3); }
    .head .mt { font-size: 9px; opacity: .8; margin-top: 3px; }
    h2 { color: #312E81; font-size: 13px; margin: 14px 0 6px; padding-right: 8px; border-right: 4px solid #4338CA; }
    h2 .cnt { color: #6B7280; font-size: 10px; font-weight: 400; }
    .note { color: #6B7280; font-size: 10px; margin: 6px 0; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .kpi { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 8px 10px; }
    .kpi .k { font-size: 9px; color: #4338CA; }
    .kpi .v { font-size: 13px; font-weight: 800; color: #1E1B4B; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th { background: #312E81; color: #fff; padding: 5px 6px; font-size: 10px; border: 1px solid #1E1B4B; }
    td { padding: 4px 6px; border: 1px solid #E5E7EB; text-align: center; font-size: 10px; }
    td.num { font-weight: 600; }
    tr.z td { background: #EEF2FF; }
    .foot { margin-top: 14px; padding-top: 6px; border-top: 1px solid #E5E7EB; color: #9CA3AF; font-size: 9px; text-align: center; }
  </style></head><body>
    <div class="head"><div class="co">${COMPANY}</div><div class="pf">${PLATFORM}</div>
      <div class="rt">${esc(meta.code)} — ${esc(meta.nameAr)}</div>
      <div class="mt">تاريخ التوليد: ${stamp}${meta.by ? `  |  المُصدِّر: ${esc(meta.by)}` : ''}</div></div>
    ${secHtml}
    <div class="foot">${COMPANY} — وثيقة مولدة آلياً من ${PLATFORM}</div>
  </body></html>`;

  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;background:#fff;';
  el.innerHTML = html;
  document.body.appendChild(el);
  return html2pdf().set({
    margin: [8, 8, 10, 8],
    filename: `${meta.code}-${stamp}.pdf`,
    image: { type: 'jpeg', quality: 0.96 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }).from(el).save().then(() => { setTimeout(() => el.remove(), 500); });
}

// ---------- CSV (إضافي) ----------
export function exportCsv(meta, data) {
  const sections = normalize(data).filter((s) => s.type === 'table');
  if (!sections.length) return false;
  const lines = [];
  for (const s of sections) {
    const { cols, rows } = sectionRowsFlat(s);
    lines.push(`# ${s.title}`);
    lines.push(cols.map(label).map((c) => JSON.stringify(c)).join(','));
    for (const row of rows) lines.push(cols.map((c) => JSON.stringify(cell(row[c]) ?? '')).join(','));
    lines.push('');
  }
  download(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `${meta.code}-${stamp()}.csv`);
  return true;
}
const stamp = () => new Date().toISOString().slice(0, 10);

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
