/**
 * Minutes Service - Business logic for AI-powered meeting minutes generation.
 */
const fs = require('fs');
const OpenAI = require('openai');
const SessionMinutes = require('../models/SessionMinutes');
const SessionRecording = require('../models/SessionRecording');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

const ALLOWED_SORT_FIELDS = ['created_at', 'title', 'meeting_date', 'status'];
const ALLOWED_ORDERS = ['ASC', 'DESC'];
const ALLOWED_STATUSES = ['Draft', 'Generated', 'Archived'];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SESSION_RECORDING_UPLOAD_PREFIX = '/uploads/session-recordings/';

/**
 * Build an OpenAI client instance.
 * Throws if the API key is not configured.
 * @returns {OpenAI}
 */
function buildOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OpenAI API key is not configured. Set OPENAI_API_KEY in your environment.');
    err.status = 503;
    throw err;
  }
  return new OpenAI({ apiKey });
}

function resolveSessionRecordingAbsolutePath(relativePath) {
  if (!relativePath || !String(relativePath).startsWith(SESSION_RECORDING_UPLOAD_PREFIX)) {
    return null;
  }

  const relativeFilePath = String(relativePath).replace(/^\/uploads\//, 'uploads/');
  return require('path').join(__dirname, '..', relativeFilePath);
}

/**
 * Sleep helper for retry delays.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call OpenAI with retry logic for transient errors.
 * @param {OpenAI} client
 * @param {string} transcript
 * @returns {Promise<object>} Parsed JSON response from the model.
 */
async function callOpenAIWithRetry(client, transcript) {
  const systemPrompt = `You are an expert legislative secretary. Your task is to generate structured, professional meeting minutes from the provided transcript. 
  
Return a valid JSON object with exactly these keys:
- "summary": A concise paragraph summarizing the meeting.
- "attendees": A list of names/titles of attendees found in the transcript (comma-separated string).
- "key_decisions": A numbered list of key decisions made (newline-separated string).
- "action_items": A numbered list of action items with responsible parties and due dates where available (newline-separated string).
- "next_steps": A numbered list of next steps or follow-up items (newline-separated string).
- "full_minutes": The complete formatted meeting minutes document as a multi-paragraph string.

Return ONLY valid JSON, no markdown fences.`;

  const userPrompt = `Please generate structured meeting minutes from the following transcript:\n\n${transcript}`;

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      return JSON.parse(content);
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.status === 429 ||
        err.status === 500 ||
        err.status === 502 ||
        err.status === 503 ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT';

      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      break;
    }
  }

  throw lastError;
}

/**
 * Create a new meeting minutes record (transcript stored, not yet generated).
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.createMinutes = async ({ title, meeting_date, participants, transcript, session_id }, userId) => {
  if (!title || !title.trim()) {
    const err = new Error('Title is required');
    err.status = 400;
    throw err;
  }
  if (!transcript || !transcript.trim()) {
    const err = new Error('Transcript is required');
    err.status = 400;
    throw err;
  }

  const result = await SessionMinutes.create(
    title.trim(),
    meeting_date || null,
    participants ? participants.trim() : null,
    transcript.trim(),
    userId,
    session_id || null
  );
  const minutes = result.rows[0];

  await AuditLog.create(null, userId, 'MINUTES_CREATE', `Meeting minutes "${title}" created`);
  await createNotification(userId, `Meeting minutes "${title}" has been created.`);

  const io = getIO();
  io.to('Admin').emit('minutesCreated', minutes);
  io.to('Secretary').emit('minutesCreated', minutes);

  return minutes;
};

/**
 * Generate AI meeting minutes for an existing record.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.generateMinutes = async (id, userId) => {
  const existing = await SessionMinutes.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Meeting minutes record not found');
    err.status = 404;
    throw err;
  }

  const record = existing.rows[0];
  const client = buildOpenAIClient();

  let parsed;
  try {
    parsed = await callOpenAIWithRetry(client, record.transcript);
  } catch (err) {
    console.error('OpenAI generation error:', err);
    if (err.status === 503) throw err;
    const apiErr = new Error('Failed to generate minutes via AI. Please try again later.');
    apiErr.status = 502;
    throw apiErr;
  }

  const updated = await SessionMinutes.updateGeneratedMinutes(
    id,
    parsed.full_minutes || parsed.summary || '',
    parsed.attendees || null,
    parsed.key_decisions || null,
    parsed.action_items || null,
    parsed.next_steps || null
  );
  const minutes = updated.rows[0];

  await AuditLog.create(null, userId, 'MINUTES_GENERATE', `AI minutes generated for "${record.title}"`);
  await createNotification(userId, `AI minutes have been generated for "${record.title}".`);

  const io = getIO();
  io.to('Admin').emit('minutesGenerated', minutes);
  io.to('Secretary').emit('minutesGenerated', minutes);

  return minutes;
};

/**
 * Retrieve all meeting minutes with filtering and pagination.
 * @param {object} query
 * @returns {Promise<{minutes: Array, pagination: object}>}
 */
