const fs = require('fs/promises');
const path = require('path');

// End a meeting (set ended=true)
exports.endMeeting = async (committeeId, meetingId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE committee_meetings SET ended = TRUE, updated_at = NOW() WHERE id = $1 AND committee_id = $2 RETURNING *',
      [meetingId, committeeId]
    );
    if (result.rows.length === 0) {
      const error = new Error('Meeting not found');
      error.status = 404;
      throw error;
    }
    // Optionally, log to audit
    await AuditLog.create(client, userId, 'MEETING_ENDED', `Meeting ID ${meetingId} ended`);

    // Check if all meetings for this ordinance are ended
    const ordRes = await client.query('SELECT ordinance_id, resolution_id FROM committee_meetings WHERE id = $1', [meetingId]);
    const ordinanceId = ordRes.rows[0]?.ordinance_id;
    const resolutionId = ordRes.rows[0]?.resolution_id;
    if (ordinanceId) {
      const openMeetings = await client.query('SELECT COUNT(*) FROM committee_meetings WHERE ordinance_id = $1 AND ended = FALSE', [ordinanceId]);
      if (parseInt(openMeetings.rows[0].count, 10) === 0) {
        // Move ordinance to committee report stage
        await require('../models/Ordinance').setReadingStage(client, ordinanceId, 'COMMITTEE_REPORT_SUBMITTED');
      }
    }
    if (resolutionId) {
      const openMeetings = await client.query('SELECT COUNT(*) FROM committee_meetings WHERE resolution_id = $1 AND ended = FALSE', [resolutionId]);
      if (parseInt(openMeetings.rows[0].count, 10) === 0) {
        // Move resolution to committee report stage
        await require('../models/Resolution').setReadingStage(client, resolutionId, 'COMMITTEE_REPORT_SUBMITTED');
      }
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
/**
 * Committee Service - Business logic for committee operations.
 */

// === Imports ===
const pool = require('../db');
const Committee = require('../models/Committee');
const CommitteeMinutes = require('../models/CommitteeMinutes');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getCommitteeWithMembers, validateCommitteeChair } = require('../utils/committeesHelper');
const { getIO } = require('../socket');

// === Constants ===
const VALID_MEMBER_ROLES = ['Chair', 'Member', 'Secretary', 'Committee Secretary'];
const RECORDING_UPLOAD_PREFIX = '/uploads/committee-recordings/';

// === Helpers ===
function generateMeetingLink() {
  // In production, integrate with Google/Zoom API
  const random = Math.random().toString(36).substring(2, 10);
  return `https://meet.google.com/${random}`;
}

function normalizeMeetingMode(mode, meetingLink, meetingLocation) {
  const normalizedMode = String(mode || '').trim().toLowerCase();
  if (['online', 'place', 'both'].includes(normalizedMode)) {
    return normalizedMode;
  }

  const hasLink = Boolean(String(meetingLink || '').trim());
  const hasLocation = Boolean(String(meetingLocation || '').trim());

  if (hasLink && hasLocation) return 'both';
  if (hasLocation) return 'place';
  return 'online';
}

function buildMeetingWhereText(meetingMode, meetingLink, meetingLocation) {
  if (meetingMode === 'both') {
    return `Location: ${meetingLocation}. Online link: ${meetingLink}`;
  }
  if (meetingMode === 'place') {
    return `Location: ${meetingLocation}`;
  }
  return `Online link: ${meetingLink}`;
}

