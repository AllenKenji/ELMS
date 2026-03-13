const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');
const {
  getCommitteeWithMembers,
  validateCommitteeChair,
} = require('../utils/committeesHelper');

// CREATE committee
router.post('/', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  const { name, description, chair_id, status } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Committee name is required' });
  }

  try {
    if (chair_id) {
      const chair = await validateCommitteeChair(chair_id);
      if (!chair) {
        return res.status(400).json({ error: 'Chair user not found' });
      }
    }

    const result = await pool.query(
      `INSERT INTO committees (name, description, chair_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [name, description || null, chair_id || null, status || 'Active']
    );

    const committee = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'COMMITTEE_CREATE', `Committee "${name}" created`]
    );

    // Real-time notification
    const io = getIO();
    io.emit('committeeCreated', committee);

    res.status(201).json(committee);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A committee with that name already exists' });
    }
    console.error('Committee create error:', err);
    res.status(500).json({ error: 'Error creating committee' });
  }
});

// GET all committees
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT c.*, u.name AS chair_name
      FROM committees c
      LEFT JOIN users u ON u.id = c.chair_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get committees error:', err);
    res.status(500).json({ error: 'Error fetching committees' });
  }
});

// GET single committee with members
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const committee = await getCommitteeWithMembers(req.params.id);

    if (!committee) {
      return res.status(404).json({ error: 'Committee not found' });
    }

    res.json(committee);
  } catch (err) {
    console.error('Get committee error:', err);
    res.status(500).json({ error: 'Error fetching committee' });
  }
});

// UPDATE committee
router.put('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  const { name, description, chair_id, status } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM committees WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Committee not found' });
    }

    if (chair_id) {
      const chair = await validateCommitteeChair(chair_id);
      if (!chair) {
        return res.status(400).json({ error: 'Chair user not found' });
      }
    }

    const result = await pool.query(
      `UPDATE committees
       SET name=$1, description=$2, chair_id=$3, status=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [
        name || existing.rows[0].name,
        description !== undefined ? description : existing.rows[0].description,
        chair_id !== undefined ? chair_id : existing.rows[0].chair_id,
        status || existing.rows[0].status,
        req.params.id,
      ]
    );

    const committee = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'COMMITTEE_UPDATE', `Committee "${committee.name}" updated`]
    );

    // Real-time notification
    const io = getIO();
    io.emit('committeeUpdated', committee);

    res.json(committee);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A committee with that name already exists' });
    }
    console.error('Update committee error:', err);
    res.status(500).json({ error: 'Error updating committee' });
  }
});

// DELETE committee
router.delete('/:id', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM committees WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Committee not found' });
    }

    const committeeName = existing.rows[0].name;

    await pool.query('DELETE FROM committees WHERE id = $1', [req.params.id]);

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'COMMITTEE_DELETE', `Committee "${committeeName}" deleted`]
    );

    // Real-time notification
    const io = getIO();
    io.emit('committeeDeleted', { id: Number(req.params.id), name: committeeName });

    res.json({ message: 'Committee deleted successfully' });
  } catch (err) {
    console.error('Delete committee error:', err);
    res.status(500).json({ error: 'Error deleting committee' });
  }
});

// GET committee members
router.get('/:id/members', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM committees WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Committee not found' });
    }

    const result = await pool.query(
      `SELECT cm.*, u.name AS user_name, u.email AS user_email
       FROM committee_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.committee_id = $1
       ORDER BY cm.joined_at ASC`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get committee members error:', err);
    res.status(500).json({ error: 'Error fetching committee members' });
  }
});

// ADD member to committee
router.post(
  '/:id/members',
  authenticateToken,
  authorizeRoles('Admin', 'Secretary'),
  async (req, res) => {
    const { user_id, role } = req.body;
    const committeeId = req.params.id;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const validRoles = ['Chair', 'Member', 'Secretary'];
    const memberRole = role || 'Member';
    if (!validRoles.includes(memberRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be Chair, Member, or Secretary' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const committeeResult = await client.query(
        'SELECT * FROM committees WHERE id = $1',
        [committeeId]
      );
      if (committeeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Committee not found' });
      }

      const userResult = await client.query('SELECT id, name FROM users WHERE id = $1', [user_id]);
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'User not found' });
      }

      const existingMember = await client.query(
        'SELECT id FROM committee_members WHERE committee_id = $1 AND user_id = $2',
        [committeeId, user_id]
      );
      const alreadyMember = existingMember.rows.length > 0;
      if (alreadyMember) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'User is already a member of this committee' });
      }

      const result = await client.query(
        `INSERT INTO committee_members (committee_id, user_id, role, joined_at)
         VALUES ($1, $2, $3, NOW()) RETURNING *`,
        [committeeId, user_id, memberRole]
      );

      const member = result.rows[0];
      member.user_name = userResult.rows[0].name;

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action, details, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [
          req.user.id,
          'COMMITTEE_MEMBER_ADD',
          `User "${userResult.rows[0].name}" added to committee "${committeeResult.rows[0].name}" as ${memberRole}`,
        ]
      );

      await client.query('COMMIT');

      // Notify added user
      await createNotification(
        user_id,
        `You have been added to committee "${committeeResult.rows[0].name}" as ${memberRole}.`
      );

      // Real-time notification
      const io = getIO();
      io.emit('committeeMemberAdded', { committeeId: Number(committeeId), member });

      res.status(201).json(member);
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        return res.status(409).json({ error: 'User is already a member of this committee' });
      }
      console.error('Add committee member error:', err);
      res.status(500).json({ error: 'Error adding committee member' });
    } finally {
      client.release();
    }
  }
);

// REMOVE member from committee
router.delete(
  '/:id/members/:memberId',
  authenticateToken,
  authorizeRoles('Admin', 'Secretary'),
  async (req, res) => {
    const { id: committeeId, memberId } = req.params;

    try {
      const committeeResult = await pool.query(
        'SELECT * FROM committees WHERE id = $1',
        [committeeId]
      );
      if (committeeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Committee not found' });
      }

      const memberResult = await pool.query(
        `SELECT cm.*, u.name AS user_name
         FROM committee_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.id = $1 AND cm.committee_id = $2`,
        [memberId, committeeId]
      );
      if (memberResult.rows.length === 0) {
        return res.status(404).json({ error: 'Committee member not found' });
      }

      const memberRow = memberResult.rows[0];

      await pool.query('DELETE FROM committee_members WHERE id = $1', [memberId]);

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, details, timestamp)
         VALUES ($1, $2, $3, NOW())`,
        [
          req.user.id,
          'COMMITTEE_MEMBER_REMOVE',
          `User "${memberRow.user_name}" removed from committee "${committeeResult.rows[0].name}"`,
        ]
      );

      // Notify removed user
      await createNotification(
        memberRow.user_id,
        `You have been removed from committee "${committeeResult.rows[0].name}".`
      );

      // Real-time notification
      const io = getIO();
      io.emit('committeeMemberRemoved', {
        committeeId: Number(committeeId),
        memberId: Number(memberId),
      });

      res.json({ message: 'Committee member removed successfully' });
    } catch (err) {
      console.error('Remove committee member error:', err);
      res.status(500).json({ error: 'Error removing committee member' });
    }
  }
);

module.exports = router;
