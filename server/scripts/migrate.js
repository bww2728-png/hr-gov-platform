/**
 * migrate.js — خطوة الترحيل الآمنة قبل الإقلاع (versioned migrations فقط، لا db push).
 *
 * ملاحظة جوهرية: prisma db execute لا يُرجع نتائج SELECT — لذلك كل منطق الإصلاح
 * هنا SQL مباشر idempotent (DELETE فاشل + INSERT أساس بشرط NOT EXISTS) بلا أي
 * اعتماد على قراءة حالة من قاعدة البيانات.
 *
 * الحالات المدعومة:
 *  1) قاعدة جديدة فارغة            → deploy يطبق الترحيلات كلها بالترتيب.
 *  2) قاعدة db-push legacy بلا جدول ترحيلات → resolve --applied للأساس المعروف ثم deploy.
 *  3) جدول ترحيلات به سجلات فاشلة (P3009) → حذف الفاشل (finished_at IS NULL)
 *     + إدراج سجلات الأساس الناقصة (بـ checksums حقيقية) ثم deploy.
 *  4) قاعدة مهاجرة سليمة           → deploy فقط (الإدراج محمي بـ NOT EXISTS).
 */
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
// ترحيلات الأساس المعروفة — مخططها متزامن أصلاً مع prod (قرار موثق، لا تخمين)
const BASELINE_MIGRATIONS = [
  '20260906120000_init',
  '20260906230000_policy_center',
  '20260909130000_user_credential_vault',
];

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function checksumOf(migrationName) {
  const file = path.join(MIGRATIONS_DIR, migrationName, 'migration.sql');
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function dbExec(sql, { fatal = true, label = '' } = {}) {
  try {
    execSync('npx prisma db execute --stdin', { input: sql, stdio: ['pipe', 'ignore', 'pipe'], shell: true });
    return true;
  } catch (e) {
    const msg = String((e.stderr && e.stderr.toString()) || e.message || '');
    if (!fatal) { console.log(`[migrate] (${label || 'step'} non-fatal): ${msg.split('\n')[0]}`); return false; }
    console.error(`[migrate] db error (${label}):`, msg.split('\n').slice(0, 3).join(' | '));
    process.exit(1);
  }
}

function run(cmd, { allowFail = false } = {}) {
  console.log('[migrate]', cmd);
  try {
    execSync(cmd, { stdio: 'inherit', shell: true });
    return true;
  } catch (e) {
    if (allowFail) { console.log('[migrate] (non-fatal)'); return false; }
    throw e;
  }
}

(async () => {
  const migTableExists = dbExec('SELECT 1 FROM "_prisma_migrations" LIMIT 1;', { fatal: false, label: 'migrations-table-probe' });

  if (!migTableExists) {
    const tablesExist = dbExec("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees' LIMIT 1;", { fatal: false, label: 'tables-probe' });
    if (tablesExist) {
      console.log('[migrate] legacy db-push database — baselining known lineage via resolve');
      for (const m of BASELINE_MIGRATIONS) {
        run(`npx prisma migrate resolve --applied ${m}`, { allowFail: true });
      }
    }
    // قاعدة جديدة فارغة: لا شيء الآن — deploy يبني كل شيء
  } else {
    // 1) حذف السجلات الفاشلة فقط (لم تُطبق أبداً) — يحل P3009
    dbExec('DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL;', { label: 'purge-failed' });
    // 2) إدراج سجلات الأساس الناقصة بـ checksums حقيقية (idempotent)
    for (const m of BASELINE_MIGRATIONS) {
      const cs = checksumOf(m);
      dbExec(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, started_at, applied_steps_count)
         SELECT gen_random_uuid(), ${sqlLiteral(cs)}, now(), ${sqlLiteral(m)}, ${sqlLiteral('baselined by scripts/migrate.js')}, now(), 1
         WHERE NOT EXISTS (SELECT 1 FROM "_prisma_migrations" WHERE migration_name = ${sqlLiteral(m)});`,
        { label: `baseline-${m}` }
      );
    }
  }

  run('npx prisma migrate deploy');
  console.log('[migrate] done');
})().catch((e) => { console.error('[migrate] FAILED:', e.message); process.exit(1); });
