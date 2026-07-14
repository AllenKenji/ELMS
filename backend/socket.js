// socket.js
let io;
const liveSessions = new Map();

function normalizeSessionId(value) {
  const sessionId = Number(value);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return null;
  }

  return sessionId;
}

function getLiveRoom(sessionId) {
  return `live_session_${sessionId}`;
}

function getOrCreateLiveState(sessionId) {
  if (!liveSessions.has(sessionId)) {
    liveSessions.set(sessionId, {
      broadcasterSocketId: null,
      broadcasterName: null,
      viewers: new Set(),
    });
  }

  return liveSessions.get(sessionId);
}

function emitLiveStatus(sessionId) {
  const state = liveSessions.get(sessionId);
  io.to(getLiveRoom(sessionId)).emit('live:status', {
    sessionId,
    active: Boolean(state?.broadcasterSocketId),
    broadcasterSocketId: state?.broadcasterSocketId || null,
    broadcasterName: state?.broadcasterName || null,
  });
}

function cleanupLiveStateIfEmpty(sessionId) {
  const state = liveSessions.get(sessionId);
  if (!state) {
    return;
  }

  if (!state.broadcasterSocketId && state.viewers.size === 0) {
    liveSessions.delete(sessionId);
  }
}

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
    socket.data.liveSessionIds = new Set();

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

    socket.on('joinSessionLive', (sessionIdValue) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const room = getLiveRoom(sessionId);
      socket.join(room);
      socket.data.liveSessionIds.add(sessionId);
      getOrCreateLiveState(sessionId);
      emitLiveStatus(sessionId);
    });

    socket.on('live:status-request', ({ sessionId: sessionIdValue } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      getOrCreateLiveState(sessionId);
      emitLiveStatus(sessionId);
    });

    socket.on('live:publish', ({ sessionId: sessionIdValue, hostName } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = getOrCreateLiveState(sessionId);
      if (state.broadcasterSocketId && state.broadcasterSocketId !== socket.id) {
        socket.emit('live:error', { message: 'A live stream is already active for this session.' });
        return;
      }

      state.broadcasterSocketId = socket.id;
      state.broadcasterName = String(hostName || '').trim().slice(0, 120) || 'Unknown host';
      socket.join(getLiveRoom(sessionId));
      socket.data.liveSessionIds.add(sessionId);
      emitLiveStatus(sessionId);

      // If viewers were already waiting in this live room before publish,
      // explicitly attach each one so offer/answer starts immediately.
      for (const viewerSocketId of state.viewers) {
        if (viewerSocketId === socket.id) {
          continue;
        }
        io.to(state.broadcasterSocketId).emit('live:viewer-joined', {
          sessionId,
          viewerSocketId,
        });
      }
    });

    socket.on('live:stop', ({ sessionId: sessionIdValue } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = liveSessions.get(sessionId);
      if (!state || state.broadcasterSocketId !== socket.id) {
        return;
      }

      state.broadcasterSocketId = null;
      state.broadcasterName = null;
      emitLiveStatus(sessionId);
      cleanupLiveStateIfEmpty(sessionId);
    });

    socket.on('live:viewer-ready', ({ sessionId: sessionIdValue } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = getOrCreateLiveState(sessionId);
      state.viewers.add(socket.id);
      socket.join(getLiveRoom(sessionId));
      socket.data.liveSessionIds.add(sessionId);

      if (state.broadcasterSocketId) {
        io.to(state.broadcasterSocketId).emit('live:viewer-joined', {
          sessionId,
          viewerSocketId: socket.id,
        });
      }
    });

    socket.on('live:offer', ({ sessionId: sessionIdValue, targetSocketId, sdp } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !sdp) {
        return;
      }

      io.to(targetSocketId).emit('live:offer', {
        sessionId,
        fromSocketId: socket.id,
        sdp,
      });
    });

    socket.on('live:answer', ({ sessionId: sessionIdValue, targetSocketId, sdp } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !sdp) {
        return;
      }

      io.to(targetSocketId).emit('live:answer', {
        sessionId,
        fromSocketId: socket.id,
        sdp,
      });
    });

    socket.on('live:ice-candidate', ({ sessionId: sessionIdValue, targetSocketId, candidate } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !candidate) {
        return;
      }

      io.to(targetSocketId).emit('live:ice-candidate', {
        sessionId,
        fromSocketId: socket.id,
        candidate,
      });
    });

    socket.on('disconnect', () => {
      for (const sessionId of socket.data.liveSessionIds || []) {
        const state = liveSessions.get(sessionId);
        if (!state) {
          continue;
        }

        state.viewers.delete(socket.id);

        if (state.broadcasterSocketId === socket.id) {
          state.broadcasterSocketId = null;
          state.broadcasterName = null;
          emitLiveStatus(sessionId);
        }

        cleanupLiveStateIfEmpty(sessionId);
      }

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
