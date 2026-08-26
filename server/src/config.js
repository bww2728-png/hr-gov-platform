require('dotenv').config();

// في Render: المنفذ يأتي من PORT تلقائياً، ونستمع على 0.0.0.0
const config = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '4000', 10),
  // قيمة افتراضية آمنة طالما أن المتغير مُعرَّف (حتى لو ضعيف) — لا يفشل عند الإقلاع
  jwtSecret: process.env.JWT_SECRET || 'render-fallback-secret-please-override-in-env',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  clientOrigins: (process.env.CLIENT_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  isProd: process.env.NODE_ENV === 'production',
  defaultLang: process.env.DEFAULT_LANG || 'ar',
  databaseUrl: process.env.DATABASE_URL,
};

if (!config.databaseUrl) {
  console.error('FATAL: DATABASE_URL is not set');
  process.exit(1);
}

module.exports = config;
