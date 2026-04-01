// socket.js
let io;

function init(server) {
  const { Server } = require('socket.io');
  io = new Server(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRole', (role) => {
      socket.join(role);
      console.log(`User ${socket.id} joined role room: ${role}`);
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
