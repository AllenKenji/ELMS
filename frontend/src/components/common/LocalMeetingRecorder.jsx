import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import '../../styles/LocalMeetingRecorder.css';

const MIME_TYPE_CANDIDATES = [
  'video/webm',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9,opus',
];

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
    return new MediaRecorder(stream);
  } catch {
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      throw new Error('This browser does not support a compatible recording format.');
    }

    return new MediaRecorder(stream, { mimeType });
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

function getRecorderErrorMessage(error) {
  if (error?.name === 'NotAllowedError') {
    return 'Recording was blocked. Allow screen and microphone access to continue.';
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

async function buildBlobFromChunks(chunks, mimeType) {
  const buffers = await Promise.all(chunks.map((chunk) => chunk.arrayBuffer()));
  const totalBytes = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);

  if (!totalBytes) {
    return { blob: new Blob([], { type: mimeType || 'video/webm' }), totalBytes: 0 };
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buffer of buffers) {
    merged.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return {
    blob: new Blob([merged.buffer], { type: mimeType || 'video/webm' }),
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
  recordingUrl,
  recordingUploadedAt,
  recordingUploadedByName,
  onUploadComplete,
  onCaptureStarted,
  onCaptureStopped,
  onRecordingStateChange,
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
  const uploadedRecordingHref = useMemo(() => buildRecordingUrl(recordingUrl), [recordingUrl]);
  const uploadedRecordingLabel = useMemo(() => formatRecordingDate(recordingUploadedAt), [recordingUploadedAt]);

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
      const response = await api.post(
        uploadUrl || `/committees/${committeeId}/meetings/${meetingId}/recording`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
            }
          },
        }
      );

      setUploadProgress(100);
      setStatus('Recording saved locally and uploaded to the server.');
      toast.success('Recording uploaded to the server.');
      await Promise.resolve(onUploadComplete?.(response.data));
    } catch (uploadError) {
      const message = getApiErrorMessage(uploadError, 'Recording was saved locally but the server upload failed.');
      setError(message);
      setStatus('Recording was saved locally but was not uploaded to the server.');
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
    setStatus('Requesting screen/tab and microphone access...');
    chunksRef.current = [];

    try {
      let screenStream = null;
      let microphoneStream = null;
      let videoTrack = preferredCaptureStream?.getVideoTracks?.()?.[0] || null;
      let recordingAudioTrack = preferredCaptureStream?.getAudioTracks?.()?.[0] || null;
      let recordingStream = null;

      if (videoTrack) {
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
        const screenAudioTrack = screenStream.getAudioTracks()?.[0] || null;
        const microphoneAudioTrack = microphoneStream?.getAudioTracks()?.[0] || null;
        recordingAudioTrack = microphoneAudioTrack || screenAudioTrack || null;
        recordingStream = new MediaStream([videoTrack]);
        usesExternalCaptureRef.current = false;
      }

      if (!videoTrack) {
        throw new Error('No screen video track was captured.');
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
          setIsRecording(false);
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
        setIsRecording(false);
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
  }, [canUploadToServer, cleanupMedia, isRecording, isSupported, localDownload?.href, meetingTitle, onCaptureStarted, onCaptureStopped, preferredCaptureStream, prepareRecordingDownload, stopRecording, subjectLabel, uploadRecordingToServer]);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

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

      onCaptureStopped?.();
      cleanupMedia();
    };
  }, [cleanupMedia, onCaptureStopped]);

  const handleStartClick = useCallback(() => {
    if (!isSupported || isRecording || isUploading) {
      return;
    }

    setShowTipsModal(true);
  }, [isRecording, isSupported, isUploading]);

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
            Start Local Recording
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
            {(uploadedRecordingLabel || recordingUploadedByName) && (
              <p className="committee-recorder-meta">
                {recordingUploadedByName ? `Uploaded by ${recordingUploadedByName}` : 'Uploaded'}
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
          Share the {subjectLabel} tab or window and enable audio when the browser asks for permission.
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
              <li>Choose the {subjectLabel} tab or window in the browser share dialog.</li>
              <li>Turn on tab audio or system audio if the browser offers that option.</li>
              <li>Keep this page open until you press Stop &amp; Save.</li>
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