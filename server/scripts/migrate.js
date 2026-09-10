/**
 * migrate.js — خطوة الترحيل الآمنة قبل الإقلاع.
 * الحالة 1: قاعدة جديدة فارغة (لا جداول) → migrate deploy (يطبق baseline ثم الجديد).
 * الحالة 2: قاعدة إنتاج أُنشئت بـ db push (جداول موجودة بلا _prisma_migrations)
 *           → migrate resolve --applied 000000_init ثم migrate deploy.
 * الحالة 3: قاعدة مهاجرة سابقاً → migrate deploy فقط.
 * لا يستخدم db push إطلاقاً — كل التغييرات versioned migrations فقط.
 */
const { execSync } = require('child_process');

function psqlHasMigrationsTable() {
  try {
    execSync(
      'npx prisma db execute --stdin',
      { input: "SELECT 1 FROM \"_prisma_migrations\" LIMIT 1;", stdio: ['pipe', 'ignore', 'pipe'], shell: true }
    );
    return true;
  } catch (e) {
    const msg = String(e.stderr || e.message || '');
    if (msg.includes('does not exist')) return false;
    // خطأ اتصال بقاعدة البيانات — فشل صريح بدل التخمين
    console.error('[migrate] cannot reach database:', msg.split('\n').slice(0, 3).join(' | '));
    process.exit(1);
  }
}

function tablesExist() {
  try {
    execSync(
      'npx prisma db execute --stdin',
      { input: "SELECT 1 FROM \"information_schema\".\"tables\" WHERE table_schema='public' AND table_name='employees' LIMIT 1;", stdio: ['pipe', 'ignore', 'pipe'], shell: true }
    );
    return true;
  } catch (e) {
    const msg = String(e.stderr || e.message || '');
    if (msg.includes('does not exist')) return false;
    console.error('[migrate] cannot reach database:', msg.split('\n').slice(0, 3).join(' | '));
    process.exit(1);
  }
}

function run(cmd) {
  console.log('[migrate]', cmd);
  execSync(cmd, { stdio: 'inherit', shell: true });
}

const hasMigrations = psqlHasMigrationsTable();
if (!hasMigrations) {
  const hasTables = tablesExist();
  if (hasTables) {
    console.log('[migrate] existing db-push database detected — baselining 000000_init as applied');
    run('npx prisma migrate resolve --applied 000000_init');
  }
}
run('npx prisma migrate deploy');
console.log('[migrate] done');
