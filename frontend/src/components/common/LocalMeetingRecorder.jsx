import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/api';
import '../../styles/LocalMeetingRecorder.css';

const MIME_TYPE_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function getSupportedMimeType() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return '';
  }

  return MIME_TYPE_CANDIDATES.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || '';
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

export default function LocalMeetingRecorder({
  meetingTitle,
  committeeId,
  meetingId,
  uploadUrl,
  uploadFields,
  recordingUrl,
  recordingUploadedAt,
  recordingUploadedByName,
  onUploadComplete,
  subjectLabel = 'meeting',
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showTipsModal, setShowTipsModal] = useState(false);
  const [status, setStatus] = useState(`Record the ${subjectLabel} tab/window and microphone directly to this laptop.`);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const chunksRef = useRef([]);

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
    [recordingStreamRef.current, screenStreamRef.current, microphoneStreamRef.current].forEach((stream) => {
      stream?.getTracks().forEach((track) => {
        if (track.readyState === 'live') {
          track.stop();
        }
      });
    });

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }

    mediaRecorderRef.current = null;
    screenStreamRef.current = null;
    microphoneStreamRef.current = null;
    recordingStreamRef.current = null;
    audioContextRef.current = null;
    chunksRef.current = [];
  }, []);

  const downloadRecording = useCallback((blob, filename) => {
    if (!chunksRef.current.length) {
      toast.error('No recording data was captured.');
      return;
    }

    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 1000);
    toast.success('Recording saved to this laptop.');
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

    const mimeType = getSupportedMimeType();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    setError('');
    setStatus('Requesting screen/tab and microphone access...');
    chunksRef.current = [];

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });

      let audioTracks = [];

      if (AudioContextClass) {
        const audioContext = new AudioContextClass();
        const destination = audioContext.createMediaStreamDestination();

        if (screenStream.getAudioTracks().length > 0) {
          const screenAudioSource = audioContext.createMediaStreamSource(new MediaStream(screenStream.getAudioTracks()));
          screenAudioSource.connect(destination);
        }

        if (microphoneStream.getAudioTracks().length > 0) {
          const microphoneAudioSource = audioContext.createMediaStreamSource(new MediaStream(microphoneStream.getAudioTracks()));
          microphoneAudioSource.connect(destination);
        }

        audioContextRef.current = audioContext;
        audioTracks = destination.stream.getAudioTracks();
      } else {
        audioTracks = [
          ...screenStream.getAudioTracks(),
          ...microphoneStream.getAudioTracks(),
        ];
      }

      const recordingStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const recorder = mimeType
        ? new MediaRecorder(recordingStream, { mimeType })
        : new MediaRecorder(recordingStream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'video/webm',
        });
        const filename = buildRecordingFilename(meetingTitle);

        downloadRecording(blob, filename);
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
        cleanupMedia();
        setIsRecording(false);
      };

      const [screenVideoTrack] = screenStream.getVideoTracks();
      if (screenVideoTrack) {
        screenVideoTrack.onended = () => stopRecording(false);
      }

      mediaRecorderRef.current = recorder;
      screenStreamRef.current = screenStream;
      microphoneStreamRef.current = microphoneStream;
      recordingStreamRef.current = recordingStream;

      recorder.start(1000);
      setIsRecording(true);
      setStatus('Recording in progress. Keep this page open until you stop and save.');
      toast.info(`Choose the ${subjectLabel} tab or window and enable audio in the share dialog.`);
    } catch (recordingError) {
      const message = getRecorderErrorMessage(recordingError);
      setError(message);
      setStatus('Local recording did not start.');
      toast.error(message);
      cleanupMedia();
      setIsRecording(false);
    }
  }, [canUploadToServer, cleanupMedia, downloadRecording, isRecording, isSupported, meetingTitle, stopRecording, subjectLabel, uploadRecordingToServer]);

  useEffect(() => {
    return () => {
      const mediaRecorder = mediaRecorderRef.current;

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null;
      }

      cleanupMedia();
    };
  }, [cleanupMedia]);

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
            onClick={() => stopRecording(true)}
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