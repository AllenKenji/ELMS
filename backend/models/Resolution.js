/**
 * Resolution Model - Data access layer for resolution operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async (status, proposerId) => {
  let query = `
    SELECT r.*, u.name as proposer_name
    FROM resolutions r
    LEFT JOIN users u ON u.id = r.proposer_id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND r.status = $${params.length + 1}`;
    params.push(status);
  }
  if (proposerId) {
    query += ` AND r.proposer_id = $${params.length + 1}`;
    params.push(proposerId);
  }
  query += ' ORDER BY r.created_at DESC';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query(
    `SELECT r.*, u.name as proposer_name
     FROM resolutions r
     LEFT JOIN users u ON u.id = r.proposer_id
     WHERE r.id = $1`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (
  title,
  resolutionNumber,
  description,
  content,
  remarks,
  proposerId,
  proposerName,
  status = 'Draft',
  coAuthors = null,
  whereasClauses = null,
  effectivityClause = null,
  attachments = [],
  readingStage = null
) => {
  const normalizedStatus = {
    draft: 'Draft',
    pending: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    enacted: 'Published',
  }[status] || status;

  return pool.query(
    `INSERT INTO resolutions (
       title, resolution_number, description, content, remarks,
       proposer_id, proposer_name, status,
       co_authors, whereas_clauses, effectivity_clause, attachments,
       reading_stage, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, NOW()) RETURNING *`,
    [
      title,
      resolutionNumber,
      description,
      content,
      remarks || null,
      proposerId,
      proposerName,
      normalizedStatus,
      coAuthors,
      whereasClauses,
      effectivityClause,
      JSON.stringify(Array.isArray(attachments) ? attachments : []),
      readingStage,
    ]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (
  id,
  title,
  resolutionNumber,
  description,
  content,
  remarks,
  status,
  coAuthors,
  whereasClauses,
  effectivityClause,
  attachments
) => {
  return pool.query(
    `UPDATE resolutions
     SET title=$1,
         resolution_number=$2,
         description=$3,
         content=$4,
         remarks=$5,
         status=$6,
         co_authors=$7,
         whereas_clauses=$8,
         effectivity_clause=$9,
         attachments=$10::jsonb,
         updated_at=NOW()
       WHERE id=$11 RETURNING *`,
    [
      title,
      resolutionNumber,
      description,
      content,
      remarks || null,
      status || 'Draft',
      coAuthors || null,
      whereasClauses || null,
      effectivityClause || null,
      JSON.stringify(Array.isArray(attachments) ? attachments : []),
      id,
    ]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (id) => {
  return pool.query('DELETE FROM resolutions WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateStatus = async (id, status) => {
  return pool.query(
    'UPDATE resolutions SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
};

// ─── Legislative Workflow helpers ────────────────────────────────────────────

/** Set reading_stage (and optionally status) on a resolution. */
exports.setReadingStage = async (client, id, readingStage, status) => {
  const q = status
    ? 'UPDATE resolutions SET reading_stage=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *'
    : 'UPDATE resolutions SET reading_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *';
  const params = status ? [readingStage, status, id] : [readingStage, id];
  return client.query(q, params);
};

/** Update committee assignment fields on a resolution. */
exports.assignCommittee = async (client, id, committeeId, assignedBy, targetStage = 'COMMITTEE_REVIEW') => {
  return client.query(
    `UPDATE resolutions
     SET committee_id=$1, committee_assignment_date=NOW(), assigned_by=$2,
         reading_stage=$4, status='Under Review', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [committeeId, assignedBy, id, targetStage]
  );
};

/** Record voting results on a resolution. */
exports.recordVote = async (client, id, votingResults, sessionId) => {
  return client.query(
    `UPDATE resolutions
     SET voting_results=$1, voted_at=NOW(),
         session_id_third_reading=$2,
         reading_stage='THIRD_READING_VOTED', status='Under Review', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [JSON.stringify(votingResults), sessionId, id]
  );
};

/** Record executive approval. */
exports.recordApproval = async (client, id, approvedBy, remarks) => {
  return client.query(
    `UPDATE resolutions
     SET approved_by=$1, approved_at=NOW(), approval_remarks=$2,
         reading_stage='APPROVED', status='Approved', approved_date=NOW(), updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [approvedBy, remarks || null, id]
  );
};

/** Record executive rejection. */
exports.recordRejection = async (client, id, approvedBy, reason) => {
  return client.query(
    `UPDATE resolutions
     SET approved_by=$1, approved_at=NOW(), rejection_reason=$2,
         reading_stage='REJECTED', status='Rejected', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [approvedBy, reason || null, id]
  );
};

/** Record public posting. */
exports.recordPosting = async (client, id, postingEndDate) => {
  return client.query(
    `UPDATE resolutions
     SET posted_at=NOW(), posting_end_date=$1,
         reading_stage='POSTED', status='Published', published_date=NOW(), updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [postingEndDate, id]
  );
};

/** Mark resolution as effective. */
exports.recordEffective = async (client, id, effectiveDate) => {
  return client.query(
    `UPDATE resolutions
     SET effective_date=$1, reading_stage='EFFECTIVE', status='Published', updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [effectiveDate, id]
  );
};

