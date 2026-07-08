import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../../api/api';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function getSocketBaseUrl() {
  return String(import.meta.env.VITE_SOCKET_URL || API_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
}

function stopTracks(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export default function LiveSessionPanel({ sessionId, canBroadcast = false }) {
  const [isLive, setIsLive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [status, setStatus] = useState('No live stream in progress.');
  const [error, setError] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const viewerPeerRef = useRef(null);
  const viewerBroadcasterSocketIdRef = useRef(null);
  const broadcasterPeersRef = useRef(new Map());

  const normalizedSessionId = useMemo(() => Number(sessionId), [sessionId]);

  const closeViewerPeer = useCallback(() => {
    if (viewerPeerRef.current) {
      viewerPeerRef.current.close();
      viewerPeerRef.current = null;
    }
    viewerBroadcasterSocketIdRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  const closeBroadcasterPeers = useCallback(() => {
    for (const pc of broadcasterPeersRef.current.values()) {
      pc.close();
    }
    broadcasterPeersRef.current.clear();
  }, []);

  const stopBroadcast = useCallback(() => {
    setIsBroadcasting(false);
    closeBroadcasterPeers();
    stopTracks(localStreamRef.current);
    localStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('live:stop', { sessionId: normalizedSessionId });
    }
  }, [closeBroadcasterPeers, normalizedSessionId]);

  const startBroadcast = useCallback(async () => {
    if (!canBroadcast || isBroadcasting || !socketRef.current) return;

    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const firstVideoTrack = stream.getVideoTracks()[0];
      if (firstVideoTrack) {
        firstVideoTrack.onended = () => {
          stopBroadcast();
        };
      }

      setIsBroadcasting(true);
      setStatus('You are live. Waiting for participants to connect...');
      socketRef.current.emit('live:publish', { sessionId: normalizedSessionId });
    } catch (err) {
      setError(err?.message || 'Unable to start live stream.');
    }
  }, [canBroadcast, isBroadcasting, normalizedSessionId, stopBroadcast]);

  const createBroadcasterPeer = useCallback(async (viewerSocketId) => {
    if (!localStreamRef.current || !socketRef.current) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    broadcasterPeersRef.current.set(viewerSocketId, pc);

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current.emit('live:ice-candidate', {
        sessionId: normalizedSessionId,
        targetSocketId: viewerSocketId,
        candidate: event.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        pc.close();
        broadcasterPeersRef.current.delete(viewerSocketId);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current.emit('live:offer', {
      sessionId: normalizedSessionId,
      targetSocketId: viewerSocketId,
      sdp: offer,
    });
  }, [normalizedSessionId]);

  const createViewerPeer = useCallback((broadcasterSocketId) => {
    if (!socketRef.current) return null;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    viewerBroadcasterSocketIdRef.current = broadcasterSocketId;
    viewerPeerRef.current = pc;

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current.emit('live:ice-candidate', {
        sessionId: normalizedSessionId,
        targetSocketId: broadcasterSocketId,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream || null;
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        closeViewerPeer();
      }
    };

    return pc;
  }, [closeViewerPeer, normalizedSessionId]);

  const startWatching = useCallback(() => {
    if (!socketRef.current || isWatching) return;

    setError('');
    setIsWatching(true);
    setStatus('Connecting to live stream...');
    socketRef.current.emit('live:viewer-ready', { sessionId: normalizedSessionId });
  }, [isWatching, normalizedSessionId]);

  const stopWatching = useCallback(() => {
    setIsWatching(false);
    closeViewerPeer();
    setStatus(isLive ? 'Live stream available. Click Watch Live.' : 'No live stream in progress.');
  }, [closeViewerPeer, isLive]);

  useEffect(() => {
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      return undefined;
    }

    const socket = io(getSocketBaseUrl());
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('joinSessionLive', normalizedSessionId);
    });

    socket.on('live:status', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;

      const active = Boolean(payload?.active);
      setIsLive(active);

      if (!active) {
        if (!canBroadcast) {
          closeViewerPeer();
          setIsWatching(false);
        }
        setStatus('No live stream in progress.');
      } else if (!isBroadcasting) {
        setStatus('Live stream is active.');
      }
    });

    socket.on('live:error', (payload) => {
      setError(payload?.message || 'Live streaming error.');
    });

    socket.on('live:viewer-joined', async (payload) => {
      if (!canBroadcast || !isBroadcasting) return;
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      const viewerSocketId = payload?.viewerSocketId;
      if (!viewerSocketId) return;

      try {
        await createBroadcasterPeer(viewerSocketId);
      } catch {
        setError('Failed to connect a participant viewer.');
      }
    });

    socket.on('live:offer', async (payload) => {
      if (canBroadcast) return;
      if (!isWatching) return;
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.fromSocketId || !payload?.sdp) return;

      try {
        const pc = viewerPeerRef.current || createViewerPeer(payload.fromSocketId);
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('live:answer', {
          sessionId: normalizedSessionId,
          targetSocketId: payload.fromSocketId,
          sdp: answer,
        });

        setStatus('Watching live stream.');
      } catch {
        setError('Failed to receive live stream.');
      }
    });

    socket.on('live:answer', async (payload) => {
      if (!canBroadcast) return;
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.fromSocketId || !payload?.sdp) return;

      const pc = broadcasterPeersRef.current.get(payload.fromSocketId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        setError('Failed to complete viewer connection.');
      }
    });

    socket.on('live:ice-candidate', async (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.candidate || !payload?.fromSocketId) return;

      try {
        if (canBroadcast) {
          const pc = broadcasterPeersRef.current.get(payload.fromSocketId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
          return;
        }

        const pc = viewerPeerRef.current;
        if (pc && viewerBroadcasterSocketIdRef.current === payload.fromSocketId) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        // ignore sporadic ICE candidate race conditions
      }
    });

    return () => {
      if (canBroadcast) {
        stopBroadcast();
      }
      closeViewerPeer();
      socket.disconnect();
      socketRef.current = null;
      closeBroadcasterPeers();
      closeViewerPeer();
    };
  }, [
    canBroadcast,
    closeBroadcasterPeers,
    closeViewerPeer,
    createBroadcasterPeer,
    createViewerPeer,
    isBroadcasting,
    isWatching,
    normalizedSessionId,
    stopBroadcast,
    stopWatching,
  ]);

  return (
    <section className="detail-section full-width live-session-panel">
      <h3>Live Session</h3>

      <div className="live-session-actions">
        {canBroadcast && !isBroadcasting && (
          <button type="button" className="btn-live-start" onClick={startBroadcast}>
            Start Live
          </button>
        )}
        {canBroadcast && isBroadcasting && (
          <button type="button" className="btn-live-stop" onClick={stopBroadcast}>
            Stop Live
          </button>
        )}

        {!canBroadcast && !isWatching && (
          <button type="button" className="btn-live-watch" onClick={startWatching} disabled={!isLive}>
            {isLive ? 'Watch Live' : 'Waiting for Live'}
          </button>
        )}
        {!canBroadcast && isWatching && (
          <button type="button" className="btn-live-stop" onClick={stopWatching}>
            Leave Live
          </button>
        )}
      </div>

      <p className="live-session-status">{status}</p>
      {error && <p className="live-session-error">{error}</p>}

      {canBroadcast && (
        <div className="live-video-block">
          <label>Live Preview</label>
          <video ref={localVideoRef} autoPlay muted playsInline className="live-video" />
        </div>
      )}

      {!canBroadcast && (
        <div className="live-video-block">
          <label>Live Stream</label>
          <video ref={remoteVideoRef} autoPlay playsInline controls className="live-video" />
        </div>
      )}
    </section>
  );
}
