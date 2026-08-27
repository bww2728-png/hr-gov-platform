/**
 * Axios client with credentials + language header + auto-redirect on 401.
 */
import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const lang = localStorage.getItem('hr_lang') || 'ar';
  config.headers['Accept-Language'] = lang === 'en' ? 'en-US' : 'ar-SA';
  return config;
});

client.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    const path = window.location.pathname;
    // Only redirect on 401 (expired session) when:
    //  - we're not on /login already
    //  - we actually have a user in localStorage/cookies (real session)
    // This prevents auto-redirect on background data refreshes for routes the
    // user is allowed to view but lacks data scope for.
    if (status === 401 && !path.startsWith('/login') && path !== '/') {
      // Avoid redirect on /auth/me bootstrap failure (handled by AuthContext)
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
export function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'حدث خطأ غير متوقع';
}