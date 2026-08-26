/**
 * Date utilities - Hijri/Gregorian conversion + duration parsing.
 * Uses Intl with islamic-umalqura calendar for accurate Hijri dates.
 */

function toHijri(date) {
  if (!date) return null;
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const parts = fmt.formatToParts(new Date(date));
  const dd = parts.find(p => p.type === 'day').value;
  const mm = parts.find(p => p.type === 'month').value;
  const yy = parts.find(p => p.type === 'year').value;
  return `${dd}/${mm}/${yy}H`;
}

function toGregorian(hijriStr) {
  if (!hijriStr) return null;
  const cleaned = String(hijriStr).replace(/H$/, '').trim();
  const [dd, mm, yy] = cleaned.split(/[\/\-]/).map(s => parseInt(s, 10));
  if (!dd || !mm || !yy) return null;
  // approximate: use Date arithmetic since umalqura conversion in Intl requires reverse lookup
  // For demo purposes: Hijri year ~ Gregorian year - 622 + (hijri/33)
  const approxGregorian = yy + 622 - Math.floor(yy / 33);
  const date = new Date(approxGregorian, mm - 1, dd);
  return date;
}

/**
 * Parse a duration string into total days.
 * Supports: "5 years", "3 months", "90 days", "2 weeks", "P2Y6M" (ISO 8601), "1.5 years", "6m", "2y".
 */
function parseDurationToDays(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'number') return input;

  const s = String(input).trim().toLowerCase();
  if (!s) return null;

  // ISO 8601 duration: P[n]Y[n]M[n]W[n]D or P[n]DT[n]H...
  if (/^p/i.test(s)) {
    return iso8601ToDays(s);
  }

  // Plain number = days
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);

  // Map of unit synonyms
  const units = {
    d: 1, day: 1, days: 1, يوم: 1, أيام: 1,
    w: 7, week: 7, weeks: 7, أسبوع: 7, أسابيع: 7,
    m: 30, month: 30, months: 30, شهر: 30, أشهر: 30,
    y: 365, year: 365, years: 365, سنة: 365, سنوات: 365, yr: 365,
  };

  // "1.5 years", "6 months", "2 أسابيع"
  const m = s.match(/^([\d.]+)\s*([a-z\u0600-\u06FF]+)$/);
  if (m) {
    const n = parseFloat(m[1]);
    const unit = m[2];
    if (units[unit] != null) return Math.round(n * units[unit]);
  }

  // "P2Y6M" handled above; fall through
  return null;
}

function iso8601ToDays(s) {
  let days = 0;
  const m = s.match(/(\d+(?:\.\d+)?)y/i); if (m) days += parseFloat(m[1]) * 365;
  const mo = s.match(/(\d+(?:\.\d+)?)m(?!t)/i); if (mo) days += parseFloat(mo[1]) * 30;
  const w = s.match(/(\d+(?:\.\d+)?)w/i); if (w) days += parseFloat(w[1]) * 7;
  const d = s.match(/(\d+(?:\.\d+)?)d/i); if (d) days += parseFloat(d[1]);
  return Math.round(days);
}

function formatDuration(days, lang = 'ar') {
  if (days == null) return '';
  const labels = lang === 'en'
    ? { y: 'years', m: 'months', w: 'weeks', d: 'days' }
    : { y: 'سنة', m: 'شهر', w: 'أسبوع', d: 'يوم' };
  if (days >= 365 && days % 365 === 0) return `${days / 365} ${labels.y}`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} ${labels.m}`;
  if (days >= 7 && days % 7 === 0) return `${days / 7} ${labels.w}`;
  return `${days} ${labels.d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function relativeDays(targetDate, fromDate = new Date(), lang = 'ar') {
  const target_ = new Date(targetDate);
  const diffMs = target_.getTime() - fromDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return lang === 'en' ? 'today' : 'اليوم';
  if (diffDays === 1) return lang === 'en' ? 'tomorrow' : 'غداً';
  if (diffDays === -1) return lang === 'en' ? 'yesterday' : 'أمس';
  if (diffDays > 0) return lang === 'en' ? `in ${diffDays} days` : `بعد ${diffDays} يوم`;
  return lang === 'en' ? `${Math.abs(diffDays)} days ago` : `قبل ${Math.abs(diffDays)} يوم`;
}

module.exports = { toHijri, toGregorian, parseDurationToDays, formatDuration, addDays, relativeDays };