/**
 * absenceJob — كشف الغياب التلقائي (node-cron).
 * يعمل كل 30 دقيقة؛ runAbsenceSweep نفسها تحرس نفسها:
 * تعطيل بالمعامل، لا تعمل قبل لحظة القص، لا تعمل في الجمعة/السبت، وidempotent.
 * كل القيم من مركز المعايير والقواعد — بلا إعادة نشر.
 */
const cron = require('node-cron');
const { runAbsenceSweep } = require('../utils/attendanceRules');

function startAbsenceJob() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const result = await runAbsenceSweep({ actorId: 'auto-absence-job' });
      if (result && (result.createdAbsent || result.createdLeave)) {
        console.log('[absenceJob] sweep:', JSON.stringify(result));
      }
    } catch (e) {
      console.error('[absenceJob] sweep failed:', e.message);
    }
  });
  console.log('[absenceJob] scheduled every 30 minutes (auto-absence detection)');
}

module.exports = { startAbsenceJob };
