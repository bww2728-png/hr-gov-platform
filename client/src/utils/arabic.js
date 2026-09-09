// تطبيع نصي عربي خفيف للمطابقة والبحث في الواجهة (يقابل normAr في الخادم)
export function normArClient(s) {
  return String(s || '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
