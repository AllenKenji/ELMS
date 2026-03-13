const pool = require('../db');

/**
 * Fetch a committee by ID including all its members.
 */
async function getCommitteeWithMembers(committeeId) {
  const committeeResult = await pool.query(
    `SELECT c.*, u.name AS chair_name
     FROM committees c
     LEFT JOIN users u ON u.id = c.chair_id
     WHERE c.id = $1`,
    [committeeId]
  );

  if (committeeResult.rows.length === 0) return null;

  const committee = committeeResult.rows[0];

  const membersResult = await pool.query(
    `SELECT cm.*, u.name AS user_name, u.email AS user_email
     FROM committee_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.committee_id = $1
     ORDER BY cm.joined_at ASC`,
    [committeeId]
  );

  committee.members = membersResult.rows;
  return committee;
}

/**
 * Validate that a given user exists and can be a committee chair.
 */
async function validateCommitteeChair(chairId) {
  const result = await pool.query('SELECT id, name FROM users WHERE id = $1', [chairId]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Check whether a user is already a member of a committee.
 */
async function isCommitteeMember(committeeId, userId) {
  const result = await pool.query(
    'SELECT id FROM committee_members WHERE committee_id = $1 AND user_id = $2',
    [committeeId, userId]
  );
  return result.rows.length > 0;
}

module.exports = { getCommitteeWithMembers, validateCommitteeChair, isCommitteeMember };