exports.getAllMinutes = async ({ status, page = 1, limit = 10, sort = 'created_at', order = 'DESC' }) => {
  const safeSort = ALLOWED_SORT_FIELDS.includes(sort) ? `m.${sort}` : 'm.created_at';
  const safeOrder = ALLOWED_ORDERS.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

  const { minutes, total } = await SessionMinutes.findAll(status, pageNum, limitNum, safeSort, safeOrder);

  return {
    minutes,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Retrieve a single meeting minutes record by ID.
 * @param {string|number} id
 * @returns {Promise<object>}
 */
exports.getMinutesById = async (id) => {
  const result = await SessionMinutes.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Meeting minutes not found');
    err.status = 404;
    throw err;
  }
  return result.rows[0];
};

/**
 * Update a meeting minutes record.
 * @param {string|number} id
 * @param {object} data
 * @param {number} userId
 * @returns {Promise<object>}
 */
exports.updateMinutes = async (id, { title, meeting_date, participants, status }, userId) => {
  if (status && !ALLOWED_STATUSES.includes(status)) {
    const err = new Error(`Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}`);
    err.status = 400;
    throw err;
  }

  const existing = await SessionMinutes.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Meeting minutes not found');
    err.status = 404;
    throw err;
  }

  const current = existing.rows[0];
  const result = await SessionMinutes.update(
    id,
    title ? title.trim() : current.title,
    meeting_date !== undefined ? meeting_date : current.meeting_date,
    participants !== undefined ? (participants ? participants.trim() : null) : current.participants,
    status || current.status
  );
  const minutes = result.rows[0];

  await AuditLog.create(null, userId, 'MINUTES_UPDATE', `Meeting minutes "${minutes.title}" updated`);

  const io = getIO();
  io.to('Admin').emit('minutesUpdated', minutes);
  io.to('Secretary').emit('minutesUpdated', minutes);

  return minutes;
};

exports.transcribeRecording = async (minutesId, recordingId, userId) => {
  const minutesResult = await SessionMinutes.findById(minutesId);
  if (minutesResult.rows.length === 0) {
    const err = new Error('Meeting minutes not found');
    err.status = 404;
    throw err;
  }

  const recordingResult = await SessionRecording.findById(recordingId);
  if (recordingResult.rows.length === 0 || String(recordingResult.rows[0].minutes_id) !== String(minutesId)) {
    const err = new Error('Session recording not found for these minutes');
    err.status = 404;
    throw err;
  }

  const recording = recordingResult.rows[0];
  const absolutePath = resolveSessionRecordingAbsolutePath(recording.recording_url);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    await SessionRecording.updateTranscript(recordingId, null, 'failed', 'Recording file was not found on the server.');
    const err = new Error('Recording file was not found on the server');
    err.status = 404;
    throw err;
  }

  const client = buildOpenAIClient();

  let transcriptText = '';
  try {
    const response = await client.audio.transcriptions.create({
      file: fs.createReadStream(absolutePath),
      model: process.env.OPENAI_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
    });
    transcriptText = String(response?.text || '').trim();
    if (!transcriptText) {
      throw new Error('Empty transcription response from OpenAI');
    }
  } catch (err) {
    await SessionRecording.updateTranscript(recordingId, null, 'failed', err.message || 'Transcription failed');
    if (err.status === 503) throw err;
    const apiErr = new Error('Failed to transcribe the recording. Please try again later.');
    apiErr.status = 502;
    throw apiErr;
  }

  const currentMinutes = minutesResult.rows[0];
  const mergedTranscript = currentMinutes.transcript
    ? `${currentMinutes.transcript}\n\n---\nRecording ${recording.id} Transcript\n${transcriptText}`
    : transcriptText;

  await SessionMinutes.setTranscript(minutesId, mergedTranscript);
  await SessionRecording.updateTranscript(recordingId, transcriptText, 'completed', null);
  await AuditLog.create(null, userId, 'MINUTES_RECORDING_TRANSCRIBED', `Recording ${recordingId} transcribed for minutes "${currentMinutes.title}"`);

  const updatedMinutesResult = await SessionMinutes.findById(minutesId);
  const updatedMinutes = updatedMinutesResult.rows[0];

  const io = getIO();
  io.to('Admin').emit('minutesUpdated', updatedMinutes);
  io.to('Secretary').emit('minutesUpdated', updatedMinutes);

  return updatedMinutes;
};

