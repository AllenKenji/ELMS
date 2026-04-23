/**
 * SessionMinutes Model - Data access layer for session meeting minutes operations.
 */
const pool = require('../db');

const RECORDINGS_SELECT = `
  COALESCE(recordings.recordings, '[]'::json) AS recordings,
  COALESCE(recordings.recording_count, 0)::int AS recording_count`;

const RECORDINGS_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      json_agg(
        json_build_object(
          'id', sr.id,
          'session_id', sr.session_id,
          'minutes_id', sr.minutes_id,
          'recording_url', sr.recording_url,
          'recording_original_name', sr.recording_original_name,
          'recording_uploaded_at', sr.recording_uploaded_at,
          'recording_uploaded_by', sr.recording_uploaded_by,
          'recording_uploaded_by_name', uploader.name,
          'transcript', sr.transcript,
          'transcript_status', sr.transcript_status,
          'transcript_error', sr.transcript_error,
          'created_at', sr.created_at,
          'updated_at', sr.updated_at
        )
        ORDER BY sr.recording_uploaded_at DESC, sr.created_at DESC
      ) AS recordings,
      COUNT(sr.id) AS recording_count
    FROM session_recordings sr
    LEFT JOIN users uploader ON uploader.id = sr.recording_uploaded_by
    WHERE sr.minutes_id = m.id
  ) recordings ON TRUE`;

exports.create = async (title, meetingDate, participants, transcript, createdBy, sessionId) => {
  return pool.query(
    `INSERT INTO session_minutes
       (title, meeting_date, participants, transcript, status, created_by, session_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Draft', $5, $6, NOW(), NOW())
     RETURNING *`,
    [title, meetingDate || null, participants || null, transcript, createdBy, sessionId || null]
  );
};

exports.findAll = async (status, pageNum, limitNum, safeSort, safeOrder) => {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`m.status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (pageNum - 1) * limitNum;

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM session_minutes m ${whereClause}`,
    params
  );
  const total = parseInt(countRes.rows[0].count, 10);

  params.push(limitNum, offset);
  const result = await pool.query(
    `SELECT m.*, u.name AS created_by_name, uploader.name AS recording_uploaded_by_name,
            ${RECORDINGS_SELECT}
     FROM session_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN users uploader ON uploader.id = m.recording_uploaded_by
     ${RECORDINGS_JOIN}
     ${whereClause}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { minutes: result.rows, total };
};

exports.findById = async (id) => {
  return pool.query(
    `SELECT m.*, u.name AS created_by_name, uploader.name AS recording_uploaded_by_name,
            ${RECORDINGS_SELECT}
     FROM session_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN users uploader ON uploader.id = m.recording_uploaded_by
     ${RECORDINGS_JOIN}
     WHERE m.id = $1`,
    [id]
  );
};

exports.update = async (id, title, meetingDate, participants, status) => {
  return pool.query(
    `UPDATE session_minutes
     SET title = $1, meeting_date = $2, participants = $3, status = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [title, meetingDate || null, participants || null, status, id]
  );
};

exports.updateGeneratedMinutes = async (id, generatedMinutes, attendees, keyDecisions, actionItems, nextSteps) => {
  return pool.query(
    `UPDATE session_minutes
     SET generated_minutes = $1, attendees = $2, key_decisions = $3,
         action_items = $4, next_steps = $5, status = 'Generated', updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [generatedMinutes, attendees || null, keyDecisions || null, actionItems || null, nextSteps || null, id]
  );
};

exports.deleteById = async (id) => {
  return pool.query('DELETE FROM session_minutes WHERE id = $1', [id]);
};

exports.findBySessionId = async (sessionId) => {
  return pool.query(
    `SELECT m.*, u.name AS created_by_name, uploader.name AS recording_uploaded_by_name,
            ${RECORDINGS_SELECT}
     FROM session_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN users uploader ON uploader.id = m.recording_uploaded_by
     ${RECORDINGS_JOIN}
     WHERE m.session_id = $1
     ORDER BY m.created_at DESC`,
    [sessionId]
  );
};

exports.findLatestBySessionId = async (sessionId, client = pool) => {
  return client.query(
    `SELECT m.*, u.name AS created_by_name, uploader.name AS recording_uploaded_by_name,
            ${RECORDINGS_SELECT}
     FROM session_minutes m
     LEFT JOIN users u ON u.id = m.created_by
     LEFT JOIN users uploader ON uploader.id = m.recording_uploaded_by
     ${RECORDINGS_JOIN}
     WHERE m.session_id = $1
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [sessionId]
  );
};

exports.setTranscript = async (id, transcript, client = pool) => {
  return client.query(
    `UPDATE session_minutes
     SET transcript = $1,
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [transcript || '', id]
  );
};

exports.updateRecording = async (id, recordingUrl, recordingOriginalName, recordingUploadedBy, client = pool) => {
  return client.query(
    `UPDATE session_minutes
     SET recording_url = $1,
         recording_original_name = $2,
         recording_uploaded_at = NOW(),
         recording_uploaded_by = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [recordingUrl, recordingOriginalName || null, recordingUploadedBy, id]
  );
};
