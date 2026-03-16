import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/OrdinanceWorkflow.css';

const STAGES = [
  { key: 'SUBMITTED',                  label: '1. Submitted',            icon: '📤', desc: 'Councilor submitted to Secretary' },
  { key: 'FIRST_READING',              label: '2. First Reading',        icon: '📖', desc: 'Read aloud in session for the first time' },
  { key: 'COMMITTEE_REVIEW',           label: '3. Committee Review',     icon: '🔍', desc: 'Referred to committee for deliberation' },
  { key: 'COMMITTEE_REPORT_SUBMITTED', label: '4. Committee Report',     icon: '📋', desc: 'Committee submitted its recommendation' },
  { key: 'SECOND_READING',             label: '5. Second Reading',       icon: '📖', desc: 'Deliberated in full session' },
  { key: 'THIRD_READING_VOTED',        label: '6. Third Reading / Vote', icon: '🗳️', desc: 'Final vote taken by full council' },
  { key: 'APPROVED',                   label: '7. Executive Approved',   icon: '✅', desc: 'Captain/Mayor approved the measure' },
  { key: 'POSTED',                     label: '8. Posted Publicly',      icon: '📢', desc: 'Posted for public information period' },
  { key: 'EFFECTIVE',                  label: '9. In Effect',            icon: '⚖️', desc: 'Ordinance is now in full effect' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const ROLE_ACTIONS = {
  Secretary: ['first-reading', 'assign-committee', 'second-reading', 'third-reading-vote', 'post-publicly', 'mark-effective'],
  Admin:     ['first-reading', 'assign-committee', 'second-reading', 'third-reading-vote', 'post-publicly', 'mark-effective', 'executive-approval', 'executive-rejection', 'committee-report'],
  Captain:   ['executive-approval', 'executive-rejection', 'committee-report'],
  Councilor: ['submit-to-secretary'],
};

function canDo(userRole, action) {
  return ROLE_ACTIONS[userRole]?.includes(action) ?? false;
}

function getAvailableActions(readingStage, userRole) {
  switch (readingStage) {
    case null:
    case undefined:
      return canDo(userRole, 'submit-to-secretary') ? ['submit-to-secretary'] : [];
    case 'SUBMITTED':
      return canDo(userRole, 'first-reading') ? ['first-reading'] : [];
    case 'FIRST_READING':
      return canDo(userRole, 'assign-committee') ? ['assign-committee'] : [];
    case 'COMMITTEE_REVIEW':
      return canDo(userRole, 'committee-report') ? ['committee-report'] : [];
    case 'COMMITTEE_REPORT_SUBMITTED':
      return canDo(userRole, 'second-reading') ? ['second-reading'] : [];
    case 'SECOND_READING':
      return canDo(userRole, 'third-reading-vote') ? ['third-reading-vote'] : [];
    case 'THIRD_READING_VOTED': {
      const acts = [];
      if (canDo(userRole, 'executive-approval')) acts.push('executive-approval');
      if (canDo(userRole, 'executive-rejection')) acts.push('executive-rejection');
      return acts;
    }
    case 'APPROVED':
      return canDo(userRole, 'post-publicly') ? ['post-publicly'] : [];
    case 'POSTED':
      return canDo(userRole, 'mark-effective') ? ['mark-effective'] : [];
    default:
      return [];
  }
}

const ACTION_LABELS = {
  'submit-to-secretary': { emoji: '📤', label: 'Submit to Secretary' },
  'first-reading':       { emoji: '📖', label: 'Record First Reading' },
  'assign-committee':    { emoji: '🔍', label: 'Assign to Committee' },
  'committee-report':    { emoji: '📋', label: 'Submit Committee Report' },
  'second-reading':      { emoji: '📖', label: 'Record Second Reading' },
  'third-reading-vote':  { emoji: '🗳️', label: 'Record Third Reading Vote' },
  'executive-approval':  { emoji: '✅', label: 'Executive Approval' },
  'executive-rejection': { emoji: '❌', label: 'Executive Rejection' },
  'post-publicly':       { emoji: '📢', label: 'Post Publicly' },
  'mark-effective':      { emoji: '⚖️', label: 'Mark as Effective' },
};

export default function OrdinanceWorkflow({ ordinanceId, ordinance, onStatusUpdate }) {
  const { user } = useAuth();

  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [form, setForm] = useState({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [wsRes, sessRes, commRes] = await Promise.all([
        api.get(`/ordinances/${ordinanceId}/workflow-status`),
        api.get('/sessions'),
        api.get('/committees'),
      ]);
      setWorkflowStatus(wsRes.data);
      setSessions(sessRes.data || []);
      setCommittees(commRes.data || []);
    } catch (err) {
      setError('Failed to load workflow data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [ordinanceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleActionClick = (action) => { setActiveAction(action); setForm({}); setError(''); };

  const handleSubmitAction = async () => {
    setSubmitting(true);
    setError('');
    try {
      let body = {};
      if (activeAction === 'submit-to-secretary') {
        body = { comment: form.comment };
      } else if (activeAction === 'first-reading' || activeAction === 'second-reading') {
        body = { session_id: form.session_id || null, discussion_notes: form.discussion_notes, presiding_officer: form.presiding_officer || null };
      } else if (activeAction === 'assign-committee') {
        if (!form.committee_id) { setError('Please select a committee.'); setSubmitting(false); return; }
        body = { committee_id: form.committee_id };
      } else if (activeAction === 'committee-report') {
        if (!form.recommendation) { setError('Please select a recommendation.'); setSubmitting(false); return; }
        body = { recommendation: form.recommendation, report_content: form.report_content, meeting_date: form.meeting_date || null, meeting_minutes: form.meeting_minutes };
      } else if (activeAction === 'third-reading-vote') {
        body = { session_id: form.session_id || null, yes_count: Number(form.yes_count) || 0, no_count: Number(form.no_count) || 0, abstain_count: Number(form.abstain_count) || 0, presiding_officer: form.presiding_officer || null };
      } else if (activeAction === 'executive-approval') {
        body = { approval_remarks: form.approval_remarks };
      } else if (activeAction === 'executive-rejection') {
        if (!form.rejection_reason) { setError('Rejection reason is required.'); setSubmitting(false); return; }
        body = { rejection_reason: form.rejection_reason };
      } else if (activeAction === 'post-publicly') {
        body = { posting_duration_days: Number(form.posting_duration_days) || 3, posting_location: form.posting_location, notes: form.notes };
      } else if (activeAction === 'mark-effective') {
        body = { effective_date: form.effective_date || null };
      }

      await api.post(`/ordinances/${ordinanceId}/${activeAction}`, body);
      setActiveAction(null);
      setForm({});
      await fetchData();
      onStatusUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="ordinance-workflow"><div className="loading">Loading legislative workflow...</div></div>;

  const ord = workflowStatus?.ordinance || ordinance;
  const readingStage = ord?.reading_stage;
  const isRejected = readingStage === 'REJECTED';
  const currentStageIndex = isRejected ? -1 : (STAGE_INDEX[readingStage] ?? -1);
  const availableActions = isRejected ? [] : getAvailableActions(readingStage, user?.role);
  const currentStageDef = STAGES.find(s => s.key === readingStage);

  return (
    <div className="ordinance-workflow">
      {error && (
        <div className="workflow-alert alert-error">
          <span>⚠️</span><div><strong>Error</strong><p>{error}</p></div>
        </div>
      )}

      {/* Stage Timeline */}
      <section className="workflow-section">
        <h3>📊 Legislative Workflow — Three Readings</h3>
        <div className="lw-timeline">
          {STAGES.map((stage, idx) => {
            const done = !isRejected && currentStageIndex >= idx;
            const current = !isRejected && currentStageIndex === idx;
            return (
              <div key={stage.key} className={["lw-step", done ? "done" : "", current ? "current" : ""].filter(Boolean).join(" ")}>
                <div className="lw-circle">{done && !current ? "✓" : stage.icon}</div>
                <div className="lw-label">
                  <span className="lw-stage-name">{stage.label}</span>
                  <span className="lw-stage-desc">{stage.desc}</span>
                </div>
                {idx < STAGES.length - 1 && <div className={["lw-connector", (done && !current) ? "done" : ""].filter(Boolean).join(" ")} />}
              </div>
            );
          })}
          {isRejected && (
            <div className="lw-step rejected">
              <div className="lw-circle">❌</div>
              <div className="lw-label">
                <span className="lw-stage-name">Rejected</span>
                <span className="lw-stage-desc">{ord?.rejection_reason || "Measure was rejected"}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Current Stage Card */}
      <section className="workflow-section">
        <h3>📍 Current Stage</h3>
        <div className={["lw-stage-card", isRejected ? "rejected" : ""].filter(Boolean).join(" ")}>
          <span className="lw-stage-card-icon">
            {isRejected ? "❌" : (currentStageDef?.icon ?? "✏️")}
          </span>
          <div>
            <strong>{isRejected ? "Rejected" : (currentStageDef?.label ?? "Draft")}</strong>
            <p>{isRejected ? (ord?.rejection_reason || "No reason provided") : (currentStageDef?.desc ?? "Ordinance is being prepared by the proposer")}</p>
          </div>
        </div>
      </section>

      {/* Reading Sessions */}
      {workflowStatus?.readings?.length > 0 && (
        <section className="workflow-section">
          <h3>📖 Reading Sessions</h3>
          <div className="lw-readings-list">
            {workflowStatus.readings.map((r, i) => (
              <div key={i} className="lw-reading-item">
                <span className="lw-reading-num">Reading {r.reading_number}</span>
                <span className="lw-reading-session">{r.session_title || "No linked session"}</span>
                {r.session_date && (
                  <span className="lw-reading-date">
                    {new Date(r.session_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                )}
                {r.discussion_notes && <p className="lw-reading-notes">{r.discussion_notes}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Committee Report */}
      {workflowStatus?.committeeReport && (
        <section className="workflow-section">
          <h3>📋 Committee Report</h3>
          <div className={["lw-committee-report", "rec-" + workflowStatus.committeeReport.recommendation?.toLowerCase()].filter(Boolean).join(" ")}>
            <div className="lw-cr-header">
              <strong>Recommendation: </strong>
              <span className={["lw-rec-badge", workflowStatus.committeeReport.recommendation?.toLowerCase()].filter(Boolean).join(" ")}>
                {workflowStatus.committeeReport.recommendation}
              </span>
            </div>
            <p><strong>Committee:</strong> {workflowStatus.committeeReport.committee_name || "N/A"}</p>
            <p><strong>Submitted by:</strong> {workflowStatus.committeeReport.submitted_by_name || "N/A"}</p>
            {workflowStatus.committeeReport.meeting_date && (
              <p><strong>Meeting date:</strong> {new Date(workflowStatus.committeeReport.meeting_date).toLocaleDateString()}</p>
            )}
            {workflowStatus.committeeReport.report_content && (
              <div className="lw-cr-content"><strong>Report:</strong><p>{workflowStatus.committeeReport.report_content}</p></div>
            )}
          </div>
        </section>
      )}

      {/* Voting Results */}
      {ord?.voting_results && (
        <section className="workflow-section">
          <h3>🗳️ Voting Results</h3>
          <div className={["lw-vote-results", ord.voting_results.passed ? "passed" : "failed"].join(" ")}>
            <span className="lw-vote-result-label">{ord.voting_results.passed ? "✅ Passed" : "❌ Failed"}</span>
            <div className="lw-vote-counts">
              <span className="lw-vote-yes">Yes: <strong>{ord.voting_results.yes_count}</strong></span>
              <span className="lw-vote-no">No: <strong>{ord.voting_results.no_count}</strong></span>
              <span className="lw-vote-abs">Abstain: <strong>{ord.voting_results.abstain_count}</strong></span>
            </div>
          </div>
        </section>
      )}

      {/* Posting Records */}
      {workflowStatus?.postingRecords?.length > 0 && (
        <section className="workflow-section">
          <h3>📢 Posting Records</h3>
          {workflowStatus.postingRecords.map((pr, i) => (
            <div key={i} className="lw-posting-record">
              <p><strong>Posted:</strong> {new Date(pr.posted_at).toLocaleDateString()}</p>
              <p><strong>Posting ends:</strong> {pr.posting_end_date || "N/A"}</p>
              {pr.effective_date && <p><strong>Effective date:</strong> {pr.effective_date}</p>}
              {pr.posting_location && <p><strong>Location:</strong> {pr.posting_location}</p>}
              {pr.notes && <p><strong>Notes:</strong> {pr.notes}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Available Actions */}
      {!isRejected && (
        <section className="workflow-section">
          <h3>⚙️ Available Actions</h3>
          {availableActions.length > 0 ? (
            <div className="lw-actions-grid">
              {availableActions.map(action => (
                <button key={action} className={"lw-action-btn lw-" + action} onClick={() => handleActionClick(action)}>
                  {ACTION_LABELS[action]?.emoji} {ACTION_LABELS[action]?.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="no-permissions">No actions available for your role at this stage.</p>
          )}
        </section>
      )}

      {/* Action History */}
      <section className="workflow-section">
        <h3>📝 Action History</h3>
        {workflowStatus?.history?.length > 0 ? (
          <div className="actions-timeline">
            {workflowStatus.history.map((h, i) => (
              <div key={i} className="action-item">
                <div className="action-marker" />
                <div className="action-content">
                  <div className="action-header">
                    <span className="action-type">{h.action}</span>
                    <span className="action-date">
                      {new Date(h.changed_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="action-performer">By: <strong>{h.changed_by_name || "System"}</strong></p>
                  {h.notes && <div className="action-comment"><strong>Notes:</strong><p>{h.notes}</p></div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No actions recorded yet</p>
        )}
      </section>

      {/* Action Modal */}
      {activeAction && (
        <div className="action-modal-overlay">
          <div className="action-modal">
            <h3>{ACTION_LABELS[activeAction]?.emoji} {ACTION_LABELS[activeAction]?.label}</h3>
            {error && <div className="workflow-alert alert-error" style={{ marginBottom: "1rem" }}><span>⚠️</span><p>{error}</p></div>}
            <div className="modal-form">

              {activeAction === "submit-to-secretary" && (
                <div className="form-group">
                  <label>Comment (optional)</label>
                  <textarea rows={3} value={form.comment || ""} onChange={e => setField("comment", e.target.value)} placeholder="Add any notes for the Secretary..." />
                </div>
              )}

              {(activeAction === "first-reading" || activeAction === "second-reading") && (
                <>
                  <div className="form-group">
                    <label>Session (optional)</label>
                    <select value={form.session_id || ""} onChange={e => setField("session_id", e.target.value)}>
                      <option value="">— Select session —</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.title} — {new Date(s.date).toLocaleDateString()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Discussion Notes</label>
                    <textarea rows={3} value={form.discussion_notes || ""} onChange={e => setField("discussion_notes", e.target.value)} placeholder="Summary of discussion during reading..." />
                  </div>
                </>
              )}

              {activeAction === "assign-committee" && (
                <div className="form-group">
                  <label>Committee <span className="required">*</span></label>
                  <select value={form.committee_id || ""} onChange={e => setField("committee_id", e.target.value)}>
                    <option value="">— Select committee —</option>
                    {committees.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {activeAction === "committee-report" && (
                <>
                  <div className="form-group">
                    <label>Recommendation <span className="required">*</span></label>
                    <select value={form.recommendation || ""} onChange={e => setField("recommendation", e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="APPROVE">APPROVE</option>
                      <option value="REVISION">REVISION (Return for changes)</option>
                      <option value="REJECTION">REJECTION</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Report Content</label>
                    <textarea rows={4} value={form.report_content || ""} onChange={e => setField("report_content", e.target.value)} placeholder="Full committee report..." />
                  </div>
                  <div className="form-group">
                    <label>Meeting Date</label>
                    <input type="date" value={form.meeting_date || ""} onChange={e => setField("meeting_date", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Meeting Minutes Summary</label>
                    <textarea rows={3} value={form.meeting_minutes || ""} onChange={e => setField("meeting_minutes", e.target.value)} placeholder="Brief summary of committee meeting..." />
                  </div>
                </>
              )}

              {activeAction === "third-reading-vote" && (
                <>
                  <div className="form-group">
                    <label>Session (optional)</label>
                    <select value={form.session_id || ""} onChange={e => setField("session_id", e.target.value)}>
                      <option value="">— Select session —</option>
                      {sessions.map(s => (
                        <option key={s.id} value={s.id}>{s.title} — {new Date(s.date).toLocaleDateString()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="lw-vote-inputs">
                    <div className="form-group">
                      <label>Yes votes</label>
                      <input type="number" min="0" value={form.yes_count || 0} onChange={e => setField("yes_count", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>No votes</label>
                      <input type="number" min="0" value={form.no_count || 0} onChange={e => setField("no_count", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Abstain</label>
                      <input type="number" min="0" value={form.abstain_count || 0} onChange={e => setField("abstain_count", e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              {activeAction === "executive-approval" && (
                <div className="form-group">
                  <label>Remarks (optional)</label>
                  <textarea rows={3} value={form.approval_remarks || ""} onChange={e => setField("approval_remarks", e.target.value)} placeholder="Executive approval remarks..." />
                </div>
              )}

              {activeAction === "executive-rejection" && (
                <div className="form-group">
                  <label>Reason for Rejection <span className="required">*</span></label>
                  <textarea rows={3} value={form.rejection_reason || ""} onChange={e => setField("rejection_reason", e.target.value)} placeholder="State the reason for rejection..." />
                </div>
              )}

              {activeAction === "post-publicly" && (
                <>
                  <div className="form-group">
                    <label>Posting Duration (days)</label>
                    <input type="number" min="1" value={form.posting_duration_days || 3} onChange={e => setField("posting_duration_days", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Posting Location</label>
                    <input type="text" value={form.posting_location || ""} onChange={e => setField("posting_location", e.target.value)} placeholder="e.g. Barangay Bulletin Board, Municipal Hall" />
                  </div>
                  <div className="form-group">
                    <label>Notes (optional)</label>
                    <textarea rows={2} value={form.notes || ""} onChange={e => setField("notes", e.target.value)} />
                  </div>
                </>
              )}

              {activeAction === "mark-effective" && (
                <div className="form-group">
                  <label>Effective Date</label>
                  <input type="date" value={form.effective_date || ""} onChange={e => setField("effective_date", e.target.value)} />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => { setActiveAction(null); setError(""); }}>Cancel</button>
              <button className="btn-confirm" onClick={handleSubmitAction} disabled={submitting}>
                {submitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
