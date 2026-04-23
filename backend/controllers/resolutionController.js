/**
 * Resolution Controller - Handles resolution HTTP requests.
 */
const resolutionService = require('../services/resolutionService');
const { generateResolutionPdf } = require('../services/pdfService');

/**
 * Get workflow status for a resolution.
 * GET /resolutions/:id/workflow-status
 */
exports.getWorkflowStatus = async (req, res) => {
  try {
    const status = await resolutionService.getWorkflowStatus(req.params.id);
    res.json(status);
  } catch (err) {
    console.error('Get workflow status error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching workflow status' });
  }
};

/**
 * Create a new resolution.
 * POST /resolutions
 */
exports.create = async (req, res) => {
  try {
    let data = req.body;
    // Handle multipart/form-data file uploads
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(f => `/uploads/ordinances/${f.filename}`);
      let attachments = [];
      if (Array.isArray(data.attachments)) {
        attachments = data.attachments;
      } else if (typeof data.attachments === 'string' && data.attachments.trim()) {
        try { attachments = JSON.parse(data.attachments); } catch { attachments = [data.attachments]; }
      }
      data = { ...data, attachments: [...attachments, ...filePaths] };
    }
    // Parse co_authors if sent as string (from FormData)
    if (typeof data.co_authors === 'string') {
      try { data.co_authors = JSON.parse(data.co_authors); } catch { data.co_authors = data.co_authors.split(',').map(id => Number(id.trim())).filter(Boolean); }
    }
    const resolution = await resolutionService.createResolution(data, req.user);
    res.json(resolution);
  } catch (err) {
    console.error('Resolution create error:', err);
    res.status(500).json({ error: 'Error creating resolution' });
  }
};

/**
 * Get all resolutions.
 * GET /resolutions
 */
exports.getAll = async (req, res) => {
  try {
    const resolutions = await resolutionService.getAllResolutions(req.query.status, req.query.proposer);
    res.json(resolutions);
  } catch (err) {
    console.error('Get resolutions error:', err);
    res.status(500).json({ error: 'Error fetching resolutions' });
  }
};

/**
 * Get a single resolution by ID.
 * GET /resolutions/:id
 */
exports.getById = async (req, res) => {
  try {
    const resolution = await resolutionService.getResolutionById(req.params.id);
    res.json(resolution);
  } catch (err) {
    console.error('Get resolution error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error fetching resolution' });
  }
};

/**
 * Update a resolution.
 * PUT /resolutions/:id
 */
exports.update = async (req, res) => {
  try {
    let data = req.body;
    // Handle multipart/form-data file uploads
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(f => `/uploads/ordinances/${f.filename}`);
      let attachments = [];
      if (Array.isArray(data.attachments)) {
        attachments = data.attachments;
      } else if (typeof data.attachments === 'string' && data.attachments.trim()) {
        try { attachments = JSON.parse(data.attachments); } catch { attachments = [data.attachments]; }
      }
      data = { ...data, attachments: [...attachments, ...filePaths] };
    }
    // Parse co_authors if sent as string (from FormData)
    if (typeof data.co_authors === 'string') {
      try { data.co_authors = JSON.parse(data.co_authors); } catch { data.co_authors = data.co_authors.split(',').map(id => Number(id.trim())).filter(Boolean); }
    }
    const resolution = await resolutionService.updateResolution(req.params.id, data, req.user.id, req.user.role);
    res.json(resolution);
  } catch (err) {
    console.error('Update resolution error:', err);
    if (err.status === 403) return res.status(403).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating resolution' });
  }
};

/**
 * Delete a resolution.
 * DELETE /resolutions/:id
 */
exports.remove = async (req, res) => {
  try {
    await resolutionService.deleteResolution(req.params.id, req.user.id);
    res.json({ message: 'Resolution deleted successfully' });
  } catch (err) {
    console.error('Delete resolution error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error deleting resolution' });
  }
};

/**
 * Get workflow data for a resolution.
 * GET /resolutions/:id/workflow
 */
exports.getWorkflow = async (req, res) => {
  try {
    const workflow = await resolutionService.getWorkflow(req.params.id);
    res.json(workflow);
  } catch (err) {
    console.error('Get workflow error:', err);
    res.status(500).json({ error: 'Error fetching workflow' });
  }
};

/**
 * Get workflow history for a resolution.
 * GET /resolutions/:id/history
 */
exports.getHistory = async (req, res) => {
  try {
    const history = await resolutionService.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'Error fetching history' });
  }
};

/**
 * Get approvals for a resolution.
 * GET /resolutions/:id/approvals
 */
exports.getApprovals = async (req, res) => {
  try {
    const approvals = await resolutionService.getApprovals(req.params.id);
    res.json(approvals);
  } catch (err) {
    console.error('Get approvals error:', err);
    res.status(500).json({ error: 'Error fetching approvals' });
  }
};

/**
 * Change the status of a resolution.
 * PATCH /resolutions/:id/status
 */
exports.changeStatus = async (req, res) => {
  try {
    const resolution = await resolutionService.changeStatus(req.params.id, req.body.status, req.user);
    res.json(resolution);
  } catch (err) {
    console.error('Status change error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 403) return res.status(403).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error updating status' });
  }
};

/**
 * Perform a workflow action on a resolution.
 * POST /resolutions/:id/workflow-action
 */
exports.workflowAction = async (req, res) => {
  try {
    const result = await resolutionService.performWorkflowAction(
      req.params.id,
      req.body.action,
      req.body.comment,
      req.user.id,
      req.user.role
    );
    res.json(result);
  } catch (err) {
    console.error('Workflow action error:', err);
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 403) return res.status(403).json({ error: err.message });
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error performing workflow action' });
  }
};

