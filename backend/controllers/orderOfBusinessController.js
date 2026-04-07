/**
 * OrderOfBusiness Controller - Handles HTTP requests for order of business items.
 */
const orderOfBusinessService = require('../services/orderOfBusinessService');
const { generateOrderOfBusinessPdf } = require('../services/pdfService');
const pool = require('../db');

/**
 * Get full order of business for a session.
 * GET /order-of-business/:sessionId
 */
exports.getBySession = async (req, res) => {
  try {
    const items = await orderOfBusinessService.getBySession(req.params.sessionId);
    res.json(items);
  } catch (err) {
    console.error('Get order of business error:', err);
    res.status(500).json({ error: 'Error fetching order of business' });
  }
};

/**
 * Create a new order-of-business item.
 * POST /order-of-business
 */
exports.create = async (req, res) => {
  try {
    const item = await orderOfBusinessService.createItem(req.body, req.user.id);
    res.status(201).json(item);
  } catch (err) {
    console.error('Create order of business item error:', err);
    if (err.code === '23514' || err.code === '22P02') {
      return res.status(400).json({
        error: err.detail || 'Invalid order of business data. Please review the selected item type and numeric fields.',
      });
    }
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error creating order of business item' });
  }
};

/**
 * Update an order-of-business item.
 * PUT /order-of-business/:id
 */
exports.update = async (req, res) => {
  try {
    const item = await orderOfBusinessService.updateItem(req.params.id, req.body, req.user.id);
    res.json(item);
  } catch (err) {
    console.error('Update order of business item error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating order of business item' });
  }
};

/**
 * Delete an order-of-business item.
 * DELETE /order-of-business/:id
 */
exports.remove = async (req, res) => {
  try {
    await orderOfBusinessService.deleteItem(req.params.id, req.user.id);
    res.json({ message: 'Order of business item deleted successfully' });
  } catch (err) {
    console.error('Delete order of business item error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting order of business item' });
  }
};

/**
 * Reorder agenda items.
 * POST /order-of-business/reorder
 */
exports.reorder = async (req, res) => {
  try {
    await orderOfBusinessService.reorderItems(req.body.items, req.user.id);
    res.json({ message: 'Order of business items reordered successfully' });
  } catch (err) {
    console.error('Reorder order of business error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error reordering order of business items' });
  }
};

/**
 * Update item status.
 * PATCH /order-of-business/:id/status
 */
exports.updateStatus = async (req, res) => {
  try {
    const item = await orderOfBusinessService.updateStatus(req.params.id, req.body.status, req.user.id);
    res.json(item);
  } catch (err) {
    console.error('Update order of business status error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error updating order of business status' });
  }
};

/**
 * Get all unassigned (no session) order-of-business items.
 * GET /order-of-business/unassigned
 */
exports.getUnassigned = async (req, res) => {
  try {
    const items = await orderOfBusinessService.getUnassigned();
    res.json(items);
  } catch (err) {
    console.error('Get unassigned order of business error:', err);
    res.status(500).json({ error: 'Error fetching unassigned order of business items' });
  }
};

/**
 * Batch-create multiple order-of-business items.
 * POST /order-of-business/batch
 */
exports.batchCreate = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required and must not be empty' });
    }
    const created = await orderOfBusinessService.batchCreate(items, req.user.id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Batch create order of business error:', err);
    if (err.code === '23514' || err.code === '22P02') {
      return res.status(400).json({ error: err.detail || 'Invalid order of business data.' });
    }
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error batch-creating order of business items' });
  }
};

/**
 * Generate PDF for a session's order of business.
 * GET /order-of-business/:sessionId/generate-pdf
 */
exports.generatePdf = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionResult.rows[0];
    const items = await orderOfBusinessService.getBySession(sessionId);

    const filename = `order-of-business-session-${sessionId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generateOrderOfBusinessPdf(session, items, res);
  } catch (err) {
    console.error('Generate OOB PDF error:', err);
    res.status(500).json({ error: 'Error generating PDF' });
  }
};

/**
 * Get all sessions that have OOB items (compiled list).
 * GET /order-of-business/sessions-with-oob
 */
exports.getSessionsWithOob = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, s.title, s.date, s.location,
              COUNT(o.id)::int AS item_count
       FROM sessions s
       INNER JOIN order_of_business o ON o.session_id = s.id
       GROUP BY s.id
       ORDER BY s.date DESC, s.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get sessions with OOB error:', err);
    res.status(500).json({ error: 'Error fetching sessions with order of business' });
  }
};

/**
 * Delete all OOB items for a session.
 * DELETE /order-of-business/session/:sessionId
 */
exports.deleteBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionResult = await pool.query('SELECT id, title FROM sessions WHERE id = $1', [sessionId]);
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const result = await pool.query('DELETE FROM order_of_business WHERE session_id = $1', [sessionId]);
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create(null, req.user.id, 'ORDER_OF_BUSINESS_DELETE',
      `All order of business items deleted for session "${sessionResult.rows[0].title}"`);
    res.json({ message: 'All order of business items deleted', count: result.rowCount });
  } catch (err) {
    console.error('Delete OOB by session error:', err);
    res.status(500).json({ error: 'Error deleting order of business items' });
  }
};

/**
 * Assign OOB items to a session.
 * POST /order-of-business/assign-session
 */
exports.assignToSession = async (req, res) => {
  try {
    const { session_id, item_ids } = req.body;
    if (!session_id || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'session_id and item_ids array are required' });
    }
    await orderOfBusinessService.assignToSession(session_id, item_ids, req.user.id);
    res.json({ message: 'Items assigned to session successfully' });
  } catch (err) {
    console.error('Assign OOB to session error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error assigning items to session' });
  }
};
