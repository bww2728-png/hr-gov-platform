import React, { useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { errMsg } from '../api/client';
import { COMPANY, PLATFORM } from '../utils/exporters';

const BRAND = '3730A3';
const BRAND_LIGHT = 'EEF2FF';

// رؤوس القالب بالترتيب + الدليل
const COLUMNS = [
  { key: 'employeeNumber', header: 'رقم الموظف *', required: true, guide: 'الرقم الوظيفي — إلزامي وفريد (يصبح اسم الدخول). مثال: EMP-101' },
  { key: 'fullNameAr', header: 'الاسم الكامل *', required: true, guide: 'الاسم بالعربي كما في الهوية — إلزامي' },
  { key: 'hireDate', header: 'تاريخ المباشرة *', required: true, guide: 'إلزامي — بصيغة YYYY-MM-DD مثل 2026-01-15' },
  { key: 'branchName', header: 'الفرع *', required: true, guide: 'إلزامي — اسم الفرع كما هو في النظام حرفياً (من شاشة الهيكل التنظيمي)' },
  { key: 'deptName', header: 'الإدارة *', required: true, guide: 'إلزامي — اسم الإدارة كما هو في النظام حرفياً' },
  { key: 'positionTitle', header: 'المنصب *', required: true, guide: 'إلزامي — المسمى الوظيفي كما هو في النظام حرفياً' },
  { key: 'salary', header: 'الراتب الأساسي', required: false, guide: 'اختياري — رقم فقط بلا فواصل (افتراضي 0)' },
  { key: 'gender', header: 'الجنس', required: false, guide: 'اختياري — اكتب: ذكر أو أنثى' },
  { key: 'nationality', header: 'الجنسية', required: false, guide: 'اختياري — نص حر مثل: سعودي' },
  { key: 'nationalId', header: 'رقم الهوية / الإقامة', required: false, guide: 'اختياري — فريد إن وُجد' },
  { key: 'phone', header: 'الجوال', required: false, guide: 'اختياري — مثل 05xxxxxxxx' },
  { key: 'email', header: 'البريد الإلكتروني', required: false, guide: 'اختياري — بريد صالح' },
  { key: 'contractType', header: 'نوع العقد', required: false, guide: 'اختياري — أحد: دوام كامل، دوام جزئي، عقد، متدرب، مستشار (افتراضي: دوام كامل)' },
  { key: 'iban', header: 'آيبان', required: false, guide: 'اختياري — يبدأ بـ SA' },
  { key: 'bankName', header: 'اسم البنك', required: false, guide: 'اختياري — نص حر' },
];

function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function downloadTemplate() {
  const wb = new ExcelJS.Workbook();
  wb.creator = PLATFORM;
  const ws = wb.addWorksheet('البيانات', { views: [{ rightToLeft: true }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: Math.max(16, c.header.length + 6) }));
  // ترويسة ملوّنة
  const hr = ws.getRow(1);
  hr.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  hr.height = 24;
  // صف مثال
  ws.addRow({
    employeeNumber: 'EMP-101',
    fullNameAr: 'محمد عبدالله السعيد',
    hireDate: '2026-01-15',
    branchName: 'الفرع الرئيسي',
    deptName: 'الموارد البشرية',
    positionTitle: 'أخصائي موارد بشرية',
    salary: 8000,
    gender: 'ذكر',
    nationality: 'سعودي',
    nationalId: '1012345678',
    phone: '0501234567',
    email: 'm.example@example.com',
    contractType: 'دوام كامل',
    iban: 'SA0000000000000000000000',
    bankName: 'الراجحي',
  });
  hr.eachCell((cell, col) => { ws.getColumn(col).width = Math.max(16, cellText(cell.value).length + 6); });

  const gd = wb.addWorksheet('دليل الأعمدة', { views: [{ rightToLeft: true }] });
  gd.columns = [
    { header: 'العمود', key: 'col', width: 22 },
    { header: 'إلزامي؟', key: 'req', width: 10 },
    { header: 'الشرح والقيم المقبولة', key: 'guide', width: 80 },
  ];
  const ghr = gd.getRow(1);
  ghr.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND}` } };
    cell.alignment = { horizontal: 'center' };
  });
  COLUMNS.forEach((c) => gd.addRow({ col: c.header, req: c.required ? 'إلزامي' : 'اختياري', guide: c.guide }));

  wb.xlsx.writeBuffer().then((buf) => {
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'قالب-استيراد-الموظفين.xlsx';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  return wb.xlsx.load(buffer).then((book) => {
    const ws = book.getWorksheet('البيانات') || book.worksheets[0];
    if (!ws) throw new Error('الملف لا يحتوي أي ورقة عمل');
    const headerRow = ws.getRow(1);
    const keyByCol = {};
    headerRow.eachCell((cell, col) => {
      const h = cellText(cell.value).replace(/\s+/g, '');
      const col_def = COLUMNS.find((c) => c.header.replace(/\s+/g, '') === h || cellText(cell.value).startsWith(c.header.replace(' *', '')));
      if (col_def) keyByCol[col] = col_def.key;
    });
    const rows = [];
    ws.eachRow((row, num) => {
      if (num === 1) return;
      const obj = {};
      let hasAny = false;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const key = keyByCol[col];
        if (!key) return;
        const v = cellText(cell.value);
        if (v !== '') hasAny = true;
        obj[key] = v;
      });
      if (hasAny) rows.push(obj);
    });
    return rows;
  });
}

function validateRow(r) {
  const errors = [];
  if (!r.employeeNumber) errors.push('رقم الموظف مطلوب');
  if (!r.fullNameAr || r.fullNameAr.length < 2) errors.push('الاسم الكامل مطلوب');
  if (!r.hireDate) errors.push('تاريخ المباشرة مطلوب');
  else if (isNaN(new Date(r.hireDate).getTime())) errors.push('تاريخ المباشرة غير صالح (المطلوب YYYY-MM-DD)');
  if (!r.branchName) errors.push('الفرع مطلوب');
  if (!r.deptName) errors.push('الإدارة مطلوبة');
  if (!r.positionTitle) errors.push('المنصب مطلوب');
  if (r.salary && isNaN(Number(r.salary))) errors.push('الراتب يجب أن يكون رقماً');
  if (r.email && !/^\S+@\S+\.\S+$/.test(r.email)) errors.push('البريد الإلكتروني غير صالح');
  return errors;
}

export default function ImportEmployeesModal({ open, onClose, onDone }) {
  const toast = useToast();
  const fileRef = useRef(null);
  const [step, setStep] = useState('instructions'); // instructions | preview | result
  const [parsed, setParsed] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  if (!open) return null;

  function reset() {
    setStep('instructions');
    setParsed([]);
    setResult(null);
    setImporting(false);
  }
  function close() {
    reset();
    onClose();
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      toast.error('الرجاء اختيار ملف Excel بصيغة xlsx');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rows = await parseWorkbook(reader.result);
        if (!rows.length) {
          toast.error('الملف لا يحتوي صفوف بيانات — تأكد من استخدام القالب');
          return;
        }
        if (rows.length > 500) {
          toast.error('الحد الأقصى 500 صف في الملف الواحد');
          return;
        }
        setParsed(rows);
        setStep('preview');
      } catch (err) {
        toast.error('تعذر قراءة الملف: ' + (err?.message || 'صيغة غير مدعومة'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function confirmImport() {
    setImporting(true);
    client.post('/hr/employees/import', { rows: parsed })
      .then(({ data }) => { setResult(data); setStep('result'); onDone?.(); })
      .catch((err) => toast.error(errMsg(err)))
      .finally(() => setImporting(false));
  }

  const invalidCount = parsed.filter((r) => validateRow(r).length > 0).length;
  const created = result?.results?.filter((r) => r.ok) || [];
  const failed = result?.results?.filter((r) => !r.ok) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="bg-white rounded-2xl shadow-pop w-full max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        {step === 'instructions' && (
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-2xl shrink-0" style={{ background: `#${BRAND}` }}>ⓘ</div>
              <div>
                <h2 className="h2">تعليمات استيراد الموظفين من Excel</h2>
                <p className="muted text-sm">جهّز الملف وفق الأعمدة المطلوبة ثم تابع الاستيراد</p>
              </div>
            </div>
            <ol className="text-sm space-y-2 list-decimal pr-5 leading-relaxed">
              <li>نزّل القالب الجاهز (زر أدناه) — يحتوي ورقة «البيانات» بالأعمدة الصحيحة وورقة «دليل الأعمدة» بشرح كل عمود.</li>
              <li>الأعمدة الإلزامية: <b>رقم الموظف، الاسم الكامل، تاريخ المباشرة (YYYY-MM-DD)، الفرع، الإدارة، المنصب</b> — اكتب أسماء الفرع/الإدارة/المنصب <b>كما هي في النظام حرفياً</b>.</li>
              <li>اختيارية: الراتب، الجنس (ذكر/أنثى)، الجنسية، الهوية، الجوال، البريد، نوع العقد، الآيبان، البنك.</li>
              <li>احذف صف المثال قبل الرفع، ولا تغيّر أسماء الأعمدة في الصف الأول، والحد الأقصى 500 صف.</li>
              <li><b>لكل موظف سيُنشأ حساب دخول تلقائياً</b>: اسم الدخول = رقم الموظف، وكلمة سر مولّدة تظهر بعد الاستيراد وفي «تقرير كلمات المرور»، وسيدخل الموظف نظاماً بتغييرها في أول دخول.</li>
            </ol>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className="btn-secondary" onClick={downloadTemplate}>⬇ تحميل القالب الجاهز</button>
              <button type="button" className="btn-primary" onClick={() => fileRef.current?.click()}>فهمت، متابعة الاستيراد</button>
              <button type="button" className="btn-ghost" onClick={close}>إلغاء</button>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === 'preview' && (
          <div className="p-6 space-y-4">
            <h2 className="h2">معاينة الاستيراد — {parsed.length} صف</h2>
            <p className="muted text-sm">
              {invalidCount === 0
                ? <span className="text-green-700 font-medium">كل الصفوف سليمة — جاهز للاستيراد</span>
                : <span className="text-red-700 font-medium">{invalidCount} صف به مشاكل — سيتم تجاهلها تلقائياً عند الاستيراد</span>}
            </p>
            <div className="table-wrap max-h-80">
              <table>
                <thead>
                  <tr><th>#</th><th>الرقم</th><th>الاسم</th><th>الفرع</th><th>الإدارة</th><th>المنصب</th><th>الحالة</th></tr>
                </thead>
                <tbody>
                  {parsed.map((r, i) => {
                    const errs = validateRow(r);
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="font-mono text-xs">{r.employeeNumber || '—'}</td>
                        <td>{r.fullNameAr || '—'}</td>
                        <td>{r.branchName || '—'}</td>
                        <td>{r.deptName || '—'}</td>
                        <td>{r.positionTitle || '—'}</td>
                        <td>{errs.length === 0
                          ? <span className="badge-success">سليم</span>
                          : <span className="badge-danger" title={errs.join('، ')}>{errs[0]}{errs.length > 1 ? '…' : ''}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'جاري الاستيراد...' : `تأكيد الاستيراد (${parsed.length - invalidCount} صف صالح)`}
              </button>
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={importing}>تغيير الملف</button>
              <button type="button" className="btn-ghost" onClick={close} disabled={importing}>إلغاء</button>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === 'result' && (
          <div className="p-6 space-y-4">
            <h2 className="h2">نتيجة الاستيراد</h2>
            <div className="flex gap-3 flex-wrap">
              <span className="badge-success text-sm px-3 py-1.5">تم إنشاء: {created.length}</span>
              {failed.length > 0 && <span className="badge-danger text-sm px-3 py-1.5">فشل: {failed.length}</span>}
            </div>
            {created.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">بيانات الدخول المولّدة (احفظها الآن — وستبقى متاحة في تقرير كلمات المرور):</p>
                <div className="table-wrap max-h-72">
                  <table>
                    <thead><tr><th>الاسم</th><th>اسم الدخول</th><th>كلمة السر</th></tr></thead>
                    <tbody>
                      {created.map((r) => (
                        <tr key={r.rowNum}>
                          <td>{r.fullNameAr}</td>
                          <td className="font-mono text-xs" dir="ltr">{r.username}</td>
                          <td className="font-mono text-xs" dir="ltr">{r.password}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => {
                    const text = created.map((r) => `${r.fullNameAr} | دخول: ${r.username} | كلمة السر: ${r.password}`).join('\n');
                    navigator.clipboard.writeText(text).then(() => toast.success('نُسخت بيانات الدخول للحافظة'));
                  }}
                >نسخ الكل</button>
              </div>
            )}
            {failed.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-700">الصفوف التي لم تُستورد:</p>
                <ul className="text-sm list-disc pr-5 space-y-1">
                  {failed.map((r) => <li key={r.rowNum}>صف {r.rowNum}: {r.error}</li>)}
                </ul>
              </div>
            )}
            <div className="pt-2"><button type="button" className="btn-primary" onClick={close}>إغلاق</button></div>
          </div>
        )}
      </div>
    </div>
  );
}
