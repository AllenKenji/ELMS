/**
 * OrderOfBusiness Controller - Handles HTTP requests for order of business items.
 */
const orderOfBusinessService = require('../services/orderOfBusinessService');

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
