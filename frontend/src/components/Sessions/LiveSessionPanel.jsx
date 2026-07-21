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

function buildOutboundStream(sourceStream, cloneTracks = true) {
  const outbound = new MediaStream();
  sourceStream.getVideoTracks().forEach((track) => outbound.addTrack(cloneTracks ? track.clone() : track));
  sourceStream.getAudioTracks().forEach((track) => outbound.addTrack(cloneTracks ? track.clone() : track));
  return outbound;
}

function preferVp8Codec(pc) {
  const hasCapabilities = typeof RTCRtpSender !== 'undefined' && typeof RTCRtpSender.getCapabilities === 'function';
  if (!hasCapabilities) {
    return;
  }

  const capabilities = RTCRtpSender.getCapabilities('video');
  if (!capabilities?.codecs?.length) {
    return;
  }

  const transceiver = pc.getTransceivers().find((item) => item?.sender?.track?.kind === 'video');
  if (!transceiver || typeof transceiver.setCodecPreferences !== 'function') {
    return;
  }

  const vp8 = capabilities.codecs.filter((codec) => String(codec.mimeType || '').toLowerCase() === 'video/vp8');
  if (!vp8.length) {
    return;
  }

  const nonVp8 = capabilities.codecs.filter((codec) => String(codec.mimeType || '').toLowerCase() !== 'video/vp8');
  transceiver.setCodecPreferences([...vp8, ...nonVp8]);
}

function attachVideoStream(videoNode, stream, { muted = false } = {}) {
  if (!videoNode) return;

  videoNode.srcObject = stream || null;
  videoNode.muted = muted;
  videoNode.playsInline = true;
  videoNode.onloadedmetadata = () => {
    videoNode.play?.().catch(() => {});
  };
  videoNode.play?.().catch(() => {});
}

