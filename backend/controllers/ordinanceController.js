/**
 * Ordinance Controller - Handles ordinance HTTP requests.
 */
const ordinanceService = require('../services/ordinanceService');
const { generateOrdinancePdf } = require('../services/pdfService');

/**
 * Create a new ordinance.
 * POST /ordinances
 */
exports.create = async (req, res) => {
  try {
    const ordinance = await ordinanceService.createOrdinance(req.body, req.user);
    res.json(ordinance);
  } catch (err) {
    console.error('Create ordinance error:', err);
    res.status(500).json({ error: 'Error creating ordinance' });
  }
};

/**
 * Get all ordinances.
 * GET /ordinances
 */
exports.getAll = async (req, res) => {
  try {
    const ordinances = await ordinanceService.getAllOrdinances(req.query.proposer_id);
    res.json(ordinances);
  } catch (err) {
    console.error('Get ordinances error:', err);
    res.status(500).json({ error: 'Error fetching ordinances' });
  }
};

/**
 * Get a single ordinance by ID.
 * GET /ordinances/:id
 */
exports.getById = async (req, res) => {
  try {
    const ordinance = await ordinanceService.getOrdinanceById(req.params.id);
    res.json(ordinance);
  } catch (err) {
    console.error('Get ordinance error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching ordinance' });
  }
};

/**
 * Update an ordinance.
 * PUT /ordinances/:id
 */
exports.update = async (req, res) => {
  try {
    const ordinance = await ordinanceService.updateOrdinance(req.params.id, req.body, req.user.id);
    res.json(ordinance);
  } catch (err) {
    console.error('Update ordinance error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating ordinance' });
  }
};

/**
 * Delete an ordinance.
 * DELETE /ordinances/:id
 */
exports.remove = async (req, res) => {
  try {
    await ordinanceService.deleteOrdinance(req.params.id, req.user.id);
    res.json({ message: 'Ordinance deleted successfully' });
  } catch (err) {
    console.error('Delete ordinance error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting ordinance' });
  }
};

/**
 * Get workflow data for an ordinance.
 * GET /ordinances/:id/workflow
 */
exports.getWorkflow = async (req, res) => {
  try {
    const workflow = await ordinanceService.getWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('Get workflow error:', err);
    res.status(500).json({ error: 'Error fetching workflow' });
  }
};

/**
 * Get workflow history for an ordinance.
 * GET /ordinances/:id/history
 */
exports.getHistory = async (req, res) => {
  try {
    const history = await ordinanceService.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error fetching history' });
  }
};

/**
 * Get approvals for an ordinance.
 * GET /ordinances/:id/approvals
 */
exports.getApprovals = async (req, res) => {
  try {
    const approvals = await ordinanceService.getApprovals(req.params.id);
    res.json(approvals);
  } catch (err) {
    console.error('Get approvals error:', err);
    res.status(500).json({ error: 'Error fetching approvals' });
  }
};

/**
 * Change the status of an ordinance.
 * PUT /ordinances/:id/status
 */
exports.changeStatus = async (req, res) => {
  try {
    const result = await ordinanceService.changeStatus(
      req.params.id,
      req.body.status,
      req.body.notes,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Status change error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error changing status' });
  }
};

/**
 * Perform a workflow action on an ordinance.
 * POST /ordinances/:id/workflow-action
 */
exports.workflowAction = async (req, res) => {
  try {
    const result = await ordinanceService.performWorkflowAction(
      req.params.id,
      req.body.action,
      req.body.comment,
      req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Workflow action error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error performing workflow action' });
  }
};

/**
 * Create an approval record.
 * POST /ordinances/:id/approvals
 */
exports.createApproval = async (req, res) => {
  try {
    const approval = await ordinanceService.createApproval(req.params.id, req.body);
    res.json(approval);
  } catch (err) {
    console.error('Create approval error:', err);
    res.status(500).json({ error: 'Error creating approval' });
  }
};

/**
 * Update an approval record.
 * PUT /ordinances/:id/approvals/:approvalId
 */
exports.updateApproval = async (req, res) => {
  try {
    const approval = await ordinanceService.updateApproval(
      req.params.approvalId,
      req.params.id,
      req.body.status,
      req.body.notes
    );
    res.json(approval);
  } catch (err) {
    console.error('Update approval error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating approval' });
  }
};

/**
 * Generate and download a PDF for an ordinance.
 * GET /ordinances/:id/generate-pdf
 */
exports.generatePdf = async (req, res) => {
  try {
    const ordinance = await ordinanceService.getOrdinanceById(req.params.id);
    const filename = `ordinance-${ordinance.ordinance_number || ordinance.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generateOrdinancePdf(ordinance, res);
  } catch (err) {
    console.error('Generate ordinance PDF error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error generating PDF' });
  }
};
