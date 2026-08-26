import React, { useState, useEffect } from 'react';
import { toHijri, hijriToDate } from '../../utils/datetime';

/**
 * DateDual - حقل تاريخ مزدوج (ميلادي + هجري)
 * كتابة بأي منهما تُحدّث الآخر تلقائياً.
 */
export function DateDual({ value, onChange, label, required, className = '' }) {
  const [gregorian, setGregorian] = useState(() => value ? new Date(value).toISOString().slice(0, 10) : '');
  const [hijri, setHijri] = useState(() => toHijri(value));
  const [showHijri, setShowHijri] = useState(false);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) setGregorian(d.toISOString().slice(0, 10));
      setHijri(toHijri(d));
    } else { setGregorian(''); setHijri(''); }
  }, [value]);

  function onGregorianChange(e) {
    const v = e.target.value;
    setGregorian(v);
    if (v) {
      const d = new Date(v);
      onChange(d.toISOString());
      setHijri(toHijri(d));
    } else {
      onChange(null);
      setHijri('');
    }
  }

  function onHijriChange(e) {
    const v = e.target.value;
    setHijri(v);
    const d = hijriToDate(v);
    if (d) {
      const iso = d.toISOString().slice(0, 10);
      setGregorian(iso);
      onChange(d.toISOString());
    }
  }

  return (
    <div className={className}>
      {label && <label className="label">{label} {required && <span className="text-danger-500">*</span>}</label>}
      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={gregorian}
          onChange={onGregorianChange}
          className="input flex-1"
          required={required}
        />
        <button
          type="button"
          onClick={() => setShowHijri((s) => !s)}
          className="btn-ghost text-xs"
          title="التاريخ الهجري"
        >
          ه‍
        </button>
      </div>
      {showHijri && (
        <div className="mt-2">
          <label className="label">بالتقويم الهجري (يوم/شهر/سنة)</label>
          <input
            type="text"
            placeholder="15/03/1446H"
            value={hijri}
            onChange={onHijriChange}
            className="input"
            dir="ltr"
          />
          <p className="text-xs text-ink-500 mt-1">يكتب بأي صيغة ويترجم للآخر تلقائياً</p>
        </div>
      )}
    </div>
  );
}

/**
 * Duration - حقل مدة ذكية
 * يقبل: "5 سنوات"، "3 أشهر"، "90 يوماً"، "P2Y6M"، "1.5y"
 * يعرض النتيجة بصيغ متعددة (أيام / أسابيع / أشهر / سنوات).
 */
export function Duration({ value, onChange, label, className = '' }) {
  const [input, setInput] = useState(value || '');
  const [days, setDays] = useState(null);

  useEffect(() => { setInput(value || ''); }, [value]);

  function recalc(v) {
    setInput(v);
    if (!v) { setDays(null); onChange?.(null); return; }
    let d = null;
    if (typeof v === 'number') d = v;
    else {
      const s = String(v).trim().toLowerCase();
      if (/^p/i.test(s)) {
        let n = 0;
        const y = s.match(/(\d+(?:\.\d+)?)y/i); if (y) n += parseFloat(y[1]) * 365;
        const mo = s.match(/(\d+(?:\.\d+)?)m(?!t)/i); if (mo) n += parseFloat(mo[1]) * 30;
        const w = s.match(/(\d+(?:\.\d+)?)w/i); if (w) n += parseFloat(w[1]) * 7;
        const da = s.match(/(\d+(?:\.\d+)?)d/i); if (da) n += parseFloat(da[1]);
        d = Math.round(n);
      } else if (/^\d+(\.\d+)?$/.test(s)) d = parseFloat(s);
      else {
        const UNITS = { d: 1, day: 1, days: 1, يوم: 1, أيام: 1, w: 7, week: 7, weeks: 7, أسبوع: 7, أسابيع: 7, m: 30, month: 30, months: 30, شهر: 30, أشهر: 30, y: 365, year: 365, years: 365, سنة: 365, سنوات: 365 };
        const m = s.match(/^([\d.]+)\s*([a-z\u0600-\u06FF]+)$/);
        if (m && UNITS[m[2]] != null) d = Math.round(parseFloat(m[1]) * UNITS[m[2]]);
      }
    }
    setDays(d);
    onChange?.(d);
  }

  function fmt(d) {
    if (d == null) return '';
    if (d >= 365 && d % 365 === 0) return `${d / 365} سنة`;
    if (d >= 30 && d % 30 === 0) return `${d / 30} شهر`;
    if (d >= 7 && d % 7 === 0) return `${d / 7} أسبوع`;
    return `${d} يوم`;
  }

  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <input
        type="text"
        value={input}
        onChange={(e) => recalc(e.target.value)}
        placeholder="5 سنوات، 3 أشهر، 90 يوم، P2Y6M"
        className="input"
        dir="ltr"
      />
      {days != null && (
        <div className="mt-1 flex gap-2 text-xs">
          <span className="badge-primary">{days} يوم</span>
          {days >= 7 && <span className="badge-ink">{(days / 7).toFixed(1)} أسابيع</span>}
          {days >= 30 && <span className="badge-ink">{(days / 30).toFixed(1)} أشهر</span>}
          {days >= 365 && <span className="badge-ink">{(days / 365).toFixed(2)} سنوات</span>}
        </div>
      )}
    </div>
  );
}