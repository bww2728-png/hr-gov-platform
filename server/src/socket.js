const { Server } = require('socket.io');
const config = require('./config');
const { verifyToken, COOKIE_NAME } = require('./utils/jwt');
const cookie = require('cookie');

let currentIO = null;
const getIO = () => currentIO;

/**
 * Socket.IO server for real-time notifications.
 * Emits: audit:new, kpi:updated, compliance:alert, workflow:step, public:policies.updated
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: { origin: config.clientOrigins, credentials: true },
  });
  currentIO = io;

  io.use((socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      const token = socket.handshake.auth?.token || cookies[COOKIE_NAME];
      if (!token) return next(new Error('Authentication required'));
      socket.user = verifyToken(token);
      return next();
    } catch {
      return next(new Error('Invalid session'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('subscribe', (channels) => {
      if (Array.isArray(channels)) {
        channels
          .filter((channel) => (
            typeof channel === 'string'
            && /^[a-z0-9:_-]{1,80}$/i.test(channel)
            && (channel.startsWith(`user:${socket.user.sub}`) || channel.startsWith('public:'))
          ))
          .forEach((channel) => socket.join(channel));
      }
    });
    socket.on('disconnect', () => {});
  });

  return io;
}

module.exports = { initSocket, getIO };