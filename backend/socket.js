// socket.js
let io;
const liveSessions = new Map();
const cameraSessions = new Map();

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
      broadcasterRole: null,
      viewers: new Map(),
    });
  }

  return liveSessions.get(sessionId);
}

function buildLiveParticipantsPayload(state) {
  const participants = [];

  if (state?.broadcasterSocketId) {
    participants.push({
      socketId: state.broadcasterSocketId,
      name: state.broadcasterName || 'Host',
      role: state.broadcasterRole || null,
      type: 'host',
    });
  }

  for (const [viewerSocketId, viewerData] of state?.viewers?.entries?.() || []) {
    participants.push({
      socketId: viewerSocketId,
      name: viewerData?.name || 'Participant',
      role: viewerData?.role || null,
      type: 'viewer',
    });
  }

  return {
    participants,
    participantCount: participants.length,
    viewerCount: state?.viewers?.size || 0,
  };
}

function emitLiveParticipants(sessionId) {
  const state = liveSessions.get(sessionId);
  const payload = buildLiveParticipantsPayload(state);
  io.to(getLiveRoom(sessionId)).emit('live:participants', {
    sessionId,
    participants: payload.participants,
    participantCount: payload.participantCount,
    viewerCount: payload.viewerCount,
  });
}

function emitLiveStatus(sessionId) {
  const state = liveSessions.get(sessionId);
  const { participantCount, viewerCount } = buildLiveParticipantsPayload(state);
  io.to(getLiveRoom(sessionId)).emit('live:status', {
    sessionId,
    active: Boolean(state?.broadcasterSocketId),
    broadcasterSocketId: state?.broadcasterSocketId || null,
    broadcasterName: state?.broadcasterName || null,
    broadcasterRole: state?.broadcasterRole || null,
    participantCount,
    viewerCount,
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

function getOrCreateCameraState(sessionId) {
  if (!cameraSessions.has(sessionId)) {
    cameraSessions.set(sessionId, {
      publishers: new Map(),
    });
  }

  return cameraSessions.get(sessionId);
}

function getCameraPublishersPayload(sessionId, excludeSocketId = null) {
  const state = cameraSessions.get(sessionId);
  if (!state) {
    return [];
  }

  const publishers = [];
  for (const [publisherSocketId, value] of state.publishers.entries()) {
    if (excludeSocketId && publisherSocketId === excludeSocketId) {
      continue;
    }

    publishers.push({
      publisherSocketId,
      name: value?.name || 'Participant',
      role: value?.role || null,
    });
  }

  return publishers;
}

function cleanupCameraStateIfEmpty(sessionId) {
  const state = cameraSessions.get(sessionId);
  if (!state) {
    return;
  }

  if (state.publishers.size === 0) {
    cameraSessions.delete(sessionId);
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
      getOrCreateCameraState(sessionId);
      emitLiveStatus(sessionId);
      emitLiveParticipants(sessionId);
      socket.emit('camera:list', {
        sessionId,
        publishers: getCameraPublishersPayload(sessionId, socket.id),
      });
    });

    socket.on('camera:publish', ({ sessionId: sessionIdValue, name, role } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = getOrCreateCameraState(sessionId);
      state.publishers.set(socket.id, {
        name: String(name || '').trim().slice(0, 120) || 'Participant',
        role: String(role || '').trim().slice(0, 120) || null,
      });

      socket.join(getLiveRoom(sessionId));
      socket.data.liveSessionIds.add(sessionId);

      io.to(getLiveRoom(sessionId)).emit('camera:published', {
        sessionId,
        publisherSocketId: socket.id,
        name: state.publishers.get(socket.id).name,
        role: state.publishers.get(socket.id).role,
      });
    });

    socket.on('camera:unpublish', ({ sessionId: sessionIdValue } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = cameraSessions.get(sessionId);
      if (!state) {
        return;
      }

      if (!state.publishers.has(socket.id)) {
        return;
      }

      state.publishers.delete(socket.id);

      io.to(getLiveRoom(sessionId)).emit('camera:unpublished', {
        sessionId,
        publisherSocketId: socket.id,
      });

      cleanupCameraStateIfEmpty(sessionId);
    });

    socket.on('camera:subscribe', ({ sessionId: sessionIdValue, publisherSocketId } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !publisherSocketId || publisherSocketId === socket.id) {
        return;
      }

      const state = cameraSessions.get(sessionId);
      if (!state || !state.publishers.has(publisherSocketId)) {
        return;
      }

      io.to(publisherSocketId).emit('camera:subscriber-joined', {
        sessionId,
        subscriberSocketId: socket.id,
      });
    });

    socket.on('camera:offer', ({ sessionId: sessionIdValue, targetSocketId, sdp } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !sdp) {
        return;
      }

      io.to(targetSocketId).emit('camera:offer', {
        sessionId,
        fromSocketId: socket.id,
        sdp,
      });
    });

    socket.on('camera:answer', ({ sessionId: sessionIdValue, targetSocketId, sdp } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !sdp) {
        return;
      }

      io.to(targetSocketId).emit('camera:answer', {
        sessionId,
        fromSocketId: socket.id,
        sdp,
      });
    });

    socket.on('camera:ice-candidate', ({ sessionId: sessionIdValue, targetSocketId, candidate } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !candidate) {
        return;
      }

      io.to(targetSocketId).emit('camera:ice-candidate', {
        sessionId,
        fromSocketId: socket.id,
        candidate,
      });
    });

    socket.on('camera:moderation-command', ({ sessionId: sessionIdValue, targetSocketId, command } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId || !targetSocketId || !command) {
        return;
      }

      const normalizedCommand = String(command).trim().toLowerCase();
      if (!['disable-camera', 'disable-audio'].includes(normalizedCommand)) {
        return;
      }

      const liveState = liveSessions.get(sessionId);
      if (!liveState || liveState.broadcasterSocketId !== socket.id) {
        return;
      }

      io.to(targetSocketId).emit('camera:moderation-command', {
        sessionId,
        fromSocketId: socket.id,
        command: normalizedCommand,
      });
    });

    socket.on('live:status-request', ({ sessionId: sessionIdValue } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      getOrCreateLiveState(sessionId);
      emitLiveStatus(sessionId);
    });

    socket.on('live:publish', ({ sessionId: sessionIdValue, hostName, hostRole } = {}) => {
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
      state.broadcasterRole = String(hostRole || '').trim().slice(0, 120) || null;
      socket.join(getLiveRoom(sessionId));
      socket.data.liveSessionIds.add(sessionId);
      emitLiveStatus(sessionId);
      emitLiveParticipants(sessionId);

      // If viewers were already waiting in this live room before publish,
      // explicitly attach each one so offer/answer starts immediately.
      for (const viewerSocketId of state.viewers.keys()) {
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
      state.broadcasterRole = null;
      emitLiveStatus(sessionId);
      emitLiveParticipants(sessionId);
      cleanupLiveStateIfEmpty(sessionId);
    });

    socket.on('live:viewer-ready', ({ sessionId: sessionIdValue, viewerName, viewerRole } = {}) => {
      const sessionId = normalizeSessionId(sessionIdValue);
      if (!sessionId) {
        return;
      }

      const state = getOrCreateLiveState(sessionId);
      state.viewers.set(socket.id, {
        name: String(viewerName || '').trim().slice(0, 120) || 'Participant',
        role: String(viewerRole || '').trim().slice(0, 120) || null,
      });
      socket.join(getLiveRoom(sessionId));
      socket.data.liveSessionIds.add(sessionId);
      emitLiveStatus(sessionId);
      emitLiveParticipants(sessionId);

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
          state.broadcasterRole = null;
          emitLiveStatus(sessionId);
        }

        emitLiveParticipants(sessionId);

        cleanupLiveStateIfEmpty(sessionId);

        const cameraState = cameraSessions.get(sessionId);
        if (cameraState?.publishers?.has(socket.id)) {
          cameraState.publishers.delete(socket.id);
          io.to(getLiveRoom(sessionId)).emit('camera:unpublished', {
            sessionId,
            publisherSocketId: socket.id,
          });
          cleanupCameraStateIfEmpty(sessionId);
        }
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
