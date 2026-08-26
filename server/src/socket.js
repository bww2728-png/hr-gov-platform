const { Server } = require('socket.io');
const config = require('./config');

/**
 * Socket.IO server for real-time notifications.
 * Emits: audit:new, kpi:updated, compliance:alert, workflow:step
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: config.clientOrigins, credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('subscribe', (channels) => {
      if (Array.isArray(channels)) {
        channels.forEach((c) => socket.join(c));
      }
    });
    socket.on('disconnect', () => {});
  });

  return io;
}

module.exports = { initSocket };