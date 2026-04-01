const pool = require('../db');
const Vote = require('../models/Vote');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const ensureExists = (rows, message = 'Record not found') => {
  if (!rows.length) {
    const err = new Error(message);
    err.status = 404;
    throw err;
  }
  return rows[0];
};

const validateVoteOption = (session, voteOption) => {
  const allowed = session.voting_type === 'yes_no_abstain'
    ? ['Yes', 'No', 'Abstain']
    : ['Yes', 'No'];

  if (!allowed.includes(voteOption)) {
    const err = new Error(`Invalid vote option. Allowed: ${allowed.join(', ')}`);
    err.status = 400;
    throw err;
  }
};

const emit = (event, payload) => {
  try {
    getIO().emit(event, payload);
  } catch (err) {
    console.error('Socket emit failed:', err.message);
  }
};

const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// Voting Session
// ─────────────────────────────────────────────

exports.createVotingSession = async (data, userId) => {
  const {
    title,
    description,
    ordinance_id,
    resolution_id,
    question,
    voting_type = 'yes_no',
    session_id = null,
    agenda_item_id = null,
  } = data;

  if (!title || !question) {
    throw Object.assign(new Error('Title and question are required'), { status: 400 });
  }

  // ✅ Enforce domain rule
  if (!!ordinance_id === !!resolution_id) {
    throw Object.assign(
      new Error('Must link to either an ordinance OR a resolution (not both)'),
      { status: 400 }
    );
  }

  const type = ['yes_no', 'yes_no_abstain'].includes(voting_type)
    ? voting_type
    : 'yes_no';

  const result = await Vote.createSession(
    title,
    description,
    ordinance_id,
    resolution_id,
    question,
    type,
    userId,
    session_id,
    agenda_item_id
  );

  const session = result.rows[0];

  await AuditLog.create(null, userId, 'VOTING_SESSION_CREATE', `Created "${title}"`);

  // ✅ Fire-and-forget notifications
  Vote.findCouncilors()
    .then(res =>
      Promise.all(
        res.rows.map(c =>
          createNotification(c.id, `New voting session: "${title}"`)
        )
      )
    )
    .catch(console.error);

  emit('votingSessionCreated', session);

  return {
    success: true,
    data: session,
  };
};

exports.getAllVotingSessions = async () => {
  const result = await Vote.findAllSessions();
  return {
    success: true,
    data: result.rows,
  };
};

exports.getVotingSessionById = async (id, currentUserId) => {
  const session = ensureExists(
    (await Vote.findSessionById(id)).rows,
    'Voting session not found'
  );

  const [results, participants, userVote] = await Promise.all([
    Vote.getResults(id),
    Vote.getParticipants(id),
    Vote.findUserVote(id, currentUserId),
  ]);

  return {
    success: true,
    data: {
      session,
      results: results.rows,
      participants: participants.rows,
      totalVotes: participants.rows.length,
      userVote: userVote.rows[0]?.vote_option || null,
    },
  };
};

// ─────────────────────────────────────────────
// Voting Actions
// ─────────────────────────────────────────────

exports.castVote = async (sessionId, voteOption, userId) => {
  return withTransaction(async (client) => {
    if (!sessionId || !voteOption) {
      throw Object.assign(new Error('session_id and vote_option are required'), { status: 400 });
    }

    const session = ensureExists(
      (await Vote.findSessionById(sessionId)).rows,
      'Voting session not found'
    );

    if (session.status !== 'active') {
      throw Object.assign(new Error('Voting session is not active'), { status: 400 });
    }

    validateVoteOption(session, voteOption);

    let result;
    try {
      result = await Vote.castVote(sessionId, userId, voteOption, client);
    } catch (err) {
      // ✅ Prevent double voting (DB constraint required)
      if (err.code === '23505') {
        throw Object.assign(new Error('You have already voted'), { status: 400 });
      }
      throw err;
    }

    await AuditLog.create(client, userId, 'VOTE_CAST', `Vote "${voteOption}"`);

    const [updatedResults, totalVotes] = await Promise.all([
      Vote.getResults(sessionId),
      Vote.getTotalVotes(sessionId),
    ]);

    emit('voteCast', {
      session_id: sessionId,
      results: updatedResults.rows,
      totalVotes: totalVotes.rows[0].total,
    });

    return {
      success: true,
      data: {
        vote: result.rows[0],
        results: updatedResults.rows,
        totalVotes: totalVotes.rows[0].total,
      },
    };
  });
};

// ─────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────

exports.closeVotingSession = async (id, userId) => {
  const session = ensureExists(
    (await Vote.findSessionById(id)).rows,
    'Voting session not found'
  );

  if (session.status === 'closed') {
    throw Object.assign(new Error('Voting session already closed'), { status: 400 });
  }

  const result = await Vote.closeSession(id);
  const updated = result.rows[0];

  await AuditLog.create(null, userId, 'VOTING_SESSION_CLOSE', `Closed "${updated.title}"`);

  emit('votingSessionClosed', updated);

  return {
    success: true,
    data: updated,
  };
};

exports.deleteVotingSession = async (id, userId) => {
  const session = ensureExists(
    (await Vote.findSessionById(id)).rows,
    'Voting session not found'
  );

  await Vote.deleteSession(id);

  await AuditLog.create(null, userId, 'VOTING_SESSION_DELETE', `Deleted "${session.title}"`);

  emit('votingSessionDeleted', { id: Number(id) });

  return {
    success: true,
  };
};

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────

exports.getAnalytics = async () => {
  const { totals, totalVotes, recentSessions } = await Vote.getAnalytics();

  return {
    success: true,
    data: {
      ...totals,
      total_votes: totalVotes.total_votes,
      recent_sessions: recentSessions,
    },
  };
};