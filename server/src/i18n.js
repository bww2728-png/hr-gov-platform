/**
 * Bilingual (Arabic + English) i18n messages.
 * Used for API error responses and audit reasons.
 */
const messages = {
  ar: {
    'err.unauthorized': 'غير مصرح: يلزم تسجيل الدخول',
    'err.session_expired': 'انتهت الجلسة، يرجى تسجيل الدخول مجدداً',
    'err.session_invalid': 'الجلسة غير صالحة أو تم إنهاؤها',
    'err.forbidden': 'ممنوع: صلاحيات غير كافية',
    'err.forbidden_scope': 'ممنوع: خارج نطاقك الجغرافي',
    'err.validation': 'بيانات غير صحيحة',
    'err.not_found': 'العنصر غير موجود',
    'err.conflict': 'تعارض في البيانات',
    'err.rate_limit': 'طلبات كثيرة، حاول لاحقاً',
    'err.server': 'خطأ في الخادم',
    'err.locked': 'الحساب مقفل بسبب محاولات فاشلة متكررة',
  },
  en: {
    'err.unauthorized': 'Unauthorized: login required',
    'err.session_expired': 'Session expired, please login again',
    'err.session_invalid': 'Session invalid or revoked',
    'err.forbidden': 'Forbidden: insufficient permissions',
    'err.forbidden_scope': 'Forbidden: outside your geographic scope',
    'err.validation': 'Validation failed',
    'err.not_found': 'Not found',
    'err.conflict': 'Conflict',
    'err.rate_limit': 'Too many requests, try later',
    'err.server': 'Server error',
    'err.locked': 'Account locked due to repeated failed attempts',
  },
};

function t(lang, key, fallback) {
  const l = (lang || 'ar').toLowerCase().startsWith('en') ? 'en' : 'ar';
  return messages[l][key] || messages.ar[key] || fallback || key;
}

function detectLang(req) {
  const hdr = req.headers['accept-language'] || '';
  if (hdr.toLowerCase().includes('en')) return 'en';
  if (req.user?.languagePref === 'en') return 'en';
  return 'ar';
}

module.exports = { t, detectLang };