function resolveUploadAbsolutePath(relativePath) {
  if (!relativePath || !String(relativePath).startsWith(RECORDING_UPLOAD_PREFIX)) {
    return null;
  }

  const relativeFilePath = String(relativePath).replace(/^\/uploads\//, 'uploads/');
  return path.join(__dirname, '..', relativeFilePath);
}

async function deleteMeetingRecordingFile(relativePath) {
  const absolutePath = resolveUploadAbsolutePath(relativePath);
  if (!absolutePath) {
    return;
  }

  await fs.unlink(absolutePath).catch(() => {});
}

// === Meeting Operations ===
exports.deleteMeeting = async (committeeId, meetingId, userId) => {
  const result = await Committee.deleteMeeting(committeeId, meetingId);
  if (result.rows.length === 0) {
    const err = new Error('Meeting not found');
    err.status = 404;
    throw err;
  }

  await deleteMeetingRecordingFile(result.rows[0].recording_url);
};

exports.createMeeting = async (
  committeeId,
  { title, meeting_date, meeting_time, ordinance_id, resolution_id, meetingLink, meeting_mode, meeting_location },
  userId
) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedMeetingLink = String(meetingLink || '').trim();
    const normalizedMeetingLocation = String(meeting_location || '').trim();
    const normalizedMeetingMode = normalizeMeetingMode(meeting_mode, normalizedMeetingLink, normalizedMeetingLocation);

    if ((normalizedMeetingMode === 'online' || normalizedMeetingMode === 'both') && !normalizedMeetingLink) {
      const err = new Error('An online meeting link is required for online or hybrid meetings');
      err.status = 400;
      throw err;
    }

    if ((normalizedMeetingMode === 'place' || normalizedMeetingMode === 'both') && !normalizedMeetingLocation) {
      const err = new Error('A meeting place is required for place or hybrid meetings');
      err.status = 400;
      throw err;
    }

    const minutesRes = await CommitteeMinutes.create(
      title,
      meeting_date,
      null,
      '',
      userId,
      committeeId
    );
    const minutesId = minutesRes.rows[0]?.id;

    const result = await client.query(
      `INSERT INTO committee_meetings 
       (title, meeting_date, meeting_time, committee_id, ordinance_id, resolution_id, created_by, status, meeting_link, meeting_mode, meeting_location, minutes_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', $8, $9, $10, $11, NOW(), NOW()) RETURNING *`,
      [
        title,
        meeting_date,
        meeting_time || null,
        committeeId,
        ordinance_id || null,
        resolution_id || null,
        userId,
        normalizedMeetingLink || null,
        normalizedMeetingMode,
        normalizedMeetingLocation || null,
        minutesId,
      ]
    );
    const meeting = result.rows[0];

    const membersRes = await Committee.findMembers(committeeId);
    const members = membersRes.rows;
    const notifyMsg = `A new committee meeting has been scheduled: "${title}" on ${meeting_date}${meeting_time ? ' at ' + meeting_time : ''}. ${buildMeetingWhereText(normalizedMeetingMode, normalizedMeetingLink, normalizedMeetingLocation)}`;

    for (const member of members) {
      await createNotification(member.user_id, notifyMsg, {
        type: 'meeting',
        title: 'New Committee Meeting',
        relatedId: meeting.id,
        relatedType: 'committee_meeting',
      });
    }

    await client.query('COMMIT');
    return meeting;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getCommitteeMeetings = async (committeeId) => {
  const result = await pool.query(
    `SELECT cm.*, uploader.name AS recording_uploaded_by_name,
            minutes.generated_minutes AS meeting_minutes,
            minutes.transcript AS meeting_transcript,
            COALESCE(minutes.attendees, minutes.participants) AS meeting_attendees
     FROM committee_meetings cm
     LEFT JOIN users uploader ON uploader.id = cm.recording_uploaded_by
     LEFT JOIN committee_minutes minutes ON minutes.id = cm.minutes_id
     WHERE cm.committee_id = $1
     ORDER BY cm.meeting_date DESC, cm.created_at DESC`,
    [committeeId]
  );
  return result.rows;
};

exports.saveMeetingRecording = async (committeeId, meetingId, file, userId) => {
  const relativePath = file ? `${RECORDING_UPLOAD_PREFIX}${file.filename}` : null;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingMeetingResult = await client.query(
      'SELECT id, recording_url FROM committee_meetings WHERE id = $1 AND committee_id = $2 FOR UPDATE',
      [meetingId, committeeId]
    );

    if (existingMeetingResult.rows.length === 0) {
      const err = new Error('Meeting not found');
      err.status = 404;
      throw err;
    }

    const previousRecordingUrl = existingMeetingResult.rows[0].recording_url;

    await client.query(
      `UPDATE committee_meetings
       SET recording_url = $1,
           recording_original_name = $2,
           recording_uploaded_at = NOW(),
           recording_uploaded_by = $3,
           updated_at = NOW()
       WHERE id = $4 AND committee_id = $5`,
      [relativePath, file?.originalname || null, userId, meetingId, committeeId]
    );

    await AuditLog.create(client, userId, 'MEETING_RECORDING_UPLOADED', `Recording uploaded for meeting ID ${meetingId}`);
    await client.query('COMMIT');

    if (previousRecordingUrl && previousRecordingUrl !== relativePath) {
      await deleteMeetingRecordingFile(previousRecordingUrl);
    }

    const meetingResult = await pool.query(
      `SELECT cm.*, uploader.name AS recording_uploaded_by_name
       FROM committee_meetings cm
       LEFT JOIN users uploader ON uploader.id = cm.recording_uploaded_by
       WHERE cm.id = $1`,
      [meetingId]
    );

    return meetingResult.rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    if (relativePath) {
      await deleteMeetingRecordingFile(relativePath);
    }
    throw err;
  } finally {
    client.release();
  }
};

