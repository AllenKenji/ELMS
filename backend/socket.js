// socket.js
let io;

function init(server) {
  const { Server } = require('socket.io');
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRole', (role) => {
      socket.join(role);
      console.log(`User ${socket.id} joined role room: ${role}`);
    });

    socket.on('joinUser', (userId) => {
      const normalizedUserId = Number(userId);
      if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
        return;
      }

      const userRoom = `user_${normalizedUserId}`;
      socket.join(userRoom);
      console.log(`User ${socket.id} joined user room: ${userRoom}`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized. Call init(server) first.');
  return io;
}

module.exports = { init, getIO };
