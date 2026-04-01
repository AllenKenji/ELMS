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
    const ordRes = await client.query('SELECT ordinance_id FROM committee_meetings WHERE id = $1', [meetingId]);
    const ordinanceId = ordRes.rows[0]?.ordinance_id;
    if (ordinanceId) {
      const openMeetings = await client.query('SELECT COUNT(*) FROM committee_meetings WHERE ordinance_id = $1 AND ended = FALSE', [ordinanceId]);
      if (parseInt(openMeetings.rows[0].count, 10) === 0) {
        // Move ordinance to committee report stage
        await require('../models/Ordinance').setReadingStage(client, ordinanceId, 'COMMITTEE_REPORT_SUBMITTED');
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

// === Helpers ===
function generateMeetingLink() {
  // In production, integrate with Google/Zoom API
  const random = Math.random().toString(36).substring(2, 10);
  return `https://meet.google.com/${random}`;
}

// === Meeting Operations ===
exports.deleteMeeting = async (committeeId, meetingId, userId) => {
  const result = await Committee.deleteMeeting(committeeId, meetingId);
  if (result.rows.length === 0) {
    const err = new Error('Meeting not found');
    err.status = 404;
    throw err;
  }
};

exports.createMeeting = async (committeeId, { title, meeting_date, meeting_time, ordinance_id, meetingLink }, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
       (title, meeting_date, meeting_time, committee_id, ordinance_id, created_by, status, meeting_link, minutes_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'Draft', $7, $8, NOW(), NOW()) RETURNING *`,
      [title, meeting_date, meeting_time || null, committeeId, ordinance_id || null, userId, meetingLink, minutesId]
    );
    const meeting = result.rows[0];

    const membersRes = await Committee.findMembers(committeeId);
    const members = membersRes.rows;
    const notifyMsg = `A new committee meeting has been scheduled: "${title}" on ${meeting_date}${meeting_time ? ' at ' + meeting_time : ''}. Meeting link: ${meetingLink}`;

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
    'SELECT * FROM committee_meetings WHERE committee_id = $1 ORDER BY meeting_date DESC',
    [committeeId]
  );
  return result.rows;
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
