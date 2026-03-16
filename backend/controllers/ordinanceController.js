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

// ─── Three-Readings Legislative Workflow Handlers ─────────────────────────────

/** POST /ordinances/:id/submit-to-secretary */
exports.submitToSecretary = async (req, res) => {
  try {
    const result = await ordinanceService.submitToSecretary(req.params.id, req.body.comment, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Submit to secretary error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error submitting to secretary' });
  }
};

/** POST /ordinances/:id/first-reading */
exports.firstReading = async (req, res) => {
  try {
    const { session_id, discussion_notes, presiding_officer } = req.body;
    const result = await ordinanceService.conductFirstReading(
      req.params.id, session_id, discussion_notes, presiding_officer, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('First reading error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording first reading' });
  }
};

/** POST /ordinances/:id/assign-committee */
exports.assignCommittee = async (req, res) => {
  try {
    const { committee_id } = req.body;
    const result = await ordinanceService.assignCommittee(req.params.id, committee_id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Assign committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error assigning committee' });
  }
};

/** POST /ordinances/:id/committee-report */
exports.committeeReport = async (req, res) => {
  try {
    const result = await ordinanceService.submitCommitteeReport(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Committee report error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error submitting committee report' });
  }
};

/** GET /ordinances/:id/committee-report */
exports.getCommitteeReport = async (req, res) => {
  try {
    const report = await ordinanceService.getCommitteeReport(req.params.id);
    res.json(report);
  } catch (err) {
    console.error('Get committee report error:', err);
    res.status(500).json({ error: 'Error fetching committee report' });
  }
};

/** POST /ordinances/:id/second-reading */
exports.secondReading = async (req, res) => {
  try {
    const { session_id, discussion_notes, amendments, presiding_officer } = req.body;
    const result = await ordinanceService.conductSecondReading(
      req.params.id, session_id, discussion_notes, amendments, presiding_officer, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Second reading error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording second reading' });
  }
};

/** POST /ordinances/:id/third-reading-vote */
exports.thirdReadingVote = async (req, res) => {
  try {
    const { session_id, yes_count, no_count, abstain_count, presiding_officer } = req.body;
    const result = await ordinanceService.conductThirdReadingVote(
      req.params.id, session_id,
      parseInt(yes_count, 10) || 0,
      parseInt(no_count, 10) || 0,
      parseInt(abstain_count, 10) || 0,
      presiding_officer, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Third reading vote error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording third reading vote' });
  }
};

/** POST /ordinances/:id/executive-approval */
exports.executiveApproval = async (req, res) => {
  try {
    const { approved_by, approval_remarks } = req.body;
    const result = await ordinanceService.executiveApproval(
      req.params.id, approved_by, approval_remarks, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Executive approval error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording executive approval' });
  }
};

/** POST /ordinances/:id/executive-rejection */
exports.executiveRejection = async (req, res) => {
  try {
    const { approved_by, rejection_reason } = req.body;
    const result = await ordinanceService.executiveRejection(
      req.params.id, approved_by, rejection_reason, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Executive rejection error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording executive rejection' });
  }
};

/** POST /ordinances/:id/post-publicly */
exports.postPublicly = async (req, res) => {
  try {
    const { posting_duration_days, posting_location, notes } = req.body;
    const result = await ordinanceService.postPublicly(
      req.params.id, posting_duration_days, posting_location, notes, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Post publicly error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error posting ordinance publicly' });
  }
};

/** POST /ordinances/:id/mark-effective */
exports.markEffective = async (req, res) => {
  try {
    const result = await ordinanceService.markEffective(req.params.id, req.body.effective_date, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Mark effective error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error marking ordinance as effective' });
  }
};

/** GET /ordinances/:id/workflow-status */
exports.getWorkflowStatus = async (req, res) => {
  try {
    const status = await ordinanceService.getWorkflowStatus(req.params.id);
    res.json(status);
  } catch (err) {
    console.error('Workflow status error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching workflow status' });
  }
};

/** POST /sessions/:id/add-agenda-item */
exports.addAgendaItem = async (req, res) => {
  try {
    const { ordinance_id, agenda_order, reading_number } = req.body;
    const result = await ordinanceService.addAgendaItem(req.params.id, ordinance_id, agenda_order, reading_number);
    res.json(result);
  } catch (err) {
    console.error('Add agenda item error:', err);
    res.status(500).json({ error: 'Error adding agenda item' });
  }
};

/** GET /sessions/:id/agenda */
exports.getSessionAgenda = async (req, res) => {
  try {
    const items = await ordinanceService.getSessionAgenda(req.params.id);
    res.json(items);
  } catch (err) {
    console.error('Get session agenda error:', err);
    res.status(500).json({ error: 'Error fetching session agenda' });
  }
};