/** Insert a resolution_reading_sessions row. */
exports.insertReadingSession = async (client, resolutionId, sessionId, readingNumber, notes, presiding) => {
  return client.query(
    `INSERT INTO resolution_reading_sessions
       (resolution_id, session_id, reading_number, discussion_notes, presiding_officer, conducted_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [resolutionId, sessionId || null, readingNumber, notes || null, presiding || null]
  );
};

/** Insert a resolution_committee_reports row. */
exports.insertCommitteeReport = async (client, data) => {
  const { resolutionId, committeeId, submittedBy, recommendation, reportContent, meetingDate, meetingMinutes, attendees } = data;
  return client.query(
    `INSERT INTO resolution_committee_reports
       (resolution_id, committee_id, submitted_by, recommendation, report_content,
        meeting_date, meeting_minutes, attendees, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
    [resolutionId, committeeId || null, submittedBy, recommendation, reportContent || null,
     meetingDate || null, meetingMinutes || null, JSON.stringify(attendees || [])]
  );
};

/** Get the latest committee report for a resolution. */
exports.findCommitteeReport = async (id) => {
  return pool.query(
    `SELECT cr.*, u.name as submitted_by_name, c.name as committee_name
     FROM resolution_committee_reports cr
     LEFT JOIN users u ON u.id = cr.submitted_by
     LEFT JOIN committees c ON c.id = cr.committee_id
     WHERE cr.resolution_id=$1
     ORDER BY cr.submitted_at DESC LIMIT 1`,
    [id]
  );
};

/** Get all reading sessions for a resolution. */
exports.findReadingSessions = async (id) => {
  return pool.query(
    `SELECT rs.*, s.title as session_title, s.date as session_date, u.name as presiding_officer_name
     FROM resolution_reading_sessions rs
     LEFT JOIN sessions s ON s.id = rs.session_id
     LEFT JOIN users u ON u.id = rs.presiding_officer
     WHERE rs.resolution_id=$1
     ORDER BY rs.reading_number ASC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findWorkflow = async (id) => {
  return pool.query(
    'SELECT * FROM resolution_workflow WHERE resolution_id = $1 ORDER BY created_at DESC',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findHistory = async (id) => {
  return pool.query(
    `SELECT rw.id, rw.resolution_id, rw.action_type as action, rw.status,
            rw.performed_by_id, u.name as changed_by_name,
            rw.comment as notes, rw.created_at as changed_at
     FROM resolution_workflow rw
     LEFT JOIN users u ON u.id = rw.performed_by_id
     WHERE rw.resolution_id = $1
     ORDER BY rw.created_at DESC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findApprovals = async (id) => {
  return pool.query(
    `SELECT ra.id, ra.resolution_id, ra.approver_role, ra.approver_id,
            u.name as approver_name, ra.status, ra.approved_at, ra.notes
     FROM resolution_approvals ra
     LEFT JOIN users u ON u.id = ra.approver_id
     WHERE ra.resolution_id = $1
     ORDER BY ra.approver_role ASC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.insertWorkflowAction = async (client, resolutionId, actionType, status, performedById, comment) => {
  return client.query(
    `INSERT INTO resolution_workflow (resolution_id, action_type, status, performed_by_id, comment, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [resolutionId, actionType, status, performedById, comment || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteWorkflow = async (client, resolutionId) => {
  return client.query('DELETE FROM resolution_workflow WHERE resolution_id = $1', [resolutionId]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.createApproval = async (resolutionId, approverRole, approverId, notes) => {
  return pool.query(
    `INSERT INTO resolution_approvals (resolution_id, approver_role, approver_id, status, notes, created_at)
     VALUES ($1, $2, $3, 'Pending', $4, NOW())
     RETURNING *`,
    [resolutionId, approverRole, approverId, notes || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApproval = async (approvalId, resolutionId, status, notes) => {
  return pool.query(
    `UPDATE resolution_approvals
     SET status = $1, notes = $2, approved_at = NOW()
     WHERE id = $3 AND resolution_id = $4
     RETURNING *`,
    [status, notes || '', approvalId, resolutionId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApprovalByApprover = async (client, resolutionId, approverId, status, notes) => {
  return client.query(
    `UPDATE resolution_approvals
     SET status = $1, approved_at = NOW(), notes = $2
     WHERE resolution_id = $3 AND approver_id = $4`,
    [status, notes || '', resolutionId, approverId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteApprovals = async (client, resolutionId) => {
  return client.query('DELETE FROM resolution_approvals WHERE resolution_id = $1', [resolutionId]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setApprovedDate = async (client, id) => {
  return client.query('UPDATE resolutions SET approved_date = NOW() WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setPublishedDate = async (client, id) => {
  return client.query('UPDATE resolutions SET published_date = NOW() WHERE id = $1', [id]);
};

/** Get posting records for a resolution. */
exports.findPostingRecords = async (id) => {
  return pool.query(
    `SELECT pr.*, u.name as posted_by_name
     FROM resolution_posting_records pr
     LEFT JOIN users u ON u.id = pr.posted_by
     WHERE pr.resolution_id=$1
     ORDER BY pr.posted_at DESC`,
    [id]
  );
};

/** Insert a resolution_posting_records row. */
exports.insertPostingRecord = async (client, data) => {
  const { resolutionId, postedBy, postingDurationDays, postingLocation, effectiveDate, notes } = data;
  return client.query(
    `INSERT INTO resolution_posting_records
       (resolution_id, posted_by, posting_duration_days, posting_location, effective_date, notes, posted_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [resolutionId, postedBy, postingDurationDays || 3, postingLocation || null, effectiveDate || null, notes || null]
  );
};

/** Get all sessions a resolution is scheduled in. */
exports.findSessionsByResolution = async (resolutionId) => {
  return pool.query(
    `SELECT s.id, s.title, s.date
     FROM sessions s
     WHERE s.id IN (
       SELECT DISTINCT unnest(ARRAY[
         (SELECT session_id_first_reading FROM resolutions WHERE id=$1),
         (SELECT session_id_second_reading FROM resolutions WHERE id=$1),
         (SELECT session_id_third_reading FROM resolutions WHERE id=$1)
       ])
     ) AND s.id IS NOT NULL
     ORDER BY s.date ASC`,
    [resolutionId]
  );
};
