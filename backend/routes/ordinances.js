const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const authorizeRoles = require('../middleware/roles');
const { createNotification } = require('../utils/notifications');
const { getIO } = require('../socket');

// ============================================
// BASIC CRUD OPERATIONS
// ============================================

// CREATE ordinance (only Secretaries and Councilors can submit)
router.post('/', authenticateToken, authorizeRoles('Secretary', 'Councilor'), async (req, res) => {
  const { title, ordinance_number, description, content, remarks, proposer_name } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ordinances (
        title, ordinance_number, description, content, remarks, 
        proposer_id, proposer_name, status, created_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', NOW()) 
       RETURNING *`,
      [title, ordinance_number, description, content, remarks, req.user.id, proposer_name || req.user.name]
    );

    const ordinance = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'ORDINANCE_CREATE', `Ordinance "${title}" created`]
    );

    // Notify user (confirmation)
    await createNotification(req.user.id, `Your ordinance "${title}" has been created.`);
    
    const io = getIO();
    io.to('Secretary').emit('ordinanceCreated', ordinance);
    io.to('Councilor').emit('ordinanceCreated', ordinance);

    res.json(ordinance);
  } catch (err) {
    console.error('Create ordinance error:', err);
    res.status(500).json({ error: 'Error creating ordinance' });
  }
});

// READ all ordinances
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { proposer_id } = req.query;
    let query = 'SELECT * FROM ordinances';
    let params = [];

    if (proposer_id) {
      query += ' WHERE proposer_id = $1';
      params = [proposer_id];
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get ordinances error:', err);
    res.status(500).json({ error: 'Error fetching ordinances' });
  }
});

// READ single ordinance
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ordinances WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ordinance not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get ordinance error:', err);
    res.status(500).json({ error: 'Error fetching ordinance' });
  }
});

// UPDATE ordinance (basic info)
router.put('/:id', authenticateToken, authorizeRoles('Secretary', 'Councilor', 'Admin'), async (req, res) => {
  const { title, ordinance_number, description, content, remarks } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ordinances
       SET title = COALESCE($1, title),
           ordinance_number = COALESCE($2, ordinance_number),
           description = COALESCE($3, description),
           content = COALESCE($4, content),
           remarks = COALESCE($5, remarks),
           updated_at = NOW()
       WHERE id=$6 RETURNING *`,
      [title, ordinance_number, description, content, remarks, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ordinance not found' });
    }

    const ordinance = result.rows[0];

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'ORDINANCE_UPDATE', `Ordinance "${title}" updated`]
    );

    res.json(ordinance);
  } catch (err) {
    console.error('Update ordinance error:', err);
    res.status(500).json({ error: 'Error updating ordinance' });
  }
});

// DELETE ordinance (only Admin and Secretary)
router.delete('/:id', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ordinance = await client.query('SELECT * FROM ordinances WHERE id=$1', [req.params.id]);
    if (ordinance.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ordinance not found' });
    }

    // Delete related records
    await client.query('DELETE FROM ordinance_workflow WHERE ordinance_id=$1', [req.params.id]);
    await client.query('DELETE FROM ordinance_approvals WHERE ordinance_id=$1', [req.params.id]);
    await client.query('DELETE FROM ordinances WHERE id=$1', [req.params.id]);

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'ORDINANCE_DELETE', `Ordinance "${ordinance.rows[0].title}" deleted`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Ordinance deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete ordinance error:', err);
    res.status(500).json({ error: 'Error deleting ordinance' });
  } finally {
    client.release();
  }
});

// ============================================
// WORKFLOW ENDPOINTS
// ============================================

// GET workflow data for an ordinance
router.get('/:id/workflow', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM ordinance_workflow WHERE ordinance_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json({ actions: result.rows });
  } catch (err) {
    console.error('Get workflow error:', err);
    res.status(500).json({ error: 'Error fetching workflow' });
  }
});

// GET workflow history/timeline for an ordinance
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        ow.id,
        ow.ordinance_id,
        ow.action_type as action,
        ow.status,
        ow.performed_by_id,
        u.name as changed_by_name,
        ow.comment as notes,
        ow.created_at as changed_at
       FROM ordinance_workflow ow
       LEFT JOIN users u ON u.id = ow.performed_by_id
       WHERE ow.ordinance_id=$1
       ORDER BY ow.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error fetching history' });
  }
});

// GET approvals for an ordinance
router.get('/:id/approvals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        ordinance_id,
        approver_role,
        approver_id,
        u.name as approver_name,
        status,
        approved_at,
        notes
       FROM ordinance_approvals oa
       LEFT JOIN users u ON u.id = oa.approver_id
       WHERE oa.ordinance_id=$1
       ORDER BY approver_role ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get approvals error:', err);
    res.status(500).json({ error: 'Error fetching approvals' });
  }
});