export default function LiveSessionPanel({ sessionId, canBroadcast = false, broadcastStream = null, hostName = '', hostRole = '', onRemoteStreamChange = null, onBroadcastStateChange = null, onPresenterCameraStreamChange = null }) {
  const [isLive, setIsLive] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [liveHostName, setLiveHostName] = useState('');
  const [liveHostSocketId, setLiveHostSocketId] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicrophoneOn, setIsMicrophoneOn] = useState(false);
  const [cameraPublishers, setCameraPublishers] = useState([]);
  const [liveDiagnostics, setLiveDiagnostics] = useState({ publishVideo: false, publishAudio: false, recvVideo: false, recvAudio: false });
  const [status, setStatus] = useState('No live stream in progress.');
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [participantName, setParticipantName] = useState('');
  const [liveParticipants, setLiveParticipants] = useState([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [participantActivity, setParticipantActivity] = useState([]);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const remotePlaybackStreamRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraPublisherPeersRef = useRef(new Map());
  const cameraSubscriberPeersRef = useRef(new Map());
  const remoteCameraStreamsRef = useRef(new Map());
  const cameraTileVideoRefs = useRef(new Map());
  const isCameraOnRef = useRef(false);

  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const viewerPeerRef = useRef(null);
  const viewerBroadcasterSocketIdRef = useRef(null);
  const broadcasterPeersRef = useRef(new Map());
  const broadcastModeRef = useRef(null);
  const isBroadcastingRef = useRef(false);
  const isWatchingRef = useRef(false);
  const sourceBroadcastStreamRef = useRef(null);
  const previousParticipantsRef = useRef(new Map());

  const normalizedSessionId = useMemo(() => Number(sessionId), [sessionId]);
  const hasExternalBroadcast = Boolean(broadcastStream);

  const resolvedParticipantName = useMemo(() => {
    const customName = String(participantName || '').trim();
    if (customName) {
      return customName;
    }

    const fallback = String(hostName || '').trim();
    return fallback || 'Participant';
  }, [hostName, participantName]);

  useEffect(() => {
    setParticipantName(String(hostName || '').trim());
  }, [hostName]);

  useEffect(() => {
    const previousParticipants = previousParticipantsRef.current;
    const currentParticipants = new Map(
      liveParticipants
        .filter((participant) => participant?.socketId)
        .map((participant) => [
          String(participant.socketId),
          {
            name: String(participant.name || '').trim() || 'Participant',
            type: participant.type === 'host' ? 'host' : 'viewer',
          },
        ])
    );

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const newEvents = [];

    for (const [socketId, participant] of currentParticipants.entries()) {
      if (!previousParticipants.has(socketId)) {
        newEvents.push({
          id: `${timestamp}-join-${socketId}`,
          kind: 'join',
          message: `${participant.name}${participant.type === 'host' ? ' (Host)' : ''} joined`,
          timestamp,
        });
      }
    }

    for (const [socketId, participant] of previousParticipants.entries()) {
      if (!currentParticipants.has(socketId)) {
        newEvents.push({
          id: `${timestamp}-left-${socketId}`,
          kind: 'left',
          message: `${participant.name}${participant.type === 'host' ? ' (Host)' : ''} left`,
          timestamp,
        });
      }
    }

    if (newEvents.length > 0) {
      setParticipantActivity((previous) => [...newEvents, ...previous].slice(0, 12));
    }

    previousParticipantsRef.current = currentParticipants;
  }, [liveParticipants]);

  const isCurrentHost = useMemo(() => {
    const currentSocketId = socketRef.current?.id || null;
    if (!currentSocketId) return Boolean(isBroadcasting);
    return Boolean(isBroadcasting || (liveHostSocketId && liveHostSocketId === currentSocketId));
  }, [isBroadcasting, liveHostSocketId]);

  const liveHostLabel = useMemo(() => {
    if (!isLive) {
      return '';
    }

    const currentSocketId = socketRef.current?.id || null;
    const isSelfHost = Boolean(
      isBroadcasting || (liveHostSocketId && currentSocketId && liveHostSocketId === currentSocketId)
    );

    if (isSelfHost) {
      return hostRole ? `You (${hostRole})` : 'You';
    }

    return liveHostName || 'Unknown host';
  }, [hostRole, isBroadcasting, isLive, liveHostName, liveHostSocketId]);

  useEffect(() => {
    isBroadcastingRef.current = isBroadcasting;
  }, [isBroadcasting]);

  useEffect(() => {
    onBroadcastStateChange?.(isBroadcasting);
  }, [isBroadcasting, onBroadcastStateChange]);

  useEffect(() => {
    isWatchingRef.current = isWatching;
  }, [isWatching]);

  useEffect(() => {
    isCameraOnRef.current = isCameraOn;
  }, [isCameraOn]);

  useEffect(() => {
    const remoteCameraStreams = Array.from(remoteCameraStreamsRef.current.values());
    const presenterCameraStream = isCurrentHost
      ? (cameraStreamRef.current || null)
      : (remoteCameraStreams[0] || null);

    onPresenterCameraStreamChange?.(presenterCameraStream);

    return () => {
      onPresenterCameraStreamChange?.(null);
    };
  }, [cameraPublishers, isCameraOn, isCurrentHost, onPresenterCameraStreamChange]);

  useEffect(() => {
    if (!localVideoRef.current) {
      return;
    }

    const previewStream = broadcastModeRef.current === 'external'
      ? broadcastStream
      : localStreamRef.current;

    attachVideoStream(localVideoRef.current, previewStream, { muted: true });
  }, [broadcastStream, isBroadcasting, hasExternalBroadcast]);

  useEffect(() => {
    if (!cameraVideoRef.current) {
      return;
    }

    attachVideoStream(cameraVideoRef.current, cameraStreamRef.current, { muted: true });
  }, [isCameraOn]);

  const closeViewerPeer = useCallback(() => {
    if (viewerPeerRef.current) {
      viewerPeerRef.current.close();
      viewerPeerRef.current = null;
    }
    viewerBroadcasterSocketIdRef.current = null;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    remotePlaybackStreamRef.current = null;
    onRemoteStreamChange?.(null);
    setLiveDiagnostics((prev) => ({ ...prev, recvVideo: false, recvAudio: false }));
  }, [onRemoteStreamChange]);

  const closeBroadcasterPeers = useCallback(() => {
    for (const pc of broadcasterPeersRef.current.values()) {
      pc.close();
    }
    broadcasterPeersRef.current.clear();
  }, []);

  const stopBroadcast = useCallback((stopMedia = true) => {
    setIsBroadcasting(false);
    closeBroadcasterPeers();

    if (stopMedia && broadcastModeRef.current === 'manual') {
      stopTracks(localStreamRef.current);
      stopTracks(microphoneStreamRef.current);
    }

    localStreamRef.current = null;
    microphoneStreamRef.current = null;
    sourceBroadcastStreamRef.current = null;
    broadcastModeRef.current = null;
    setLiveDiagnostics({ publishVideo: false, publishAudio: false, recvVideo: false, recvAudio: false });
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
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      let microphoneStream = null;
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        });
      } catch {
        // Keep broadcasting even if the microphone cannot be captured.
      }

      const screenVideoTrack = screenStream.getVideoTracks()[0] || null;
      if (!screenVideoTrack) {
        throw new Error('No screen video track was captured.');
      }

      const preferredAudioTrack =
        microphoneStream?.getAudioTracks()?.[0] ||
        screenStream.getAudioTracks()?.[0] ||
        null;

      const stream = new MediaStream([
        screenVideoTrack,
        ...(preferredAudioTrack ? [preferredAudioTrack] : []),
      ]);

      localStreamRef.current = stream;
      microphoneStreamRef.current = microphoneStream;
      setLiveDiagnostics({
        publishVideo: Boolean(stream.getVideoTracks().length),
        publishAudio: Boolean(stream.getAudioTracks().length),
        recvVideo: false,
        recvAudio: false,
      });
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => {
          stopBroadcast();
        };
      }

      broadcastModeRef.current = 'manual';
      setIsBroadcasting(true);
      setLiveHostName(String(hostName || '').trim() || 'You');
      setStatus(stream.getAudioTracks().length > 0 ? 'You are live with audio. Waiting for participants to connect...' : 'You are live, but no audio track was captured. Waiting for participants to connect...');
      socketRef.current.emit('live:publish', { sessionId: normalizedSessionId, hostName });
    } catch (err) {
      setError(err?.message || 'Unable to start live stream.');
    }
  }, [canBroadcast, hostName, isBroadcasting, normalizedSessionId, stopBroadcast]);

  const createBroadcasterPeer = useCallback(async (viewerSocketId) => {
    if (!localStreamRef.current || !socketRef.current) return;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    broadcasterPeersRef.current.set(viewerSocketId, pc);

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    preferVp8Codec(pc);

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
      const [stream] = event.streams || [];
      if (!remotePlaybackStreamRef.current) {
        remotePlaybackStreamRef.current = new MediaStream();
      }

      if (event.track) {
        const existingTrack = remotePlaybackStreamRef.current.getTracks().find((track) => track.id === event.track.id);
        if (!existingTrack) {
          remotePlaybackStreamRef.current.addTrack(event.track);
        }

        setLiveDiagnostics((prev) => ({
          ...prev,
          recvVideo: prev.recvVideo || event.track.kind === 'video',
          recvAudio: prev.recvAudio || event.track.kind === 'audio',
        }));
      }

      const playbackStream = stream || remotePlaybackStreamRef.current;
      onRemoteStreamChange?.(playbackStream || null);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = playbackStream || null;
        const playPromise = remoteVideoRef.current.play?.();
        if (playPromise?.catch) {
          playPromise.catch(() => {
            setStatus('Live connected. Press play to start video if your browser paused playback.');
          });
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        closeViewerPeer();
      }
    };

    return pc;
  }, [closeViewerPeer, normalizedSessionId, onRemoteStreamChange]);

  const startWatching = useCallback(() => {
    if (!socketRef.current || isWatching) return;

    setError('');
    setIsWatching(true);
    setStatus('Connecting to live stream...');
    socketRef.current.emit('live:viewer-ready', {
      sessionId: normalizedSessionId,
      viewerName: resolvedParticipantName,
    });
  }, [isWatching, normalizedSessionId, resolvedParticipantName]);

  const stopWatching = useCallback(() => {
    setIsWatching(false);
    closeViewerPeer();
    setStatus(isLive ? 'Live stream available. Click Watch Live.' : 'No live stream in progress.');
  }, [closeViewerPeer, isLive]);

  const upsertCameraPublisher = useCallback((socketId, name) => {
    if (!socketId) return;
    setCameraPublishers((prev) => {
      const existingIndex = prev.findIndex((item) => item.socketId === socketId);
      const nextItem = {
        socketId,
        name: String(name || '').trim() || 'Participant',
      };

      if (existingIndex === -1) {
        return [...prev, nextItem];
      }

      const next = [...prev];
      next[existingIndex] = { ...next[existingIndex], ...nextItem };
      return next;
    });
  }, []);

  const removeCameraPublisher = useCallback((socketId) => {
    if (!socketId) return;

    setCameraPublishers((prev) => prev.filter((item) => item.socketId !== socketId));
    const subscriberPc = cameraSubscriberPeersRef.current.get(socketId);
    if (subscriberPc) {
      subscriberPc.close();
      cameraSubscriberPeersRef.current.delete(socketId);
    }

    const stream = remoteCameraStreamsRef.current.get(socketId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      remoteCameraStreamsRef.current.delete(socketId);
    }
  }, []);

  const subscribeToCameraPublisher = useCallback((publisherSocketId) => {
    if (!socketRef.current || !publisherSocketId) return;
    if (publisherSocketId === socketRef.current.id) return;
    if (cameraSubscriberPeersRef.current.has(publisherSocketId)) return;

    socketRef.current.emit('camera:subscribe', {
      sessionId: normalizedSessionId,
      publisherSocketId,
    });
  }, [normalizedSessionId]);

  const stopCameraPreview = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('camera:unpublish', { sessionId: normalizedSessionId });
    }

    for (const pc of cameraPublisherPeersRef.current.values()) {
      pc.close();
    }
    cameraPublisherPeersRef.current.clear();

    for (const pc of cameraSubscriberPeersRef.current.values()) {
      pc.close();
    }
    cameraSubscriberPeersRef.current.clear();

    for (const stream of remoteCameraStreamsRef.current.values()) {
      stream.getTracks().forEach((track) => track.stop());
    }
    remoteCameraStreamsRef.current.clear();

    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
    setIsMicrophoneOn(false);
    setCameraPublishers([]);
  }, [normalizedSessionId]);

  const startCameraPreview = useCallback(async () => {
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      cameraStreamRef.current = stream;
      setIsCameraOn(true);
      setIsMicrophoneOn(stream.getAudioTracks().some((track) => track.enabled));

      if (socketRef.current) {
        socketRef.current.emit('camera:publish', {
          sessionId: normalizedSessionId,
          name: resolvedParticipantName,
        });
      }
    } catch (err) {
      setCameraError(err?.message || 'Unable to access camera.');
      stopCameraPreview();
    }
  }, [resolvedParticipantName, stopCameraPreview]);

  const toggleCameraPreview = useCallback(() => {
    if (isCameraOn) {
      stopCameraPreview();
      return;
    }

    startCameraPreview();
  }, [isCameraOn, startCameraPreview, stopCameraPreview]);

  const toggleMicrophonePreview = useCallback(() => {
    if (!cameraStreamRef.current) return;

    const audioTracks = cameraStreamRef.current.getAudioTracks();
    if (!audioTracks.length) return;

    const nextEnabled = !audioTracks.some((track) => track.enabled);
    audioTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsMicrophoneOn(nextEnabled);
  }, []);

  const sendModerationCommand = useCallback((targetSocketId, command) => {
    if (!socketRef.current || !isCurrentHost || !targetSocketId) return;

    socketRef.current.emit('camera:moderation-command', {
      sessionId: normalizedSessionId,
      targetSocketId,
      command,
    });
  }, [isCurrentHost, normalizedSessionId]);

  useEffect(() => {
    if (!isLive || isBroadcastingRef.current || !socketConnected || isWatchingRef.current) {
      return;
    }

    startWatching();
  }, [isLive, socketConnected, startWatching]);

  useEffect(() => {
    if (!canBroadcast || !socketRef.current) {
      return undefined;
    }

    if (!broadcastStream) {
      if (broadcastModeRef.current === 'external' && isBroadcasting) {
        stopBroadcast(false);
        setStatus('Live stream ended because local recording stopped.');
      }
      return undefined;
    }

    if (sourceBroadcastStreamRef.current === broadcastStream && isBroadcasting) {
      return undefined;
    }

    if (!broadcastStream.getVideoTracks().length) {
      setError('Live stream cannot start because no screen video track was captured.');
      return undefined;
    }

    // Do not auto-publish if another host is already live.
    if (isLive && !isBroadcastingRef.current) {
      const hostLabel = liveHostName ? ` (${liveHostName})` : '';
      setStatus(`Live is already active${hostLabel}. Your recording will stay local unless the current host stops.`);
      return undefined;
    }

    if (broadcastModeRef.current !== 'external') {
      stopTracks(localStreamRef.current);
    }
    localStreamRef.current = buildOutboundStream(broadcastStream, false);
    sourceBroadcastStreamRef.current = broadcastStream;
    broadcastModeRef.current = 'external';
    setLiveDiagnostics({
      publishVideo: Boolean(localStreamRef.current.getVideoTracks().length),
      publishAudio: Boolean(localStreamRef.current.getAudioTracks().length),
      recvVideo: false,
      recvAudio: false,
    });
    if (!isBroadcasting) {
      setError('');
      setIsBroadcasting(true);
      setLiveHostName(String(hostName || '').trim() || 'You');
      setStatus('Live via local recording. Participants can now watch.');
      socketRef.current.emit('live:publish', { sessionId: normalizedSessionId, hostName: resolvedParticipantName });
    }

    return undefined;
  }, [broadcastStream, canBroadcast, isBroadcasting, isLive, liveHostName, normalizedSessionId, resolvedParticipantName, stopBroadcast]);

  useEffect(() => {
    if (!Number.isInteger(normalizedSessionId) || normalizedSessionId <= 0) {
      return undefined;
    }

    const socket = io(getSocketBaseUrl());
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('joinSessionLive', normalizedSessionId);
      socket.emit('live:status-request', { sessionId: normalizedSessionId });

      if (isCameraOnRef.current) {
        socket.emit('camera:publish', { sessionId: normalizedSessionId, name: resolvedParticipantName });
      }

      // Recover session state on reconnect.
      if (isBroadcastingRef.current) {
        socket.emit('live:publish', { sessionId: normalizedSessionId, hostName: resolvedParticipantName });
      }

      if (isWatchingRef.current) {
        socket.emit('live:viewer-ready', { sessionId: normalizedSessionId, viewerName: resolvedParticipantName });
      }
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('live:status', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;

      const active = Boolean(payload?.active);
      setIsLive(active);
      setLiveHostName(String(payload?.broadcasterName || '').trim());
      setLiveHostSocketId(payload?.broadcasterSocketId || null);
      setParticipantCount(Number(payload?.participantCount || 0));
      setViewerCount(Number(payload?.viewerCount || 0));

      if (!active) {
        if (isWatchingRef.current) {
          closeViewerPeer();
          setIsWatching(false);
        }
        setLiveHostName('');
        setLiveHostSocketId(null);
        if (!isBroadcastingRef.current) {
          setStatus('No live stream in progress.');
        }
      } else if (!isBroadcastingRef.current) {
        setStatus('Live stream is active.');
      }

      if (!active) {
        setLiveDiagnostics({ publishVideo: false, publishAudio: false, recvVideo: false, recvAudio: false });
      }
    });

    socket.on('live:error', (payload) => {
      setError(payload?.message || 'Live streaming error.');
    });

    socket.on('live:participants', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;

      const participants = Array.isArray(payload?.participants) ? payload.participants : [];
      setLiveParticipants(
        participants.map((item) => ({
          socketId: item?.socketId,
          name: String(item?.name || '').trim() || 'Participant',
          type: item?.type === 'host' ? 'host' : 'viewer',
        }))
      );
      setParticipantCount(Number(payload?.participantCount || participants.length || 0));
      setViewerCount(Number(payload?.viewerCount || 0));
    });

    socket.on('live:viewer-joined', async (payload) => {
      if (!canBroadcast || !isBroadcastingRef.current) return;
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
      if (!isWatchingRef.current) return;
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
      if (!isBroadcastingRef.current) return;
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
        if (isBroadcastingRef.current) {
          const pc = broadcasterPeersRef.current.get(payload.fromSocketId);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          }
          return;
        }

        const pc = isWatchingRef.current ? viewerPeerRef.current : null;
        if (pc && viewerBroadcasterSocketIdRef.current === payload.fromSocketId) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        // ignore sporadic ICE candidate race conditions
      }
    });

    socket.on('camera:list', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;

      const publishers = Array.isArray(payload?.publishers) ? payload.publishers : [];
      setCameraPublishers(
        publishers
          .filter((item) => item?.publisherSocketId && item.publisherSocketId !== socket.id)
          .map((item) => ({
            socketId: item.publisherSocketId,
            name: String(item.name || '').trim() || 'Participant',
          }))
      );

      publishers.forEach((item) => {
        const publisherSocketId = item?.publisherSocketId;
        if (!publisherSocketId || publisherSocketId === socket.id) return;
        subscribeToCameraPublisher(publisherSocketId);
      });
    });

    socket.on('camera:published', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      const publisherSocketId = payload?.publisherSocketId;
      if (!publisherSocketId || publisherSocketId === socket.id) return;

      upsertCameraPublisher(publisherSocketId, payload?.name);
      subscribeToCameraPublisher(publisherSocketId);
    });

    socket.on('camera:unpublished', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      removeCameraPublisher(payload?.publisherSocketId);
    });

    socket.on('camera:subscriber-joined', async (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!isCameraOnRef.current || !cameraStreamRef.current) return;

      const subscriberSocketId = payload?.subscriberSocketId;
      if (!subscriberSocketId) return;

      try {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        cameraPublisherPeersRef.current.set(subscriberSocketId, pc);

        cameraStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, cameraStreamRef.current);
        });

        pc.onicecandidate = (event) => {
          if (!event.candidate) return;
          socket.emit('camera:ice-candidate', {
            sessionId: normalizedSessionId,
            targetSocketId: subscriberSocketId,
            candidate: event.candidate,
          });
        };

        pc.onconnectionstatechange = () => {
          if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
            pc.close();
            cameraPublisherPeersRef.current.delete(subscriberSocketId);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('camera:offer', {
          sessionId: normalizedSessionId,
          targetSocketId: subscriberSocketId,
          sdp: offer,
        });
      } catch {
        // Keep live session stable if a camera peer fails.
      }
    });

    socket.on('camera:offer', async (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.fromSocketId || !payload?.sdp) return;

      const publisherSocketId = payload.fromSocketId;

      try {
        let pc = cameraSubscriberPeersRef.current.get(publisherSocketId);
        if (!pc) {
          pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
          cameraSubscriberPeersRef.current.set(publisherSocketId, pc);

          pc.onicecandidate = (event) => {
            if (!event.candidate) return;
            socket.emit('camera:ice-candidate', {
              sessionId: normalizedSessionId,
              targetSocketId: publisherSocketId,
              candidate: event.candidate,
            });
          };

          pc.ontrack = (event) => {
            const [stream] = event.streams || [];
            if (!stream) return;

            remoteCameraStreamsRef.current.set(publisherSocketId, stream);
            upsertCameraPublisher(publisherSocketId);

            const node = cameraTileVideoRefs.current.get(publisherSocketId);
            if (node) {
              node.srcObject = stream;
              node.play?.().catch(() => {});
            }
          };

          pc.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
              pc.close();
              cameraSubscriberPeersRef.current.delete(publisherSocketId);
            }
          };
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('camera:answer', {
          sessionId: normalizedSessionId,
          targetSocketId: publisherSocketId,
          sdp: answer,
        });
      } catch {
        // Keep live session stable if a camera peer fails.
      }
    });

    socket.on('camera:answer', async (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.fromSocketId || !payload?.sdp) return;

      const pc = cameraPublisherPeersRef.current.get(payload.fromSocketId);
      if (!pc) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      } catch {
        // Keep live session stable if a camera peer fails.
      }
    });

    socket.on('camera:ice-candidate', async (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;
      if (!payload?.candidate || !payload?.fromSocketId) return;

      const fromSocketId = payload.fromSocketId;

      try {
        const publisherPc = cameraPublisherPeersRef.current.get(fromSocketId);
        if (publisherPc) {
          await publisherPc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          return;
        }

        const subscriberPc = cameraSubscriberPeersRef.current.get(fromSocketId);
        if (subscriberPc) {
          await subscriberPc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      } catch {
        // ignore sporadic ICE race conditions
      }
    });

    socket.on('camera:moderation-command', (payload) => {
      if (Number(payload?.sessionId) !== normalizedSessionId) return;

      const command = String(payload?.command || '').trim().toLowerCase();
      if (!['disable-camera', 'disable-audio'].includes(command)) return;

      if (command === 'disable-camera') {
        if (cameraStreamRef.current) {
          const videoTracks = cameraStreamRef.current.getVideoTracks();
          videoTracks.forEach((track) => {
            track.enabled = false;
          });
        }

        setIsCameraOn(false);
        setCameraError('Host disabled your camera. You may turn it on again when allowed.');
        return;
      }

      if (command === 'disable-audio' && cameraStreamRef.current) {
        const audioTracks = cameraStreamRef.current.getAudioTracks();
        audioTracks.forEach((track) => {
          track.enabled = false;
        });
        setIsMicrophoneOn(false);
        setCameraError('Host muted your camera audio.');
      }
    });

    return () => {
      if (isBroadcastingRef.current) {
        stopBroadcast(broadcastModeRef.current === 'manual');
      }
      stopCameraPreview();
      closeViewerPeer();
      socket.disconnect();
      socketRef.current = null;
      closeBroadcasterPeers();
      closeViewerPeer();
      for (const pc of cameraPublisherPeersRef.current.values()) {
        pc.close();
      }
      cameraPublisherPeersRef.current.clear();
      for (const pc of cameraSubscriberPeersRef.current.values()) {
        pc.close();
      }
      cameraSubscriberPeersRef.current.clear();
      for (const stream of remoteCameraStreamsRef.current.values()) {
        stream.getTracks().forEach((track) => track.stop());
      }
      remoteCameraStreamsRef.current.clear();
      setCameraPublishers([]);
      setLiveParticipants([]);
      setParticipantCount(0);
      setViewerCount(0);
      setParticipantActivity([]);
    };
  }, [
    canBroadcast,
    closeBroadcasterPeers,
    closeViewerPeer,
    createBroadcasterPeer,
    createViewerPeer,
    hostName,
    normalizedSessionId,
    resolvedParticipantName,
    removeCameraPublisher,
    sendModerationCommand,
    stopCameraPreview,
    stopBroadcast,
    subscribeToCameraPublisher,
    upsertCameraPublisher,
  ]);

  return (
    <section className="detail-section full-width live-session-panel">
      <h3>Live Session</h3>

      <div className="live-session-actions">
        {canBroadcast && !isBroadcasting && !hasExternalBroadcast && (
          <button type="button" className="btn-live-start" onClick={startBroadcast} disabled={isLive}>
            {isLive ? 'Live Already Active' : 'Start Live'}
          </button>
        )}

        {canBroadcast && isBroadcasting && !hasExternalBroadcast && (
          <button type="button" className="btn-live-stop" onClick={stopBroadcast}>
            Stop Live
          </button>
        )}

        {isLive && !isBroadcasting && !isWatching && (
          <button type="button" className="btn-live-watch" onClick={startWatching} disabled={!isLive}>
            Watch Live
          </button>
        )}

        {!isLive && !isBroadcasting && !hasExternalBroadcast && !canBroadcast && (
          <button type="button" className="btn-live-watch" onClick={startWatching} disabled>
            Waiting for Live
          </button>
        )}

        <button
          type="button"
          className={isCameraOn ? 'btn-live-stop' : 'btn-live-watch'}
          onClick={toggleCameraPreview}
        >
          {isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
        </button>

        {isCameraOn && (
          <button
            type="button"
            className={isMicrophoneOn ? 'btn-live-stop' : 'btn-live-watch'}
            onClick={toggleMicrophonePreview}
          >
            {isMicrophoneOn ? 'Turn Off Mic' : 'Turn On Mic'}
          </button>
        )}

        {isWatching && (
          <button type="button" className="btn-live-stop" onClick={stopWatching}>
            Leave Live
          </button>
        )}
      </div>

      <p className="live-session-status">{status}</p>
      {isLive && liveHostLabel && (
        <p className="live-session-host">Live started by: {liveHostLabel}</p>
      )}
      <div className="live-video-block" style={{ marginTop: '0.5rem' }}>
        <label htmlFor="live-participant-name">Display Name</label>
        <input
          id="live-participant-name"
          type="text"
          value={participantName}
          onChange={(event) => setParticipantName(event.target.value)}
          placeholder="Enter your name for live participants"
          maxLength={120}
          style={{ width: '100%', maxWidth: 460, padding: '0.55rem 0.65rem', borderRadius: 8, border: '1px solid #d5d7db' }}
        />
        <p className="live-session-status" style={{ marginTop: '0.4rem' }}>
          Participants joined: {participantCount} total ({viewerCount} viewer{viewerCount === 1 ? '' : 's'})
        </p>
        {liveParticipants.length > 0 && (
          <p className="live-session-host" style={{ marginTop: 0.25 }}>
            {liveParticipants.map((item) => item.type === 'host' ? `${item.name} (Host)` : item.name).join(', ')}
          </p>
        )}
        {participantActivity.length > 0 && (
          <div style={{ marginTop: '0.4rem' }}>
            <p className="live-session-host" style={{ margin: '0 0 0.25rem 0', fontWeight: 600 }}>
              Activity
            </p>
            <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid #eceef2', borderRadius: 8, padding: '0.35rem 0.5rem', background: '#fafbfc' }}>
              {participantActivity.map((entry) => (
                <p key={entry.id} className="live-session-host" style={{ margin: '0.15rem 0', color: entry.kind === 'left' ? '#8e4b10' : '#1e5631' }}>
                  [{entry.timestamp}] {entry.message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
      {error && <p className="live-session-error">{error}</p>}
      {cameraError && <p className="live-session-error">{cameraError}</p>}
      <p className="live-session-diagnostics">
        Socket: {socketConnected ? 'connected' : 'disconnected'} · Publish: {liveDiagnostics.publishVideo ? 'video' : 'no video'} / {liveDiagnostics.publishAudio ? 'audio' : 'no audio'} · Receive: {liveDiagnostics.recvVideo ? 'video' : 'no video'} / {liveDiagnostics.recvAudio ? 'audio' : 'no audio'}
      </p>

      {hasExternalBroadcast && canBroadcast && (
        <p className="live-session-status">Local recording is also broadcasting live to participants.</p>
      )}

      {(isBroadcasting || hasExternalBroadcast) && (
        <div className="live-video-block">
          <label>Live Preview</label>
          <video ref={localVideoRef} autoPlay muted playsInline className="live-video" />
        </div>
      )}

      {isCameraOn && (
        <div className="live-video-block">
          <label>Your Camera</label>
          <video ref={cameraVideoRef} autoPlay muted playsInline className="live-video" />
        </div>
      )}

      {cameraPublishers.length > 0 && (
        <div className="live-video-block">
          <label>Participant Cameras</label>
          <div className="live-camera-grid">
            {cameraPublishers.map((item) => (
              <div key={item.socketId} className="live-camera-tile">
                <video
                  autoPlay
                  playsInline
                  controls
                  className="live-video"
                  ref={(node) => {
                    if (!node) {
                      cameraTileVideoRefs.current.delete(item.socketId);
                      return;
                    }

                    cameraTileVideoRefs.current.set(item.socketId, node);
                    const stream = remoteCameraStreamsRef.current.get(item.socketId);
                    if (stream) {
                      node.srcObject = stream;
                      node.play?.().catch(() => {});
                    }
                  }}
                />
                <p className="live-camera-name">{item.name || 'Participant'}</p>
                {isCurrentHost && (
                  <div className="live-participant-controls">
                    <button type="button" className="btn-live-stop" onClick={() => sendModerationCommand(item.socketId, 'disable-camera')}>
                      Disable Camera
                    </button>
                    <button type="button" className="btn-live-watch" onClick={() => sendModerationCommand(item.socketId, 'disable-audio')}>
                      Disable Audio
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isWatching && !isBroadcasting && (
        <div className="live-video-block">
          <label>Live Stream</label>
          <video ref={remoteVideoRef} autoPlay muted playsInline controls className="live-video" />
        </div>
      )}
    </section>
  );
}
