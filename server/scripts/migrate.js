/**
 * migrate.js — خطوة الترحيل الآمنة قبل الإقلاع (versioned migrations فقط، لا db push).
 *
 * حالات قاعدة البيانات المدعومة (بالتزامن مع سجل الإنتاج المعروف):
 *  1) قاعدة جديدة فارغة            → migrate deploy (يطبق الترحيلات كلها بالترتيب).
 *  2) قاعدة db-push قديمة بلا جدول ترحيلات
 *     → resolve --applied لترحيلات الأساس الثلاثة المعروفة (20260906120000_init,
 *       20260906230000_policy_center, 20260909130000_user_credential_vault) لأن مخططها
 *       متزامن أصلاً مع prod عبر db push، ثم deploy للتوسعات الجديدة.
 *  3) قاعدة بها جدول ترحيلات فيه سجلات فاشلة (P3009)
 *     → حذف السجلات الفاشلة فقط (finished_at IS NULL — لم تُطبق أبداً)
 *       ثم نفس منطق (2) إن لم توجد سجلات ناجحة، ثم deploy.
 *  4) قاعدة مهاجرة سليمة           → migrate deploy فقط.
 */
const { execSync } = require('child_process');

// ترحيلات الأساس المعروفة — أُنشئت لخطط متزامنة db push مع prod (قرار موثق، لا تخمين)
const BASELINE_MIGRATIONS = [
  '20260906120000_init',
  '20260906230000_policy_center',
  '20260909130000_user_credential_vault',
];

function dbExec(sql) {
  return new Promise((resolve, reject) => {
    try {
      execSync('npx prisma db execute --stdin', { input: sql, stdio: ['pipe', 'ignore', 'pipe'], shell: true });
      resolve(true);
    } catch (e) {
      const msg = String((e.stderr && e.stderr.toString()) || e.message || '');
      if (msg.includes('does not exist')) resolve(false);
      else { console.error('[migrate] db unreachable:', msg.split('\n').slice(0, 3).join(' | ')); process.exit(1); }
    }
  });
}

function run(cmd, allowFail = false) {
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
  const migTableExists = await dbExec('SELECT 1 FROM "_prisma_migrations" LIMIT 1;');
  const tablesExist = await dbExec("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='employees' LIMIT 1;");

  if (migTableExists) {
    // سجلات فاشلة لم تُطبق أبداً — حذفها يحل P3009 دون مساس بالمخطط
    await dbExec('DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL;');
  }

  if (!migTableExists && tablesExist) {
    console.log('[migrate] legacy db-push database — baselining known lineage as applied');
    for (const m of BASELINE_MIGRATIONS) {
      run(`npx prisma migrate resolve --applied ${m}`, true);
    }
  }
  if (migTableExists && tablesExist) {
    // بعد تنظيف الفاشل: إن لم يُسجل أي أساس ناجحاً (حالة prod الحالية) نُسقطه كأساس
    const anyApplied = await dbExec('SELECT 1 FROM "_prisma_migrations" WHERE finished_at IS NOT NULL LIMIT 1;');
    if (!anyApplied) {
      console.log('[migrate] migrations table present but empty of applied rows — baselining known lineage');
      for (const m of BASELINE_MIGRATIONS) {
        run(`npx prisma migrate resolve --applied ${m}`, true);
      }
    }
  }

  run('npx prisma migrate deploy');
  console.log('[migrate] done');
})().catch((e) => { console.error('[migrate] FAILED:', e.message); process.exit(1); });
