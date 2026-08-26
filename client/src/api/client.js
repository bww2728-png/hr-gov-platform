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
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
export function errMsg(err) {
  return err?.response?.data?.error || err?.message || 'حدث خطأ غير متوقع';
}