const pool = require('../db');

exports.create = async ({ sessionId, minutesId, recordingUrl, recordingOriginalName, uploadedBy }, client = pool) => {
  return client.query(
    `INSERT INTO session_recordings
       (session_id, minutes_id, recording_url, recording_original_name, recording_uploaded_at, recording_uploaded_by, transcript_status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), $5, 'pending', NOW(), NOW())
     RETURNING *`,
    [sessionId, minutesId, recordingUrl, recordingOriginalName || null, uploadedBy]
  );
};

exports.findById = async (id, client = pool) => {
  return client.query(
    `SELECT sr.*, uploader.name AS recording_uploaded_by_name
     FROM session_recordings sr
     LEFT JOIN users uploader ON uploader.id = sr.recording_uploaded_by
     WHERE sr.id = $1`,
    [id]
  );
};

exports.findByMinutesId = async (minutesId, client = pool) => {
  return client.query(
    `SELECT sr.*, uploader.name AS recording_uploaded_by_name
     FROM session_recordings sr
     LEFT JOIN users uploader ON uploader.id = sr.recording_uploaded_by
     WHERE sr.minutes_id = $1
     ORDER BY sr.recording_uploaded_at DESC, sr.created_at DESC`,
    [minutesId]
  );
};

exports.updateTranscript = async (id, transcript, transcriptStatus, transcriptError = null, client = pool) => {
  return client.query(
    `UPDATE session_recordings
     SET transcript = $1,
         transcript_status = $2,
         transcript_error = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [transcript || null, transcriptStatus, transcriptError, id]
  );
};