/**
 * Create an approval record.
 * POST /resolutions/:id/approvals
 */
exports.createApproval = async (req, res) => {
  try {
    const approval = await resolutionService.createApproval(req.params.id, req.body);
    res.json(approval);
  } catch (err) {
    console.error('Create approval error:', err);
    res.status(500).json({ error: 'Error creating approval' });
  }
};

/**
 * Update an approval record.
 * PUT /resolutions/:id/approvals/:approvalId
 */
exports.updateApproval = async (req, res) => {
  try {
    const approval = await resolutionService.updateApproval(
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
 * Generate and download a PDF for a resolution.
 * GET /resolutions/:id/generate-pdf
 */
exports.generatePdf = async (req, res) => {
  try {
    const resolution = await resolutionService.getResolutionById(req.params.id);
    const filename = `resolution-${resolution.resolution_number || resolution.id}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generateResolutionPdf(resolution, res);
  } catch (err) {
    console.error('Generate resolution PDF error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: 'Error generating PDF' });
  }
};

// ─── Three-Readings Legislative Workflow Handlers ─────────────────────────────

/** POST /resolutions/:id/submit-to-vice-mayor */
exports.submitToViceMayor = async (req, res) => {
  try {
    const result = await resolutionService.submitToViceMayor(req.params.id, req.body.comment, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Submit to vice mayor error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error submitting to vice mayor' });
  }
};

/** POST /resolutions/:id/first-reading */
exports.firstReading = async (req, res) => {
  try {
    const { session_id, discussion_notes, presiding_officer } = req.body;
    const result = await resolutionService.conductFirstReading(
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

/** POST /resolutions/:id/assign-committee */
exports.assignCommittee = async (req, res) => {
  try {
    const { committee_id } = req.body;
    const result = await resolutionService.assignCommittee(req.params.id, committee_id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Assign committee error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error assigning committee' });
  }
};

/** POST /resolutions/:id/committee-report */
exports.committeeReport = async (req, res) => {
  try {
    const result = await resolutionService.submitCommitteeReport(req.params.id, req.body, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Committee report error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    if (err.status === 403) return res.status(403).json({ error: err.message });
    res.status(500).json({ error: 'Error submitting committee report' });
  }
};

/** GET /resolutions/:id/committee-report */
exports.getCommitteeReport = async (req, res) => {
  try {
    const report = await resolutionService.getCommitteeReport(req.params.id);
    res.json(report);
  } catch (err) {
    console.error('Get committee report error:', err);
    res.status(500).json({ error: 'Error fetching committee report' });
  }
};

/** POST /resolutions/:id/second-reading */
exports.secondReading = async (req, res) => {
  try {
    const { session_id, discussion_notes, presiding_officer } = req.body;
    const result = await resolutionService.conductSecondReading(
      req.params.id, session_id, discussion_notes, presiding_officer, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Second reading error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording second reading' });
  }
};

/** POST /resolutions/:id/open-voting */
exports.openThirdReadingVote = async (req, res) => {
  try {
    const { session_id, presiding_officer } = req.body;
    const result = await resolutionService.openThirdReadingVote(
      req.params.id, session_id, presiding_officer, req.user.id
    );
    res.json(result);
  } catch (err) {
    console.error('Open third reading vote error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error opening voting' });
  }
};

/** POST /resolutions/:id/cast-vote */
exports.castThirdReadingVote = async (req, res) => {
  try {
    const { vote_option } = req.body;
    const result = await resolutionService.castThirdReadingVote(req.params.id, vote_option, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Cast vote error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error casting vote' });
  }
};

/** GET /resolutions/:id/voting-status */
exports.getThirdReadingVotingStatus = async (req, res) => {
  try {
    const result = await resolutionService.getThirdReadingVotingStatus(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Get voting status error:', err);
    res.status(500).json({ error: 'Error fetching voting status' });
  }
};

/** POST /resolutions/:id/close-voting */
exports.closeThirdReadingVote = async (req, res) => {
  try {
    const result = await resolutionService.closeThirdReadingVote(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Close third reading vote error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error closing voting' });
  }
};

/** POST /resolutions/:id/executive-approval */
exports.executiveApproval = async (req, res) => {
  try {
    const { approved_by, approval_remarks } = req.body;
    const result = await resolutionService.executiveApproval(req.params.id, approved_by, approval_remarks, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Executive approval error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording executive approval' });
  }
};

/** POST /resolutions/:id/executive-rejection */
exports.executiveRejection = async (req, res) => {
  try {
    const { approved_by, rejection_reason } = req.body;
    const result = await resolutionService.executiveRejection(req.params.id, approved_by, rejection_reason, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Executive rejection error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error recording executive rejection' });
  }
};

/** POST /resolutions/:id/post-publicly */
exports.postPublicly = async (req, res) => {
  try {
    const { posting_duration_days, posting_location, notes } = req.body;
    const result = await resolutionService.postPublicly(req.params.id, posting_duration_days, posting_location, notes, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Post publicly error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error posting resolution publicly' });
  }
};

/** POST /resolutions/:id/mark-effective */
exports.markEffective = async (req, res) => {
  try {
    const result = await resolutionService.markEffective(req.params.id, req.body.effective_date, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Mark effective error:', err);
    if (err.status === 404) return res.status(404).json({ error: err.message });
    if (err.status === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Error marking resolution as effective' });
  }
};

/** GET /resolutions/:id/sessions */
exports.getResolutionSessions = async (req, res) => {
  try {
    const sessions = await resolutionService.getResolutionSessions(req.params.id);
    res.json(sessions);
  } catch (err) {
    console.error('Get resolution sessions error:', err);
    res.status(500).json({ error: 'Error fetching resolution sessions' });
  }
};