/**
 * Delete a meeting minutes record.
 * @param {string|number} id
 * @param {number} userId
 * @returns {Promise<void>}
 */
exports.deleteMinutes = async (id, userId) => {
  const existing = await SessionMinutes.findById(id);
  if (existing.rows.length === 0) {
    const err = new Error('Meeting minutes not found');
    err.status = 404;
    throw err;
  }

  await SessionMinutes.deleteById(id);
  await AuditLog.create(null, userId, 'MINUTES_DELETE', `Meeting minutes "${existing.rows[0].title}" deleted`);

  const io = getIO();
  io.to('Admin').emit('minutesDeleted', { id });
  io.to('Secretary').emit('minutesDeleted', { id });
};

/**
 * Export meeting minutes as plain text.
 * @param {string|number} id
 * @returns {Promise<{textContent: string, filename: string}>}
 */
exports.exportText = async (id) => {
  const result = await SessionMinutes.findById(id);
  if (result.rows.length === 0) {
    const err = new Error('Meeting minutes not found');
    err.status = 404;
    throw err;
  }

  const record = result.rows[0];
  const lines = [];

  lines.push(`MEETING MINUTES: ${record.title}`);
  lines.push('='.repeat(60));
  if (record.meeting_date) {
    lines.push(`Meeting Date: ${new Date(record.meeting_date).toLocaleDateString()}`);
  }
  if (record.participants) {
    lines.push(`Participants: ${record.participants}`);
  }
  lines.push(`Status: ${record.status}`);
  lines.push(`Generated At: ${new Date(record.created_at).toLocaleString()}`);
  lines.push('');

  if (record.attendees) {
    lines.push('ATTENDEES');
    lines.push('-'.repeat(40));
    lines.push(record.attendees);
    lines.push('');
  }

  if (record.key_decisions) {
    lines.push('KEY DECISIONS');
    lines.push('-'.repeat(40));
    lines.push(record.key_decisions);
    lines.push('');
  }

  if (record.action_items) {
    lines.push('ACTION ITEMS');
    lines.push('-'.repeat(40));
    lines.push(record.action_items);
    lines.push('');
  }

  if (record.next_steps) {
    lines.push('NEXT STEPS');
    lines.push('-'.repeat(40));
    lines.push(record.next_steps);
    lines.push('');
  }

  if (record.generated_minutes) {
    lines.push('FULL MINUTES');
    lines.push('-'.repeat(40));
    lines.push(record.generated_minutes);
  }

  const textContent = lines.join('\n');
  const filename = `minutes_${record.id}_${Date.now()}.txt`;
  return { textContent, filename };
};

/**
 * Retrieve all meeting minutes for a specific session.
 * @param {string|number} sessionId
 * @returns {Promise<Array>}
 */
exports.getMinutesBySessionId = async (sessionId) => {
  const result = await SessionMinutes.findBySessionId(sessionId);
  return result.rows;
};
