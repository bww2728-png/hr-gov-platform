/**
 * wpsJob — تنبيهات يومية لحماية الأجور (P0-05): node-cron كل يوم 08:00 بتوقيت الرياض (05:00 UTC).
 * لكل مسير معتمد/مصروف غير مرفوع: أيام متبقية حتى wpsDeadline → تنبيهات محفوظة
 * باليوم 1/5/payByDay/uploadByDay/11+/20 مع تقدير العقوبات (3000/6000/10000 × عدد الموظفين).
 * Idempotent: تنبيه واحد لكل (مسير، يوم، فرقة أيام).
 */
const cron = require('node-cron');
const prisma = require('../prisma');
const policyStore = require('../utils/policyStore');

let lastRunDay = null; // حارس يومي (إعادة تشغيل لا تكرر)

function intOr(v, f) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : f; }

async function runWpsAlerts({ dry = false } = {}) {
  const payByDay = Math.max(1, Math.min(28, intOr(policyStore.get('wps.payByDay'), 7)));
  const uploadByDay = Math.max(1, Math.min(28, intOr(policyStore.get('wps.uploadByDay'), 10)));
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (!dry && lastRunDay === day) return { skipped: 'already-run-today', day };
  lastRunDay = day;

  const runs = await prisma.payrollRun.findMany({
    where: { status: { in: ['approved', 'paid'] }, wpsDeadline: { not: null } },
    include: { _count: { select: { items: true } } },
  });
  const created = [];
  for (const run of runs) {
    const deadline = new Date(run.wpsDeadline);
    const daysLeft = Math.ceil((deadline - now) / 86400000);
    if (['uploaded', 'accepted'].includes(run.wpsStatus)) continue;

    const employees = run._count.items || 0;
    const overdue = daysLeft < 0;
    const lateDays = overdue ? -daysLeft : 0;
    const band = lateDays <= 10 ? 3000 : lateDays <= 20 ? 6000 : 10000;
    const penalty = overdue ? employees * band : 0;

    // فرقات الأيام: اليوم 1/5/uploadByDay (قبل الموعد)، اليوم 11+/20 (بعد الموعد)
    const dayOfMonth = now.getUTCDate();
    const bucket = overdue
      ? (lateDays <= 11 ? 'overdue_early' : 'overdue_late')
      : ([1, 5, uploadByDay].includes(dayOfMonth) ? `pre_deadline_${dayOfMonth}` : null);
    if (!bucket) continue;

    const title = overdue
      ? `تأخر رفع ملف WPS — مسير ${run.month}/${run.year}`
      : `اقتراب موعد رفع WPS — مسير ${run.month}/${run.year}`;
    const body = overdue
      ? `مر ${lateDays} يوماً على الموعد (${deadline.toISOString().slice(0, 10)}) بلا رفع. العقوبات المتوقعة: ${band.toLocaleString('ar-SA')} ر.س × ${employees} موظف = ${penalty.toLocaleString('ar-SA')} ر.س. ارفع الملف عبر حماية الأجور فوراً.`
      : `الموعد النظامي ${deadline.toISOString().slice(0, 10)} — المتبقي ${daysLeft} يوماً. الموعد النظامي للصرف: يوم ${payByDay} من الشهر التالي، وللرفع: يوم ${uploadByDay}.`;

    // Idempotent: تنبيه واحد لكل (مسير، يوم، فرقة)
    const dup = await prisma.systemNotification.findFirst({
      where: { kind: 'wps', title, createdAt: { gte: new Date(`${day}T00:00:00Z`) } },
    });
    if (dup) continue;
    if (dry) { created.push({ runId: run.id, bucket, title }); continue; }
    const note = await prisma.systemNotification.create({
      data: { roleKey: 'finance_manager', kind: 'wps', title, body, link: '/payroll?tab=wps' },
    });
    created.push({ id: note.id, runId: run.id, bucket });
  }
  return { day, evaluated: runs.length, created };
}

function startWpsJob() {
  // 05:00 UTC = 08:00 الرياض — يومياً
  cron.schedule('0 5 * * *', async () => {
    try { console.log('[wpsJob]', JSON.stringify(await runWpsAlerts())); }
    catch (e) { console.error('[wpsJob] failed:', e.message); }
  });
  return runWpsAlerts().catch((e) => { console.error('[wpsJob] initial failed:', e.message); });
}

module.exports = { startWpsJob, runWpsAlerts };
