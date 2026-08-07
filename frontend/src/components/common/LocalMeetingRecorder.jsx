import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import '../../styles/LocalMeetingRecorder.css';

const MIME_TYPE_CANDIDATES = [
  'video/webm',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
];

const RECORDER_VIDEO_BITS_PER_SECOND = 1_600_000;
const RECORDER_AUDIO_BITS_PER_SECOND = 96_000;
const RECORDER_MAX_WIDTH = 1280;
const RECORDER_MAX_HEIGHT = 720;
const RECORDER_MAX_FPS = 24;
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_DELAY_MS = 1500;
const VIDEO_METADATA_WAIT_TIMEOUT_MS = 2500;

function getSupportedMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }

  return MIME_TYPE_CANDIDATES.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || '';
}

function createMediaRecorder(stream) {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser.');
  }

  try {
    return new MediaRecorder(stream, {
      videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
    });
  } catch {
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('This browser does not support a compatible recording format.');
    }

    return new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: RECORDER_VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: RECORDER_AUDIO_BITS_PER_SECOND,
    });
  }
}

async function applyRecordingTrackConstraints(videoTrack) {
  if (!videoTrack || typeof videoTrack.applyConstraints !== 'function') {
    return;
  }

  try {
    await videoTrack.applyConstraints({
      width: { ideal: RECORDER_MAX_WIDTH, max: RECORDER_MAX_WIDTH },
      height: { ideal: RECORDER_MAX_HEIGHT, max: RECORDER_MAX_HEIGHT },
      frameRate: { ideal: RECORDER_MAX_FPS, max: RECORDER_MAX_FPS },
    });
  } catch {
    // Ignore unsupported constraints and continue recording.
  }
}

