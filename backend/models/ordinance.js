/**
 * Ordinance Model - Data access layer for ordinance operations.
 */
const pool = require('../db');

/** @returns {Promise<import('pg').QueryResult>} */
exports.findAll = async (proposerId) => {
  let query = 'SELECT * FROM ordinances';
  const params = [];
  if (proposerId) {
    query += ' WHERE proposer_id = $1';
    params.push(proposerId);
  }
  query += ' ORDER BY created_at DESC';
  return pool.query(query, params);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findById = async (id) => {
  return pool.query('SELECT * FROM ordinances WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.create = async (title, ordinanceNumber, description, content, remarks, proposerId, proposerName, status = 'Draft') => {
  const normalizedStatus = {
    draft: 'Draft',
    pending: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    enacted: 'Published',
  }[status] || status;

  return pool.query(
    `INSERT INTO ordinances (
       title, ordinance_number, description, content, remarks,
       proposer_id, proposer_name, status, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING *`,
    [title, ordinanceNumber, description, content, remarks, proposerId, proposerName, normalizedStatus]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.update = async (id, title, ordinanceNumber, description, content, remarks) => {
  return pool.query(
    `UPDATE ordinances
     SET title = COALESCE($1, title),
         ordinance_number = COALESCE($2, ordinance_number),
         description = COALESCE($3, description),
         content = COALESCE($4, content),
         remarks = COALESCE($5, remarks),
         updated_at = NOW()
     WHERE id = $6 RETURNING *`,
    [title, ordinanceNumber, description, content, remarks, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteById = async (client, id) => {
  return client.query('DELETE FROM ordinances WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateStatus = async (client, id, status) => {
  return client.query(
    'UPDATE ordinances SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setApprovedDate = async (client, id) => {
  return client.query('UPDATE ordinances SET approved_date = NOW() WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.setPublishedDate = async (client, id) => {
  return client.query('UPDATE ordinances SET published_date = NOW() WHERE id = $1', [id]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findWorkflow = async (id) => {
  return pool.query(
    'SELECT * FROM ordinance_workflow WHERE ordinance_id = $1 ORDER BY created_at DESC',
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findHistory = async (id) => {
  return pool.query(
    `SELECT ow.id, ow.ordinance_id, ow.action_type as action, ow.status,
            ow.performed_by_id, u.name as changed_by_name,
            ow.comment as notes, ow.created_at as changed_at
     FROM ordinance_workflow ow
     LEFT JOIN users u ON u.id = ow.performed_by_id
     WHERE ow.ordinance_id = $1
     ORDER BY ow.created_at DESC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.findApprovals = async (id) => {
  return pool.query(
    `SELECT oa.id, oa.ordinance_id, oa.approver_role, oa.approver_id,
            u.name as approver_name, oa.status, oa.approved_at, oa.notes
     FROM ordinance_approvals oa
     LEFT JOIN users u ON u.id = oa.approver_id
     WHERE oa.ordinance_id = $1
     ORDER BY oa.approver_role ASC`,
    [id]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.insertWorkflowAction = async (client, ordinanceId, actionType, status, performedById, comment) => {
  return client.query(
    `INSERT INTO ordinance_workflow (ordinance_id, action_type, status, performed_by_id, comment, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
    [ordinanceId, actionType, status, performedById, comment || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteWorkflow = async (client, ordinanceId) => {
  return client.query('DELETE FROM ordinance_workflow WHERE ordinance_id = $1', [ordinanceId]);
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.createApproval = async (ordinanceId, approverRole, approverId, notes) => {
  return pool.query(
    `INSERT INTO ordinance_approvals (ordinance_id, approver_role, approver_id, status, notes, created_at)
     VALUES ($1, $2, $3, 'Pending', $4, NOW())
     RETURNING *`,
    [ordinanceId, approverRole, approverId, notes || '']
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApproval = async (approvalId, ordinanceId, status, notes) => {
  return pool.query(
    `UPDATE ordinance_approvals
     SET status = $1, notes = $2, approved_at = NOW()
     WHERE id = $3 AND ordinance_id = $4
     RETURNING *`,
    [status, notes || '', approvalId, ordinanceId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.updateApprovalByApprover = async (client, ordinanceId, approverId, status, notes) => {
  return client.query(
    `UPDATE ordinance_approvals
     SET status = $1, approved_at = NOW(), notes = $2
     WHERE ordinance_id = $3 AND approver_id = $4`,
    [status, notes || '', ordinanceId, approverId]
  );
};

/** @returns {Promise<import('pg').QueryResult>} */
exports.deleteApprovals = async (client, ordinanceId) => {
  return client.query('DELETE FROM ordinance_approvals WHERE ordinance_id = $1', [ordinanceId]);
};

// ─── Legislative Workflow helpers ────────────────────────────────────────────

/** Set reading_stage (and optionally status) on an ordinance. */
exports.setReadingStage = async (client, id, readingStage, status) => {
  const q = status
    ? 'UPDATE ordinances SET reading_stage=$1, status=$2, updated_at=NOW() WHERE id=$3 RETURNING *'
    : 'UPDATE ordinances SET reading_stage=$1, updated_at=NOW() WHERE id=$2 RETURNING *';
  const params = status ? [readingStage, status, id] : [readingStage, id];
  return client.query(q, params);
};

/** Update committee assignment fields on an ordinance. */
exports.assignCommittee = async (client, id, committeeId, assignedBy) => {
  return client.query(
    `UPDATE ordinances
     SET committee_id=$1, committee_assignment_date=NOW(), assigned_by=$2,
         reading_stage='COMMITTEE_REVIEW', status='Under Review', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [committeeId, assignedBy, id]
  );
};

/** Record voting results on an ordinance. */
exports.recordVote = async (client, id, votingResults, sessionId) => {
  return client.query(
    `UPDATE ordinances
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
    `UPDATE ordinances
     SET approved_by=$1, approved_at=NOW(), approval_remarks=$2,
         reading_stage='APPROVED', status='Approved', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [approvedBy, remarks || null, id]
  );
};

/** Record executive rejection. */
exports.recordRejection = async (client, id, approvedBy, reason) => {
  return client.query(
    `UPDATE ordinances
     SET approved_by=$1, approved_at=NOW(), rejection_reason=$2,
         reading_stage='REJECTED', status='Rejected', updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [approvedBy, reason || null, id]
  );
};

/** Record public posting. */
exports.recordPosting = async (client, id, postingEndDate) => {
  return client.query(
    `UPDATE ordinances
     SET posted_at=NOW(), posting_end_date=$1,
         reading_stage='POSTED', status='Published', updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [postingEndDate, id]
  );
};

/** Mark ordinance as effective. */
exports.recordEffective = async (client, id, effectiveDate) => {
  return client.query(
    `UPDATE ordinances
     SET effective_date=$1, reading_stage='EFFECTIVE', status='Published', updated_at=NOW()
     WHERE id=$2 RETURNING *`,
    [effectiveDate, id]
  );
};

/** Insert a reading_sessions row. */
exports.insertReadingSession = async (client, ordinanceId, sessionId, readingNumber, notes, presiding) => {
  return client.query(
    `INSERT INTO reading_sessions
       (ordinance_id, session_id, reading_number, discussion_notes, presiding_officer, conducted_at)
     VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
    [ordinanceId, sessionId || null, readingNumber, notes || null, presiding || null]
  );
};

/** Insert a committee_reports row. */
exports.insertCommitteeReport = async (client, data) => {
  const { ordinanceId, committeeId, submittedBy, recommendation, reportContent, meetingDate, meetingMinutes, attendees } = data;
  return client.query(
    `INSERT INTO committee_reports
       (ordinance_id, committee_id, submitted_by, recommendation, report_content,
        meeting_date, meeting_minutes, attendees, submitted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) RETURNING *`,
    [ordinanceId, committeeId || null, submittedBy, recommendation, reportContent || null,
     meetingDate || null, meetingMinutes || null, JSON.stringify(attendees || [])]
  );
};

/** Get the latest committee report for an ordinance. */
exports.findCommitteeReport = async (id) => {
  return pool.query(
    `SELECT cr.*, u.name as submitted_by_name, c.name as committee_name
     FROM committee_reports cr
     LEFT JOIN users u ON u.id = cr.submitted_by
     LEFT JOIN committees c ON c.id = cr.committee_id
     WHERE cr.ordinance_id=$1
     ORDER BY cr.submitted_at DESC LIMIT 1`,
    [id]
  );
};

/** Get all reading sessions for an ordinance. */
exports.findReadingSessions = async (id) => {
  return pool.query(
    `SELECT rs.*, s.title as session_title, s.date as session_date, u.name as presiding_officer_name
     FROM reading_sessions rs
     LEFT JOIN sessions s ON s.id = rs.session_id
     LEFT JOIN users u ON u.id = rs.presiding_officer
     WHERE rs.ordinance_id=$1
     ORDER BY rs.reading_number ASC`,
    [id]
  );
};

/** Insert or update a session_agenda_items row. */
exports.upsertAgendaItem = async (sessionId, ordinanceId, agendaOrder, readingNumber) => {
  return pool.query(
    `INSERT INTO session_agenda_items (session_id, ordinance_id, agenda_order, reading_number, created_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (session_id, ordinance_id) DO UPDATE
       SET agenda_order=$3, reading_number=$4
     RETURNING *`,
    [sessionId, ordinanceId, agendaOrder || 1, readingNumber || null]
  );
};

/** Get all agenda items for a session (with ordinance details). */
exports.findAgendaBySession = async (sessionId) => {
  return pool.query(
    `SELECT ai.*, o.title, o.ordinance_number, o.reading_stage, o.status,
            o.proposer_name, o.description
     FROM session_agenda_items ai
     LEFT JOIN ordinances o ON o.id = ai.ordinance_id
     WHERE ai.session_id=$1
     ORDER BY ai.agenda_order ASC`,
    [sessionId]
  );
};

/** Remove an ordinance from a session agenda. */
exports.removeAgendaItem = async (sessionId, ordinanceId) => {
  return pool.query(
    'DELETE FROM session_agenda_items WHERE session_id=$1 AND ordinance_id=$2 RETURNING *',
    [sessionId, ordinanceId]
  );
};

/** Get all sessions an ordinance is assigned to (via agenda items). */
exports.findSessionsByOrdinance = async (ordinanceId) => {
  return pool.query(
    `SELECT s.id, s.title, s.date, ai.agenda_order, ai.reading_number
     FROM session_agenda_items ai
     JOIN sessions s ON s.id = ai.session_id
     WHERE ai.ordinance_id=$1
     ORDER BY s.date ASC`,
    [ordinanceId]
  );
};

/** Get posting records for an ordinance. */
exports.findPostingRecords = async (id) => {
  return pool.query(
    `SELECT pr.*, u.name as posted_by_name
     FROM posting_records pr
     LEFT JOIN users u ON u.id = pr.posted_by
     WHERE pr.ordinance_id=$1
     ORDER BY pr.posted_at DESC`,
    [id]
  );
};

/** Insert a posting_records row. */
exports.insertPostingRecord = async (client, data) => {
  const { ordinanceId, postedBy, postingDurationDays, postingLocation, effectiveDate, notes } = data;
  return client.query(
    `INSERT INTO posting_records
       (ordinance_id, posted_by, posting_duration_days, posting_location, effective_date, notes, posted_at)
     VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
    [ordinanceId, postedBy, postingDurationDays || 3, postingLocation || null, effectiveDate || null, notes || null]
  );
};
