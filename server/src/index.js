const http = require('http');
const config = require('./config');
const { createApp } = require('./app');
const { initSocket } = require('./socket');

const app = createApp();
const server = http.createServer(app);
const io = initSocket(server);

// تهيئة كاش مركز السياسات عند الإقلاع (الانعكاس اللحظي بعدها لا يحتاج إعادة نشر)
require('./utils/policyStore').load().catch((e) => console.error('[policyStore] load failed:', e.message));

const host = config.host;
const port = config.port;
server.listen(port, host, () => {
  console.log(`HR Governance server listening on http://${host}:${port}`);
});

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

async function shutdown(signal) {
  console.log(`[shutdown] ${signal}`);
  io.close();
  server.close(async () => {
    const prisma = require('./prisma');
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));