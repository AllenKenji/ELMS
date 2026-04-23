import api from '../../api/api';
import '../../styles/Minutes.css';
import { FaDownload, FaTimes, FaRobot } from 'react-icons/fa';

function buildRecordingHref(recordingUrl) {
  if (!recordingUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(recordingUrl)) {
    return recordingUrl;
  }

  return `${api.defaults.baseURL}${recordingUrl}`;
}

export default function MinutesDetail({ record, onClose, onExportText, onGenerate, onTranscribeRecording, generating, transcribingRecordingId }) {
  const hasGenerated = record.status === 'Generated' && record.generated_minutes;

  return (
    <div className="minutes-detail">
      <div className="detail-header">
        <div>
          <h3>{record.title}</h3>
          <span className={`minutes-badge badge-${record.status.toLowerCase()}`}>
            {record.status}
          </span>
        </div>
        <button className="btn-icon btn-close" onClick={onClose} title="Close">
          <FaTimes />
        </button>
      </div>

      {/* Metadata */}
      <div className="detail-meta">
        {record.meeting_date && (
          <p>
            <strong>Meeting Date:</strong>{' '}
            {new Date(record.meeting_date).toLocaleDateString()}
          </p>
        )}
        {record.session_id && (
          <p>
            <strong>Session ID:</strong> {record.session_id}
          </p>
        )}
        {record.participants && (
          <p>
            <strong>Participants:</strong> {record.participants}
          </p>
        )}
        <p>
          <strong>Created By:</strong> {record.created_by_name || '—'}
        </p>
        <p>
          <strong>Created At:</strong>{' '}
          {new Date(record.created_at).toLocaleString()}
        </p>
        <p>
          <strong>Uploaded Recordings:</strong> {record.recording_count || 0}
        </p>
      </div>

      {Array.isArray(record.recordings) && record.recordings.length > 0 && (
        <div className="detail-section recording-section">
          <h4>🎥 Session Recordings</h4>
          <div className="minutes-recordings-list">
            {record.recordings.map((recording) => (
              <div key={recording.id} className="minutes-recording-card">
                <div className="minutes-recording-head">
                  <strong>{recording.recording_original_name || `Recording ${recording.id}`}</strong>
                  <span className={`minutes-badge badge-${recording.transcript_status === 'completed' ? 'generated' : recording.transcript_status === 'failed' ? 'archived' : 'draft'}`}>
                    {recording.transcript_status || 'pending'}
                  </span>
                </div>
                <p className="minutes-recording-meta">
                  Uploaded {recording.recording_uploaded_at ? new Date(recording.recording_uploaded_at).toLocaleString() : '—'}
                  {recording.recording_uploaded_by_name ? ` by ${recording.recording_uploaded_by_name}` : ''}
                </p>
                <div className="minutes-recording-actions">
                  <a href={buildRecordingHref(recording.recording_url)} target="_blank" rel="noopener noreferrer" className="btn-export btn-recording-link">
                    Open Recording
                  </a>
                  <button
                    className="btn-generate"
                    onClick={() => onTranscribeRecording(record.id, recording.id)}
                    disabled={transcribingRecordingId === recording.id}
                  >
                    {transcribingRecordingId === recording.id ? '⏳ Transcribing…' : '📝 Transcribe'}
                  </button>
                  {recording.transcript_status === 'completed' && !hasGenerated && (
                    <button
                      className="btn-generate"
                      onClick={() => onGenerate(record.id)}
                      disabled={generating}
                    >
                      {generating ? '⏳ Generating…' : '🤖 Generate AI Minutes'}
                    </button>
                  )}
                </div>
                {recording.transcript_error && (
                  <p className="minutes-recording-error">{recording.transcript_error}</p>
                )}
                {recording.transcript && (
                  <pre className="section-pre transcript-pre minutes-recording-transcript">{recording.transcript}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate button if not yet generated */}
      {!hasGenerated && (
        <div className="detail-generate">
          <p className="generate-hint">
            🤖 Click below to generate structured minutes from the transcript using AI.
          </p>
          <button
            className="btn-generate"
            onClick={() => onGenerate(record.id)}
            disabled={generating}
          >
            {generating ? (
              <>⏳ Generating…</>
            ) : (
              <><FaRobot /> Generate AI Minutes</>
            )}
          </button>
        </div>
      )}

      {/* Generated Minutes Sections */}
      {hasGenerated && (
        <div className="detail-sections">
          {record.attendees && (
            <section className="detail-section">
              <h4>👥 Attendees</h4>
              <p>{record.attendees}</p>
            </section>
          )}
          {record.key_decisions && (
            <section className="detail-section">
              <h4>✅ Key Decisions</h4>
              <pre className="section-pre">{record.key_decisions}</pre>
            </section>
          )}
          {record.action_items && (
            <section className="detail-section">
              <h4>📋 Action Items</h4>
              <pre className="section-pre">{record.action_items}</pre>
            </section>
          )}
          {record.next_steps && (
            <section className="detail-section">
              <h4>🔜 Next Steps</h4>
              <pre className="section-pre">{record.next_steps}</pre>
            </section>
          )}
          {record.generated_minutes && (
            <section className="detail-section">
              <h4>📄 Full Minutes</h4>
              <pre className="section-pre full-minutes">{record.generated_minutes}</pre>
            </section>
          )}
        </div>
      )}

      {/* Transcript */}
      <div className="detail-section transcript-section">
        <h4>📝 Original Transcript</h4>
        <pre className="section-pre transcript-pre">{record.transcript}</pre>
      </div>

      {/* Actions */}
      <div className="detail-actions">
        {hasGenerated && (
          <button className="btn-export" onClick={() => onExportText(record.id)}>
            <FaDownload /> Export as Text
          </button>
        )}
        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