// CHANGE STATUS (simplified - updates ordinance status directly)
router.put('/:id/status', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  const { status, notes } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Update ordinance status
    const ordinanceResult = await client.query(
      `UPDATE ordinances SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [status, req.params.id]
    );

    if (ordinanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ordinance not found' });
    }

    const ordinance = ordinanceResult.rows[0];

    // Record in workflow history
    await client.query(
      `INSERT INTO ordinance_workflow (ordinance_id, action_type, status, performed_by_id, comment, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [req.params.id, 'STATUS_CHANGE', status, req.user.id, notes || '']
    );

    // Set approval dates based on status
    if (status === 'Approved') {
      await client.query(
        `UPDATE ordinances SET approved_date=NOW() WHERE id=$1`,
        [req.params.id]
      );
    }
    if (status === 'Published') {
      await client.query(
        `UPDATE ordinances SET published_date=NOW() WHERE id=$1`,
        [req.params.id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, 'STATUS_CHANGE', `Ordinance status changed to "${status}"`]
    );

    // Notify proposer
    await createNotification(
      ordinance.proposer_id,
      `Your ordinance "${ordinance.title}" status changed to "${status}".`
    );

    // Broadcast to all users
    const io = getIO();
    io.emit('ordinanceStatusChanged', { ordinance, newStatus: status });

    await client.query('COMMIT');
    res.json({ ordinance, workflow: { status, changed_at: new Date() } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Status change error:', err);
    res.status(500).json({ error: 'Error changing status' });
  } finally {
    client.release();
  }
});

// SUBMIT WORKFLOW ACTION (approve, reject, request_changes, etc.)
router.post('/:id/workflow-action', authenticateToken, async (req, res) => {
  const { action, comment } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate ordinance exists
    const ordinanceResult = await client.query(
      'SELECT * FROM ordinances WHERE id=$1',
      [req.params.id]
    );

    if (ordinanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ordinance not found' });
    }

    const ordinance = ordinanceResult.rows[0];

    // Determine new status based on action
    let newStatus = ordinance.status;
    const validActions = {
      'submit': 'Submitted',
      'approve': 'Approved',
      'reject': 'Rejected',
      'request_changes': 'Draft',
      'publish': 'Published',
      'archive': 'Archived'
    };

    if (!validActions[action]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid action' });
    }

    newStatus = validActions[action];

    // Update ordinance status
    const updatedOrdinance = await client.query(
      `UPDATE ordinances SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [newStatus, req.params.id]
    );

    // Record workflow action
    const workflowResult = await client.query(
      `INSERT INTO ordinance_workflow (
        ordinance_id, action_type, status, performed_by_id, comment, created_at
      )
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.params.id, action.toUpperCase(), newStatus, req.user.id, comment || '']
    );

    // Set approval dates
    if (newStatus === 'Approved') {
      await client.query(
        'UPDATE ordinances SET approved_date=NOW() WHERE id=$1',
        [req.params.id]
      );
    }
    if (newStatus === 'Published') {
      await client.query(
        'UPDATE ordinances SET published_date=NOW() WHERE id=$1',
        [req.params.id]
      );
    }

    // Update approval records if needed
    if (['approve', 'reject'].includes(action)) {
      await client.query(
        `UPDATE ordinance_approvals 
         SET status=$1, approved_at=NOW(), notes=$2
         WHERE ordinance_id=$3 AND approver_id=$4`,
        [action === 'approve' ? 'Approved' : 'Rejected', comment || '', req.params.id, req.user.id]
      );
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, details, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [req.user.id, `WORKFLOW_${action.toUpperCase()}`, `Action: ${action} on ordinance "${ordinance.title}"`]
    );

    // Notification
    const actionMessages = {
      'submit': 'submitted for review',
      'approve': 'approved',
      'reject': 'rejected',
      'request_changes': 'requested changes for',
      'publish': 'published',
      'archive': 'archived'
    };

    await createNotification(
      ordinance.proposer_id,
      `Your ordinance "${ordinance.title}" has been ${actionMessages[action]}.`
    );

    // Get updated workflow and approvals
    const workflowHistory = await client.query(
      `SELECT * FROM ordinance_workflow WHERE ordinance_id=$1 ORDER BY created_at DESC`,
      [req.params.id]
    );

    const approvals = await client.query(
      `SELECT * FROM ordinance_approvals WHERE ordinance_id=$1`,
      [req.params.id]
    );

    // Broadcast to all users
    const io = getIO();
    io.emit('ordinanceWorkflowUpdated', {
      ordinance: updatedOrdinance.rows[0],
      action,
      workflow: workflowResult.rows[0]
    });

    await client.query('COMMIT');

    res.json({
      ordinance: updatedOrdinance.rows[0],
      workflow: workflowHistory.rows,
      approvals: approvals.rows,
      message: `Action "${action}" performed successfully`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Workflow action error:', err);
    res.status(500).json({ error: 'Error performing workflow action' });
  } finally {
    client.release();
  }
});

// ============================================
// APPROVAL MANAGEMENT ENDPOINTS
// ============================================

// CREATE approval record for ordinance
router.post('/:id/approvals', authenticateToken, authorizeRoles('Admin', 'Secretary'), async (req, res) => {
  const { approver_role, approver_id, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO ordinance_approvals (
        ordinance_id, approver_role, approver_id, status, notes, created_at
      )
       VALUES ($1, $2, $3, 'Pending', $4, NOW())
       RETURNING *`,
      [req.params.id, approver_role, approver_id, notes || '']
    );

    const approval = result.rows[0];

    // Notify approver
    if (approver_id) {
      const ordinance = await pool.query('SELECT title FROM ordinances WHERE id=$1', [req.params.id]);
      await createNotification(
        approver_id,
        `New ordinance awaiting your approval: "${ordinance.rows[0]?.title}"`
      );
    }

    res.json(approval);
  } catch (err) {
    console.error('Create approval error:', err);
    res.status(500).json({ error: 'Error creating approval' });
  }
});

// UPDATE approval status
router.put('/:id/approvals/:approvalId', authenticateToken, async (req, res) => {
  const { status, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ordinance_approvals 
       SET status=$1, notes=$2, approved_at=NOW()
       WHERE id=$3 AND ordinance_id=$4
       RETURNING *`,
      [status, notes || '', req.params.approvalId, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update approval error:', err);
    res.status(500).json({ error: 'Error updating approval' });
  }
});

module.exports = router;