// === Committee Operations ===
exports.createCommittee = async ({ name, description, chair_id, vice_chair_id, member_ids, status, committee_secretary_id }, userId) => {
  if (!name) {
    const err = new Error('Committee name is required');
    err.status = 400;
    throw err;
  }

  if (chair_id && !(await validateCommitteeChair(chair_id))) {
    throw Object.assign(new Error('Chair user not found'), { status: 400 });
  }
  if (vice_chair_id && !(await validateCommitteeChair(vice_chair_id))) {
    throw Object.assign(new Error('Vice Chair user not found'), { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await Committee.create(name, description, chair_id, status);
    const committee = result.rows[0];

    const addedMemberIds = new Set();
    if (chair_id) {
      await Committee.addMember(client, committee.id, chair_id, 'Chair');
      addedMemberIds.add(Number(chair_id));
    }
    if (vice_chair_id && !addedMemberIds.has(Number(vice_chair_id))) {
      await Committee.addMember(client, committee.id, vice_chair_id, 'Vice Chair');
      addedMemberIds.add(Number(vice_chair_id));
    }
    if (Array.isArray(member_ids)) {
      for (const memberId of member_ids) {
        const idNum = Number(memberId);
        if (!addedMemberIds.has(idNum)) {
          await Committee.addMember(client, committee.id, idNum, 'Member');
          addedMemberIds.add(idNum);
        }
      }
    }
    // Add committee secretary if provided and not already added
    if (committee_secretary_id && !addedMemberIds.has(Number(committee_secretary_id))) {
      await Committee.addMember(client, committee.id, committee_secretary_id, 'Committee Secretary');
      addedMemberIds.add(Number(committee_secretary_id));
    }

    await AuditLog.create(client, userId, 'COMMITTEE_CREATE', `Committee "${name}" created`);
    await client.query('COMMIT');

    getIO().emit('committeeCreated', committee);
    return committee;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getAllCommittees = async (status) => {
  const result = await Committee.findAll(status);
  return result.rows;
};

exports.getCommitteeById = async (id) => {
  const committee = await getCommitteeWithMembers(id);
  if (!committee) {
    throw Object.assign(new Error('Committee not found'), { status: 404 });
  }
  return committee;
};

exports.updateCommittee = async (id, { name, description, chair_id, status, committee_secretary_id }, userId) => {
  const existing = await Committee.findById(id);
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Committee not found'), { status: 404 });
  }

  if (chair_id && !(await validateCommitteeChair(chair_id))) {
    throw Object.assign(new Error('Chair user not found'), { status: 400 });
  }

  const current = existing.rows[0];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update committee main fields
    const result = await Committee.update(
      id,
      name || current.name,
      description !== undefined ? description : current.description,
      chair_id !== undefined ? chair_id : current.chair_id,
      status || current.status
    );
    const committee = result.rows[0];

    // Handle committee secretary update
    // Remove existing committee secretary if different
    const membersRes = await Committee.findMembers(id);
    const members = membersRes.rows;
    const currentSecretary = members.find(m => m.role === 'Committee Secretary');
    if (committee_secretary_id) {
      if (!currentSecretary || Number(currentSecretary.user_id) !== Number(committee_secretary_id)) {
        // Remove old secretary if exists and is different
        if (currentSecretary) {
          await Committee.removeMember(currentSecretary.id);
        }
        // Add new secretary if not already a member
        const alreadyMember = members.find(m => Number(m.user_id) === Number(committee_secretary_id));
        if (!alreadyMember || alreadyMember.role !== 'Committee Secretary') {
          await Committee.addMember(client, id, committee_secretary_id, 'Committee Secretary');
        }
      }
    } else if (currentSecretary) {
      // Remove secretary if field is now empty
      await Committee.removeMember(currentSecretary.id);
    }

    await AuditLog.create(null, userId, 'COMMITTEE_UPDATE', `Committee "${committee.name}" updated`);
    await client.query('COMMIT');

    getIO().emit('committeeUpdated', committee);
    return committee;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteCommittee = async (id, userId) => {
  const existing = await Committee.findById(id);
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Committee not found'), { status: 404 });
  }

  const committeeName = existing.rows[0].name;
  await Committee.deleteById(id);
  await AuditLog.create(null, userId, 'COMMITTEE_DELETE', `Committee "${committeeName}" deleted`);

  getIO().emit('committeeDeleted', { id: Number(id), name: committeeName });
};

exports.getMembers = async (committeeId) => {
  const existing = await Committee.findById(committeeId);
  if (existing.rows.length === 0) {
    throw Object.assign(new Error('Committee not found'), { status: 404 });
  }
  const result = await Committee.findMembers(committeeId);
  return result.rows;
};

exports.addMember = async (committeeId, { user_id, role }, actingUserId) => {
  if (!user_id) {
    throw Object.assign(new Error('user_id is required'), { status: 400 });
  }

  const memberRole = role || 'Member';
  if (!VALID_MEMBER_ROLES.includes(memberRole)) {
    throw Object.assign(new Error('Invalid role. Must be Chair, Member, or Secretary'), { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const committeeResult = await client.query('SELECT * FROM committees WHERE id = $1', [committeeId]);
    if (committeeResult.rows.length === 0) {
      throw Object.assign(new Error('Committee not found'), { status: 404 });
    }

    const userResult = await client.query('SELECT id, name FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      throw Object.assign(new Error('User not found'), { status: 400 });
    }

    const existingMember = await Committee.findExistingMember(client, committeeId, user_id);
    if (existingMember.rows.length > 0) {
      throw Object.assign(new Error('User is already a member of this committee'), { status: 409 });
    }

    const result = await Committee.addMember(client, committeeId, user_id, memberRole);
    const member = result.rows[0];
    member.user_name = userResult.rows[0].name;

    await AuditLog.create(
      client,
      actingUserId,
      'COMMITTEE_MEMBER_ADD',
      `User "${userResult.rows[0].name}" added to committee "${committeeResult.rows[0].name}" as ${memberRole}`
    );

    await client.query('COMMIT');

        await createNotification(
      user_id,
      `You have been added to committee "${committeeResult.rows[0].name}" as ${memberRole}.`
    );

    getIO().emit('committeeMemberAdded', { committeeId: Number(committeeId), member });
    return member;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.removeMember = async (committeeId, memberId, actingUserId) => {
  const committeeResult = await Committee.findById(committeeId);
  if (committeeResult.rows.length === 0) {
    throw Object.assign(new Error('Committee not found'), { status: 404 });
  }

  const memberResult = await Committee.findMemberById(memberId, committeeId);
  if (memberResult.rows.length === 0) {
    throw Object.assign(new Error('Committee member not found'), { status: 404 });
  }

  const memberRow = memberResult.rows[0];
  await Committee.removeMember(memberId);

  await AuditLog.create(
    null,
    actingUserId,
    'COMMITTEE_MEMBER_REMOVE',
    `User "${memberRow.user_name}" removed from committee "${committeeResult.rows[0].name}"`
  );

  await createNotification(
    memberRow.user_id,
    `You have been removed from committee "${committeeResult.rows[0].name}".`
  );

  getIO().emit('committeeMemberRemoved', { committeeId: Number(committeeId), memberId: Number(memberId) });
};
