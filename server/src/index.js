const http = require('http');
const config = require('./config');
const { createApp } = require('./app');
const { initSocket } = require('./socket');

const app = createApp();
const server = http.createServer(app);
initSocket(server);

const host = config.host;
const port = config.port;
server.listen(port, host, () => {
  console.log(`HR Governance server listening on http://${host}:${port}`);
});

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));