function buildRecordingFilename(meetingTitle) {
  const safeTitle = String(meetingTitle || 'meeting-recording')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'meeting-recording';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeTitle}-${timestamp}.webm`;
}

function getFileExtensionForMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mp4')) {
    return 'mp4';
  }

  return 'webm';
}

function buildRecordingFilenameForMimeType(meetingTitle, mimeType) {
  const baseName = buildRecordingFilename(meetingTitle).replace(/\.[a-z0-9]+$/i, '');
  return `${baseName}.${getFileExtensionForMimeType(mimeType)}`;
}

function isLikelyVideoFile(file) {
  if (!file) {
    return false;
  }

  const mimeType = String(file.type || '').toLowerCase();
  if (mimeType.startsWith('video/')) {
    return true;
  }

  const extension = String(file.name || '').toLowerCase().split('.').pop() || '';
  return ['webm', 'mp4', 'mov', 'mkv', 'm4v', 'ogg'].includes(extension);
}

function getRecorderErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Recording was blocked. Allow the requested capture permission to continue.';
  }

  if (error?.name === 'NotFoundError') {
    return 'No microphone or shareable screen source was found on this laptop.';
  }

  if (error?.name === 'NotSupportedError') {
    return 'This browser does not support local meeting recording.';
  }

  return 'Unable to start local recording.';
}

function getApiErrorMessage(error, fallbackMessage) {
  return error?.response?.data?.error || error?.message || fallbackMessage;
}

function buildRecordingUrl(recordingUrl) {
  if (!recordingUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(recordingUrl)) {
    return recordingUrl;
  }

  return `${api.defaults.baseURL}${recordingUrl}`;
}

function formatRecordingDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function waitForNextTick() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function waitForDelay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isRetryableUploadError(error) {
  const status = Number(error?.status || error?.response?.status || 0);
  if ([0, 408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = String(error?.message || '').toLowerCase();
  return message.includes('network') || message.includes('timeout') || message.includes('temporarily unavailable');
}

function waitForVideoMetadata(videoElement, timeoutMs = VIDEO_METADATA_WAIT_TIMEOUT_MS) {
  if (!videoElement || videoElement.readyState >= 1) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId = null;

    const finalize = (ready) => {
      if (resolved) {
        return;
      }

      resolved = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      videoElement.removeEventListener('loadedmetadata', handleLoaded);
      videoElement.removeEventListener('error', handleError);
      resolve(Boolean(ready));
    };

    const handleLoaded = () => {
      finalize(true);
    };

    const handleError = () => {
      finalize(false);
    };

    timeoutId = window.setTimeout(() => finalize(false), timeoutMs);
    videoElement.addEventListener('loadedmetadata', handleLoaded, { once: true });
    videoElement.addEventListener('error', handleError, { once: true });
  });
}

async function createCompositeRecordingStream(baseStream, overlayStream) {
  const baseVideoTrack = baseStream?.getVideoTracks?.()[0] || null;
  const overlayVideoTrack = overlayStream?.getVideoTracks?.()[0] || null;

  if (!baseVideoTrack || !overlayVideoTrack || typeof document === 'undefined') {
    return { stream: baseStream, cleanup: () => {} };
  }

  const baseVideo = document.createElement('video');
  baseVideo.autoplay = true;
  baseVideo.muted = true;
  baseVideo.playsInline = true;
  baseVideo.srcObject = new MediaStream([baseVideoTrack.clone()]);

  const overlayVideo = document.createElement('video');
  overlayVideo.autoplay = true;
  overlayVideo.muted = true;
  overlayVideo.playsInline = true;
  overlayVideo.srcObject = new MediaStream([overlayVideoTrack.clone()]);

  const [isBaseReady, isOverlayReady] = await Promise.all([
    waitForVideoMetadata(baseVideo),
    waitForVideoMetadata(overlayVideo),
    baseVideo.play?.().catch(() => {}),
    overlayVideo.play?.().catch(() => {}),
  ]);

  if (!isBaseReady || !isOverlayReady) {
    baseVideo.srcObject = null;
    overlayVideo.srcObject = null;
    return { stream: baseStream, cleanup: () => {} };
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const baseWidth = baseVideo.videoWidth || 1280;
  const baseHeight = baseVideo.videoHeight || 720;
  canvas.width = baseWidth;
  canvas.height = baseHeight;

  let frameHandle = null;
  const drawFrame = () => {
    if (!context) {
      return;
    }

    const nextWidth = baseVideo.videoWidth || baseWidth;
    const nextHeight = baseVideo.videoHeight || baseHeight;
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(baseVideo, 0, 0, canvas.width, canvas.height);

    const overlayWidth = Math.max(220, Math.round(canvas.width * 0.24));
    const overlayHeight = Math.round(overlayWidth * 9 / 16);
    const margin = Math.max(12, Math.round(canvas.width * 0.015));
    const overlayX = canvas.width - overlayWidth - margin;
    const overlayY = canvas.height - overlayHeight - margin;

    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(overlayX - 4, overlayY - 4, overlayWidth + 8, overlayHeight + 8);
    context.drawImage(overlayVideo, overlayX, overlayY, overlayWidth, overlayHeight);

    frameHandle = window.requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const compositeStream = canvas.captureStream(30);
  baseStream.getAudioTracks().forEach((track) => {
    compositeStream.addTrack(track.clone());
  });

  return {
    stream: compositeStream,
    cleanup: () => {
      if (frameHandle) {
        window.cancelAnimationFrame(frameHandle);
      }

      baseVideo.srcObject = null;
      overlayVideo.srcObject = null;
      compositeStream.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    },
  };
}

async function buildBlobFromChunks(chunks, mimeType) {
  const totalBytes = (chunks || []).reduce((sum, chunk) => sum + (chunk?.size || 0), 0);

  if (!totalBytes) {
    return { blob: new Blob([], { type: mimeType || 'video/webm' }), totalBytes: 0 };
  }

  return {
    blob: new Blob(chunks, { type: mimeType || 'video/webm' }),
    totalBytes,
  };
}

export default function LocalMeetingRecorder({
  meetingTitle,
  committeeId,
  meetingId,
  uploadUrl,
  uploadFields,
  preferredCaptureStream,
  overlayStream,
  recordingUrl,
  recordingUploadedAt,
  recordingUploadedByName,
  onUploadComplete,
  onCaptureStarted,
  onCaptureStopped,
  onRecordingStateChange,
  onUploadStateChange,
  subjectLabel = 'meeting',
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [status, setStatus] = useState(`Record the ${subjectLabel} window or entire screen directly to this laptop.`);
  const [error, setError] = useState('');
  const [localDownload, setLocalDownload] = useState(null);
  const [chunkStats, setChunkStats] = useState({ count: 0, bytes: 0 });
  const [recordingLinkInput, setRecordingLinkInput] = useState('');
  const [isSavingRecordingLink, setIsSavingRecordingLink] = useState(false);
  const [isRefreshingRecording, setIsRefreshingRecording] = useState(false);
  const [isDeletingRecording, setIsDeletingRecording] = useState(false);
  const [savedRecording, setSavedRecording] = useState(null);

  const mediaRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const fallbackRecordingStreamRef = useRef(null);
  const usesExternalCaptureRef = useRef(false);
  const saveHandleRef = useRef(null);
  const localDownloadUrlRef = useRef(null);
  const chunksRef = useRef([]);
  const requestDataIntervalRef = useRef(null);
  const noDataWarningTimeoutRef = useRef(null);
  const onCaptureStoppedRef = useRef(onCaptureStopped);
  const compositeCleanupRef = useRef(null);
  const localUploadInputRef = useRef(null);

  useEffect(() => {
    onCaptureStoppedRef.current = onCaptureStopped;
  }, [onCaptureStopped]);

  const isSupported = useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    return Boolean(
      window.MediaRecorder &&
      navigator.mediaDevices?.getDisplayMedia &&
      navigator.mediaDevices?.getUserMedia
    );
  }, []);

  const canUploadToServer = Boolean(uploadUrl || (committeeId && meetingId));
  const canManageCommitteeRecording = Boolean(committeeId && meetingId);
  const uploadedRecordingHref = useMemo(() => buildRecordingUrl(savedRecording?.recording_url), [savedRecording?.recording_url]);
  const uploadedRecordingLabel = useMemo(() => formatRecordingDate(savedRecording?.recording_uploaded_at), [savedRecording?.recording_uploaded_at]);

  useEffect(() => {
    setSavedRecording({
      recording_url: recordingUrl || null,
      recording_uploaded_at: recordingUploadedAt || null,
      recording_uploaded_by_name: recordingUploadedByName || null,
      recording_original_name: null,
    });
  }, [recordingUrl, recordingUploadedAt, recordingUploadedByName]);

  const cleanupMedia = useCallback(() => {
    const ownedStreams = [fallbackRecordingStreamRef.current, screenStreamRef.current, microphoneStreamRef.current];
    if (!usesExternalCaptureRef.current) {
      ownedStreams.unshift(recordingStreamRef.current);
    }

    ownedStreams.forEach((stream) => {
      stream?.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    });

    if (requestDataIntervalRef.current) {
      window.clearInterval(requestDataIntervalRef.current);
      requestDataIntervalRef.current = null;
    }

    if (noDataWarningTimeoutRef.current) {
      window.clearTimeout(noDataWarningTimeoutRef.current);
      noDataWarningTimeoutRef.current = null;
    }

    mediaRecorderRef.current = null;
    screenStreamRef.current = null;
    microphoneStreamRef.current = null;
    recordingStreamRef.current = null;
    fallbackRecordingStreamRef.current = null;
    usesExternalCaptureRef.current = false;
    saveHandleRef.current = null;
    compositeCleanupRef.current?.();
    compositeCleanupRef.current = null;
    chunksRef.current = [];
    setChunkStats({ count: 0, bytes: 0 });
  }, []);

  const prepareRecordingDownload = useCallback((blobSize) => {
    if (!blobSize) {
      toast.error('No recording data was captured.');
      return;
    }

    toast.success('Recording is ready. Click the Download local copy link below to save the file.');
  }, []);

  const uploadRecordingToServer = useCallback(async (blob, filename) => {
    if (!canUploadToServer) {
      return;
    }

    const formData = new FormData();
    formData.append('recording_file', blob, filename);
    Object.entries(uploadFields || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });

    setIsUploading(true);
    setUploadProgress(0);
    setStatus('Uploading recording to the server...');

    try {
      let response = null;
      let lastUploadError = null;

      for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
        setStatus(
          attempt === 1
            ? 'Uploading recording to the server...'
            : `Retrying upload (${attempt}/${UPLOAD_MAX_ATTEMPTS})... Keep this page open.`
        );

        try {
          response = await api.post(
            uploadUrl || `/committees/${committeeId}/meetings/${meetingId}/recording`,
            formData,
            {
              timeout: 15 * 60 * 1000,
              onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                  const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                  setUploadProgress(progress);

                  if (progress >= 100) {
                    setStatus('Upload sent. Saving the recording on the server...');
                  }
                }
              },
            }
          );
          lastUploadError = null;
          break;
        } catch (uploadError) {
          lastUploadError = uploadError;
          if (attempt >= UPLOAD_MAX_ATTEMPTS || !isRetryableUploadError(uploadError)) {
            break;
          }

          const backoffMs = UPLOAD_RETRY_BASE_DELAY_MS * attempt;
          await waitForDelay(backoffMs);
        }
      }

      if (!response) {
        throw lastUploadError || new Error('Upload failed.');
      }

      setStatus('Server save complete. Finalizing upload details...');
      await waitForNextTick();
      setUploadProgress(100);
      setStatus('Upload complete. Recording saved locally and uploaded to the server.');
      toast.success('Recording uploaded to the server.');
      if (response?.data) {
        setSavedRecording(response.data);
      }
      await Promise.resolve(onUploadComplete?.(response.data));
    } catch (uploadError) {
      const message = getApiErrorMessage(uploadError, 'Recording was saved locally but the server upload failed.');
      setError(message);
      setStatus('Recording was saved locally but was not uploaded to the server. Use Upload local copy to retry.');
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }, [canUploadToServer, committeeId, meetingId, onUploadComplete, uploadFields, uploadUrl]);

  const stopRecording = useCallback((showSavedStatus = true) => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder) {
      cleanupMedia();
      setIsRecording(false);
      return;
    }

    if (mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (showSavedStatus) {
      setStatus(canUploadToServer ? 'Finishing recording, saving locally, and preparing the server upload...' : 'Finishing recording and saving the file locally...');
    }
  }, [canUploadToServer, cleanupMedia]);

  const startRecording = useCallback(async () => {
    if (!isSupported || isRecording) {
      return;
    }

    setError('');
    if (localDownloadUrlRef.current) {
      window.URL.revokeObjectURL(localDownloadUrlRef.current);
      localDownloadUrlRef.current = null;
    }

    if (localDownload?.href) {
      window.URL.revokeObjectURL(localDownload.href);
      setLocalDownload(null);
    }
    setChunkStats({ count: 0, bytes: 0 });
    setStatus(
      preferredCaptureStream?.getVideoTracks?.()?.length
        ? 'Preparing the live session recording...'
        : 'Requesting screen/tab access and trying microphone access...'
    );
    chunksRef.current = [];

    try {
      let screenStream = null;
      let microphoneStream = null;
      let videoTrack = preferredCaptureStream?.getVideoTracks?.()?.[0] || null;
      let recordingAudioTrack = preferredCaptureStream?.getAudioTracks?.()?.[0] || null;
      let recordingStream = null;

      if (videoTrack) {
        await applyRecordingTrackConstraints(videoTrack);
        recordingStream = preferredCaptureStream;
        usesExternalCaptureRef.current = true;
      } else {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        try {
          microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
            video: false,
          });
        } catch {
          // Keep recording even if microphone access fails.
          toast.warning('Microphone access is unavailable. Recording will continue with shared tab/system audio only.');
        }

        videoTrack = screenStream.getVideoTracks()?.[0] || null;
        await applyRecordingTrackConstraints(videoTrack);
        const screenAudioTrack = screenStream.getAudioTracks()?.[0] || null;
        const microphoneAudioTrack = microphoneStream?.getAudioTracks()?.[0] || null;
        recordingAudioTrack = microphoneAudioTrack || screenAudioTrack || null;
        recordingStream = new MediaStream([
          videoTrack,
          ...(recordingAudioTrack ? [recordingAudioTrack] : []),
        ]);
        usesExternalCaptureRef.current = false;
      }

      if (!videoTrack) {
        throw new Error('No screen video track was captured.');
      }

      const displaySurface = String(videoTrack.getSettings?.().displaySurface || '').toLowerCase();
      const canSafelyCompositeOverlay = displaySurface !== 'monitor';

      if (overlayStream?.getVideoTracks?.().length && canSafelyCompositeOverlay) {
        const composite = await createCompositeRecordingStream(recordingStream, overlayStream);
        recordingStream = composite.stream;
        compositeCleanupRef.current = composite.cleanup;
      } else if (overlayStream?.getVideoTracks?.().length && !canSafelyCompositeOverlay) {
        toast.info('Presenter camera overlay is disabled for full-screen monitor sharing to avoid green-screen recording issues on some multi-monitor setups.');
      }

      const liveBroadcastStream = new MediaStream([
        videoTrack.clone(),
        ...(recordingAudioTrack ? [recordingAudioTrack.clone()] : []),
      ]);

      const recorder = createMediaRecorder(recordingStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          setChunkStats((prev) => ({
            count: prev.count + 1,
            bytes: prev.bytes + event.data.size,
          }));
        }
      };

      recorder.onstart = () => {
        if (requestDataIntervalRef.current) {
          window.clearInterval(requestDataIntervalRef.current);
          requestDataIntervalRef.current = null;
        }

        if (noDataWarningTimeoutRef.current) {
          window.clearTimeout(noDataWarningTimeoutRef.current);
        }

        noDataWarningTimeoutRef.current = window.setTimeout(() => {
          if (chunksRef.current.length === 0) {
            setStatus('Recording started, but no media chunks received yet. Keep the shared tab active and avoid minimizing it.');
          }
        }, 3500);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setStatus(canUploadToServer ? 'Recording stopped. Saving locally and preparing the server upload...' : 'Recording stopped. Saving the file locally...');
        await waitForNextTick();

        const recordedChunks = [...chunksRef.current];
        const resolvedMimeType = recorder.mimeType || 'video/webm';
        const { blob, totalBytes } = await buildBlobFromChunks(recordedChunks, resolvedMimeType);
        const filename = buildRecordingFilenameForMimeType(meetingTitle, resolvedMimeType);

        onCaptureStopped?.();

        if (!blob.size || !totalBytes) {
          setError('No recording data was captured. Keep the shared tab/window active for a few seconds before stopping.');
          setStatus('Recording stopped, but no file was generated.');
          toast.error('No recording data captured. Try recording again and wait a few seconds before stopping.');
          cleanupMedia();
          return;
        }

        const localFile = new File([blob], filename, { type: resolvedMimeType });
        const localHref = window.URL.createObjectURL(localFile);
        localDownloadUrlRef.current = localHref;
        setLocalDownload({
          href: localHref,
          filename,
          size: localFile.size,
          createdAt: Date.now(),
        });

        prepareRecordingDownload(localFile.size);
        setStatus(`Recording is ready (${Math.max(1, Math.round(localFile.size / 1024))} KB). Click Download local copy below to save it.`);
        if (canUploadToServer) {
          await uploadRecordingToServer(blob, filename);
        } else {
          setStatus(`Recording saved locally for this ${subjectLabel}. Start again if you need another file.`);
        }
        cleanupMedia();
      };

      recorder.onerror = () => {
        setError(`Recording failed while capturing the ${subjectLabel}.`);
        toast.error(`Recording failed while capturing the ${subjectLabel}.`);
        onCaptureStopped?.();
        cleanupMedia();
        setIsRecording(false);
      };

      const screenVideoTrack = screenStream?.getVideoTracks?.()?.[0] || null;
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => stopRecording(false);
      }

      mediaRecorderRef.current = recorder;
      screenStreamRef.current = screenStream;
      microphoneStreamRef.current = microphoneStream;
      recordingStreamRef.current = recordingStream;
      fallbackRecordingStreamRef.current = null;
      onCaptureStarted?.(liveBroadcastStream);

      recorder.start(1000);
      setIsRecording(true);
      setStatus(preferredCaptureStream ? 'Recording the active live stream. Keep this page open until you stop and save.' : 'Recording in progress. Keep this page open until you stop and save.');
      if (!preferredCaptureStream) {
        toast.info(`Choose the ${subjectLabel} tab or window and enable audio in the share dialog.`);
      }
    } catch (recordingError) {
      const message = getRecorderErrorMessage(recordingError);
      setError(message);
      setStatus('Local recording did not start.');
      toast.error(message);
      onCaptureStopped?.();
      cleanupMedia();
      setIsRecording(false);
    }
  }, [canUploadToServer, cleanupMedia, isRecording, isSupported, localDownload?.href, meetingTitle, onCaptureStarted, onCaptureStopped, overlayStream, preferredCaptureStream, prepareRecordingDownload, stopRecording, subjectLabel, uploadRecordingToServer]);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    onUploadStateChange?.(isUploading);
  }, [isUploading, onUploadStateChange]);

  useEffect(() => {
    if (!isUploading) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploading]);

  useEffect(() => {
    return () => {
      const mediaRecorder = mediaRecorderRef.current;

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
      }

      if (localDownloadUrlRef.current) {
        window.URL.revokeObjectURL(localDownloadUrlRef.current);
        localDownloadUrlRef.current = null;
      }

      onCaptureStoppedRef.current?.();
      cleanupMedia();
    };
  }, [cleanupMedia]);

  const handleStartClick = useCallback(() => {
    if (!isSupported || isRecording || isUploading) {
      return;
    }

    if (preferredCaptureStream?.getVideoTracks?.()?.length) {
      startRecording();
      return;
    }

    setShowTipsModal(true);
  }, [isRecording, isSupported, isUploading, preferredCaptureStream, startRecording]);

  const handleProceedFromTips = useCallback(() => {
    setShowTipsModal(false);
    startRecording();
  }, [startRecording]);

  const handleStopClick = useCallback(async () => {
    if (!isRecording) {
      return;
    }

    stopRecording(true);
  }, [isRecording, stopRecording]);

  const handleChooseLocalUpload = useCallback(() => {
    if (!canUploadToServer || isUploading || isRecording) {
      return;
    }

    localUploadInputRef.current?.click();
  }, [canUploadToServer, isRecording, isUploading]);

  const handleLocalFileSelected = useCallback(async (event) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!isLikelyVideoFile(file)) {
      const message = 'Please choose a video file (for example .webm, .mp4, .mov, or .mkv).';
      setError(message);
      toast.error(message);
      return;
    }

    setError('');
    setStatus(`Uploading selected file "${file.name}" to the server...`);
    await uploadRecordingToServer(file, file.name);
  }, [uploadRecordingToServer]);

  const handleSaveRecordingLink = useCallback(async () => {
    if (!canManageCommitteeRecording || isSavingRecordingLink) {
      return;
    }

    const recordingUrlValue = String(recordingLinkInput || '').trim();
    if (!recordingUrlValue) {
      setError('Please enter a recording URL before saving.');
      return;
    }

    try {
      setError('');
      setIsSavingRecordingLink(true);
      const response = await api.post(
        `/committees/${committeeId}/meetings/${meetingId}/recording-link`,
        { recording_url: recordingUrlValue }
      );
      setSavedRecording(response?.data || null);
      setRecordingLinkInput('');
      setStatus('Recording link saved to the server.');
      toast.success('Recording link saved.');
      await Promise.resolve(onUploadComplete?.(response?.data));
    } catch (saveError) {
      const message = getApiErrorMessage(saveError, 'Failed to save recording link.');
      setError(message);
      toast.error(message);
    } finally {
      setIsSavingRecordingLink(false);
    }
  }, [canManageCommitteeRecording, committeeId, isSavingRecordingLink, meetingId, onUploadComplete, recordingLinkInput]);

  const handleRefreshRecording = useCallback(async () => {
    if (!canManageCommitteeRecording || isRefreshingRecording) {
      return;
    }

    try {
      setError('');
      setIsRefreshingRecording(true);
      const response = await api.get(`/committees/${committeeId}/meetings/${meetingId}/recording`);
      setSavedRecording(response?.data || null);
    } catch (refreshError) {
      const message = getApiErrorMessage(refreshError, 'Failed to refresh recording details.');
      setError(message);
    } finally {
      setIsRefreshingRecording(false);
    }
  }, [canManageCommitteeRecording, committeeId, isRefreshingRecording, meetingId]);

  const handleDeleteRecording = useCallback(async () => {
    if (!canManageCommitteeRecording || isDeletingRecording) {
      return;
    }

    if (!window.confirm('Delete the saved recording for this meeting?')) {
      return;
    }

    try {
      setError('');
      setIsDeletingRecording(true);
      await api.delete(`/committees/${committeeId}/meetings/${meetingId}/recording`);
      setSavedRecording({
        recording_url: null,
        recording_uploaded_at: null,
        recording_uploaded_by_name: null,
        recording_original_name: null,
      });
      setStatus('Saved recording removed from the server.');
      toast.success('Saved recording deleted.');
      await Promise.resolve(onUploadComplete?.(null));
    } catch (deleteError) {
      const message = getApiErrorMessage(deleteError, 'Failed to delete recording.');
      setError(message);
      toast.error(message);
    } finally {
      setIsDeletingRecording(false);
    }
  }, [canManageCommitteeRecording, committeeId, isDeletingRecording, meetingId, onUploadComplete]);

  return (
    <>
      <div className="committee-recorder-panel">
        <div className="committee-recorder-header">
          <span className={`committee-recorder-dot ${isRecording ? 'is-recording' : ''}`} />
          <strong>Local Recording</strong>
        </div>
        <p className={`committee-recorder-status ${error ? 'has-error' : ''}`}>
          {error || status}
        </p>
        <div className="committee-recorder-actions">
          <button
            type="button"
            className="btn committee-recorder-button committee-recorder-start"
            onClick={handleStartClick}
            disabled={!isSupported || isRecording || isUploading}
          >
            {preferredCaptureStream?.getVideoTracks?.()?.length ? `Start Recording Live ${subjectLabel}` : 'Start Local Recording'}
          </button>
          <button
            type="button"
            className="btn committee-recorder-button committee-recorder-stop"
            onClick={handleStopClick}
            disabled={!isRecording}
          >
            Stop & Save
          </button>
        </div>
        {canUploadToServer && (
          <div className="committee-recorder-upload-row">
            <span className="committee-recorder-upload-label">Server Sync</span>
            <span className="committee-recorder-upload-value">
              {isUploading ? `Uploading ${uploadProgress}%` : 'Enabled'}
            </span>
          </div>
        )}
        {canUploadToServer && (
          <div className="committee-recorder-upload-row">
            <span className="committee-recorder-upload-label">Manual Upload</span>
            <span className="committee-recorder-upload-value">
              <button
                type="button"
                className="btn committee-recorder-button committee-recorder-save-link"
                onClick={handleChooseLocalUpload}
                disabled={isUploading || isRecording}
              >
                Upload local copy
              </button>
            </span>
            <input
              ref={localUploadInputRef}
              type="file"
              accept="video/*,.webm,.mp4,.mov,.mkv,.m4v,.ogg"
              onChange={handleLocalFileSelected}
              style={{ display: 'none' }}
            />
          </div>
        )}
        {canManageCommitteeRecording && (
          <div className="committee-recorder-link-tools">
            <label className="committee-recorder-upload-label" htmlFor={`recording-link-${committeeId}-${meetingId}`}>
              Save Existing Video Link
            </label>
            <div className="committee-recorder-link-row">
              <input
                id={`recording-link-${committeeId}-${meetingId}`}
                type="url"
                className="committee-recorder-link-input"
                placeholder="https://example.com/recording.mp4"
                value={recordingLinkInput}
                onChange={(event) => setRecordingLinkInput(event.target.value)}
                disabled={isSavingRecordingLink || isDeletingRecording || isUploading}
              />
              <button
                type="button"
                className="btn committee-recorder-button committee-recorder-save-link"
                onClick={handleSaveRecordingLink}
                disabled={isSavingRecordingLink || isDeletingRecording || isUploading}
              >
                {isSavingRecordingLink ? 'Saving...' : 'Save Link'}
              </button>
            </div>
            <div className="committee-recorder-link-actions">
              <button
                type="button"
                className="btn committee-recorder-button committee-recorder-refresh-link"
                onClick={handleRefreshRecording}
                disabled={isRefreshingRecording || isSavingRecordingLink || isDeletingRecording || isUploading}
              >
                {isRefreshingRecording ? 'Refreshing...' : 'Refresh Saved Video'}
              </button>
              <button
                type="button"
                className="btn committee-recorder-button committee-recorder-delete-link"
                onClick={handleDeleteRecording}
                disabled={!savedRecording?.recording_url || isDeletingRecording || isSavingRecordingLink || isUploading}
              >
                {isDeletingRecording ? 'Deleting...' : 'Delete Saved Video'}
              </button>
            </div>
          </div>
        )}
        <div className="committee-recorder-upload-row">
          <span className="committee-recorder-upload-label">Capture Diagnostics</span>
          <span className="committee-recorder-upload-value">
            {chunkStats.count} chunk(s), {Math.max(0, Math.round(chunkStats.bytes / 1024))} KB
          </span>
        </div>
        {uploadedRecordingHref && (
          <div className="committee-recorder-saved">
            <span className="committee-recorder-upload-label">Saved Recording</span>
            <a href={uploadedRecordingHref} target="_blank" rel="noopener noreferrer" className="committee-recorder-link">
              Open server copy
            </a>
            {(uploadedRecordingLabel || savedRecording?.recording_uploaded_by_name) && (
              <p className="committee-recorder-meta">
                {savedRecording?.recording_uploaded_by_name ? `Uploaded by ${savedRecording.recording_uploaded_by_name}` : 'Uploaded'}
                {uploadedRecordingLabel ? ` on ${uploadedRecordingLabel}` : ''}
              </p>
            )}
          </div>
        )}
        {localDownload?.href && (
          <div className="committee-recorder-saved">
            <span className="committee-recorder-upload-label">Local Recording Copy</span>
            <a href={localDownload.href} download={localDownload.filename} className="committee-recorder-link">
              Download local copy
            </a>
            <p className="committee-recorder-meta">
              {localDownload.filename} ({Math.max(1, Math.round(localDownload.size / 1024))} KB)
            </p>
          </div>
        )}
        <p className="committee-recorder-note">
          {preferredCaptureStream?.getVideoTracks?.()?.length
            ? `This recorder will capture the active live ${subjectLabel} stream directly.`
            : `Share the ${subjectLabel} tab or window and enable audio when the browser asks for permission.`}
        </p>
        {!isSupported && (
          <p className="committee-recorder-note committee-recorder-note-warning">
            Use a current desktop version of Chrome or Edge for this feature.
          </p>
        )}
      </div>

      {showTipsModal && (
        <div className="committee-recorder-tips-overlay" role="dialog" aria-modal="true">
          <div className="committee-recorder-tips-card">
            <h4>Before You Start Recording</h4>
            <ul className="committee-recorder-tips-list">
              <li>{preferredCaptureStream?.getVideoTracks?.()?.length ? `The active live ${subjectLabel} stream will be captured directly.` : `Choose the ${subjectLabel} tab or window in the browser share dialog.`}</li>
              <li>{preferredCaptureStream?.getVideoTracks?.()?.length ? 'Keep the live session running while the recording is in progress.' : 'Turn on tab audio or system audio if the browser offers that option.'}</li>
              <li>Keep this page open until you press Stop &amp; Save.</li>
              <li>After Stop &amp; Save, wait for upload completion before refreshing or closing this tab.</li>
              <li>{canUploadToServer ? `The file saves to this laptop first, then uploads to the ${subjectLabel} record.` : `The file saves to this laptop only in this first ${subjectLabel} recording version.`}</li>
            </ul>
            <div className="committee-recorder-tips-actions">
              <button type="button" className="btn committee-recorder-button committee-recorder-start" onClick={handleProceedFromTips}>
                Continue
              </button>
              <button type="button" className="btn committee-recorder-button committee-recorder-tips-cancel" onClick={() => setShowTipsModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}