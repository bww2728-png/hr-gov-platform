/**
 * Date utilities - Hijri/Gregorian conversion + duration parsing + formatting.
 */

export function toHijri(date) {
  if (!date) return '';
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const parts = fmt.formatToParts(new Date(date));
    const dd = parts.find(p => p.type === 'day').value;
    const mm = parts.find(p => p.type === 'month').value;
    const yy = parts.find(p => p.type === 'year').value;
    return `${dd}/${mm}/${yy}H`;
  } catch { return ''; }
}

export function hijriToDate(str) {
  if (!str) return null;
  const m = String(str).replace(/H$/, '').trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{3,4})$/);
  if (!m) return null;
  const [, dd, mm, yy] = m;
  const approx = parseInt(yy, 10) + 622 - Math.floor(parseInt(yy, 10) / 33);
  return new Date(approx, parseInt(mm, 10) - 1, parseInt(dd, 10));
}

const UNITS = {
  d: 1, day: 1, days: 1, يوم: 1, أيام: 1,
  w: 7, week: 7, weeks: 7, أسبوع: 7, أسابيع: 7,
  m: 30, month: 30, months: 30, شهر: 30, أشهر: 30,
  y: 365, year: 365, years: 365, سنة: 365, سنوات: 365, yr: 365,
};

export function parseDurationToDays(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'number') return input;
  const s = String(input).trim().toLowerCase();
  if (/^p/i.test(s)) {
    let days = 0;
    const y = s.match(/(\d+(?:\.\d+)?)y/i); if (y) days += parseFloat(y[1]) * 365;
    const mo = s.match(/(\d+(?:\.\d+)?)m(?!t)/i); if (mo) days += parseFloat(mo[1]) * 30;
    const w = s.match(/(\d+(?:\.\d+)?)w/i); if (w) days += parseFloat(w[1]) * 7;
    const d = s.match(/(\d+(?:\.\d+)?)d/i); if (d) days += parseFloat(d[1]);
    return Math.round(days);
  }
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = s.match(/^([\d.]+)\s*([a-z\u0600-\u06FF]+)$/);
  if (m && UNITS[m[2]] != null) return Math.round(parseFloat(m[1]) * UNITS[m[2]]);
  return null;
}

export function formatDuration(days, lang = 'ar') {
  if (days == null) return '';
  const labels = lang === 'en' ? { y: 'years', m: 'months', w: 'weeks', d: 'days' } : { y: 'سنة', m: 'شهر', w: 'أسبوع', d: 'يوم' };
  if (days >= 365 && days % 365 === 0) return `${days / 365} ${labels.y}`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} ${labels.m}`;
  if (days >= 7 && days % 7 === 0) return `${days / 7} ${labels.w}`;
  return `${days} ${labels.d}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function relativeDays(target, lang = 'ar') {
  const target_ = new Date(target);
  const diff = Math.round((target_.getTime() - Date.now()) / 86400000);
  if (diff === 0) return lang === 'en' ? 'today' : 'اليوم';
  if (diff === 1) return lang === 'en' ? 'tomorrow' : 'غداً';
  if (diff === -1) return lang === 'en' ? 'yesterday' : 'أمس';
  if (diff > 0) return lang === 'en' ? `in ${diff} days` : `بعد ${diff} يوم`;
  return lang === 'en' ? `${Math.abs(diff)} days ago` : `قبل ${Math.abs(diff)} يوم`;
}

export function fmtDate(d, lang = 'ar') {
  if (!d) return '';
  return new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(d, lang = 'ar') {
  if (!d) return '';
  return new Date(d).toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}