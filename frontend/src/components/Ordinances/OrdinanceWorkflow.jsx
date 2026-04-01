import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/OrdinanceWorkflow.css';

const STAGES = [
  { key: 'DRAFT', label: '0. Draft', icon: '✏️', desc: 'Councilor is preparing the proposed measure' },
  { key: 'SUBMITTED', label: '1. Submitted', icon: '📤', desc: 'Councilor submitted to Vice Mayor' },
  { key: 'COMMITTEE_REVIEW', label: '2. Committee Review', icon: '🔍', desc: 'Referred to committee for deliberation' },
  { key: 'COMMITTEE_REPORT_SUBMITTED', label: '3. Committee Report', icon: '📋', desc: 'Committee submitted its recommendation' },
  { key: 'FIRST_READING', label: '4. First Reading', icon: '📖', desc: 'Read aloud in session for the first time' },
  { key: 'SECOND_READING', label: '5. Second Reading', icon: '📖', desc: 'Deliberated in full session' },
  { key: 'THIRD_READING_VOTED', label: '6. Third Reading / Vote', icon: '🗳️', desc: 'Final vote taken by full council' },
  { key: 'APPROVED', label: '7. Executive Approved', icon: '✅', desc: 'Vice Mayor/Mayor approved the measure' },
  { key: 'POSTED', label: '8. Posted Publicly', icon: '📢', desc: 'Posted for public information period' },
  { key: 'EFFECTIVE', label: '9. In Effect', icon: '⚖️', desc: 'Ordinance is now in full effect' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const ROLE_ACTIONS = {
  Secretary: ['first-reading', 'second-reading', 'third-reading-vote', 'post-publicly', 'mark-effective'],
  Admin:     ['assign-committee', 'first-reading', 'second-reading', 'third-reading-vote', 'post-publicly', 'mark-effective', 'executive-approval', 'executive-rejection', 'committee-report'],
  'Vice Mayor':   ['assign-committee'],
  Councilor: ['submit-to-vice-mayor', 'create-meeting', 'committee-report'],
  'Committee Secretary': ['create-meeting'],
};

function canDo(userRole, action) {
  return ROLE_ACTIONS[userRole]?.includes(action) ?? false;
}

function getAvailableActions(readingStage, userRole, ord, user) {
  // Committee meeting creation: allow if user is chair or secretary of assigned committee during review
  if (readingStage === 'COMMITTEE_REVIEW') {
    const isChair = ord?.committee && ord.committee.chair_id === user?.id;
    const isSecretary = ord?.committee && ord.committee.members?.some(m => m.user_id === user?.id && m.role === 'Committee Secretary');
    const actions = [];
    if (isChair || isSecretary) actions.push('create-meeting');
    if (canDo(userRole, 'committee-report')) actions.push('committee-report');
    return actions;
  }
  switch (readingStage) {
    case null:
    case undefined:
    case 'DRAFT':
      return canDo(userRole, 'submit-to-vice-mayor') ? ['submit-to-vice-mayor'] : [];
    case 'SUBMITTED':
      return canDo(userRole, 'assign-committee') ? ['assign-committee'] : [];
    case 'COMMITTEE_REPORT_SUBMITTED': {
      // Allow chair and admin to create committee report
      const isChair = ord?.committee && ord.committee.chair_id === user?.id;
      const isAdmin = userRole && userRole.toLowerCase() === 'admin';
      const actions = [];
      if (isChair || isAdmin) actions.push('committee-report');
      if (canDo(userRole, 'first-reading')) actions.push('first-reading');
      return actions;
    }
    case 'FIRST_READING':
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
  'submit-to-vice-mayor': { emoji: '📤', label: 'Submit to Vice Mayor' },
  'first-reading':       { emoji: '📖', label: 'Record First Reading' },
  'assign-committee':    { emoji: '🔍', label: 'Assign to Committee' },
  'committee-report':    { emoji: '📋', label: 'Submit Committee Report' },
  'second-reading':      { emoji: '📖', label: 'Record Second Reading' },
  'third-reading-vote':  { emoji: '🗳️', label: 'Record Third Reading Vote' },
  'executive-approval':  { emoji: '✅', label: 'Executive Approval' },
  'executive-rejection': { emoji: '❌', label: 'Executive Rejection' },
  'post-publicly':       { emoji: '📢', label: 'Post Publicly' },
  'mark-effective':      { emoji: '⚖️', label: 'Mark as Effective' },
  'create-meeting':      { emoji: '📅', label: 'Create Meeting' },
};

export default function OrdinanceWorkflow({ ordinanceId, ordinance, onStatusUpdate, onMeetingCreated }) {
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
      if (activeAction === 'submit-to-vice-mayor') {
        body = { comment: form.comment };
      } else if (activeAction === 'first-reading' || activeAction === 'second-reading') {
        body = { session_id: form.session_id || null, discussion_notes: form.discussion_notes, presiding_officer: form.presiding_officer || null };
      } else if (activeAction === 'assign-committee') {
        if (!form.committee_id) { setError('Please select a committee.'); setSubmitting(false); return; }
        body = { committee_id: form.committee_id };
      } else if (activeAction === 'committee-report') {
        if (!form.recommendation) { setError('Please select a recommendation.'); setSubmitting(false); return; }
        const committeeId = ord?.committee_id;
        if (!committeeId) {
          setError('Committee not assigned yet.');
          setSubmitting(false);
          return;
        }
        // Extract from ended committee meeting if available
        let meeting_date = form.meeting_date || null;
        let meeting_minutes = form.meeting_minutes || '';
        let attendees = [];
        if (Array.isArray(form.attendees)) {
          attendees = form.attendees;
        } else if (typeof form.attendees === 'string') {
          attendees = form.attendees.split(',').map(a => a.trim()).filter(Boolean);
        }

        // Try to extract from ended committee meeting
        if (window.committeeMeetings && Array.isArray(window.committeeMeetings)) {
          const endedMeeting = window.committeeMeetings.find(m => m.ordinance_id === ordinanceId && m.ended);
          if (endedMeeting) {
            meeting_date = endedMeeting.meeting_date || meeting_date;
            meeting_minutes = endedMeeting.meeting_minutes || meeting_minutes;
            if (endedMeeting.attendees) {
              if (Array.isArray(endedMeeting.attendees)) {
                attendees = endedMeeting.attendees;
              } else if (typeof endedMeeting.attendees === 'string') {
                attendees = endedMeeting.attendees.split(',').map(a => a.trim()).filter(Boolean);
              }
            }
          }
        }

        body = {
          committee_id: committeeId,
          recommendation: form.recommendation,
          report_content: form.report_content,
          meeting_date,
          meeting_minutes,
          attendees
        };

        await api.post(`/ordinances/${ordinanceId}/committee-report`, body);
        
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
      } else if (activeAction === 'create-meeting') {
        const committeeId = ord?.committee_id;

        if (!committeeId) {
          setError('Committee not assigned yet.');
          setSubmitting(false);
          return;
        }

        if (!form.meeting_title || !form.meeting_date) {
          setError('Meeting title and date are required.');
          setSubmitting(false);
          return;
        }

        await api.post(`/committees/${committeeId}/meetings`, {
          title: form.meeting_title,
          meeting_date: form.meeting_date,
          meeting_time: form.meeting_time || '',
          ordinance_id: ordinanceId,
        });
        if (onMeetingCreated) onMeetingCreated();
      } else {
        await api.post(`/ordinances/${ordinanceId}/${activeAction}`, body);
      }
      setActiveAction(null);
      setForm({});
      await fetchData();
      onStatusUpdate?.();
    } catch (err) {
      let errorMsg = 'Action failed.';
      if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
      // Show error in alert for extra visibility
      alert(errorMsg);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="ordinance-workflow"><div className="loading">Loading legislative workflow...</div></div>;

  // --- Committee Report Form Fields ---
  // Add attendees input if committee-report is active
  const renderCommitteeReportFields = () => (
    <>
      <div className="form-group">
        <label>Recommendation<span style={{color:'red'}}>*</span></label>
        <select value={form.recommendation || ''} onChange={e => setField('recommendation', e.target.value)} required>
          <option value="">Select...</option>
          <option value="APPROVE">Approve</option>
          <option value="REVISION">For Revision / Further Study</option>
          <option value="REJECTION">Reject</option>
        </select>
      </div>
      <div className="form-group">
        <label>Report Content</label>
        <textarea value={form.report_content || ''} onChange={e => setField('report_content', e.target.value)} rows={3} />
      </div>
      <div className="form-group">
        <label>Meeting Date</label>
        <input type="date" value={form.meeting_date || ''} onChange={e => setField('meeting_date', e.target.value)} />
      </div>
      <div className="form-group">
        <label>Meeting Minutes</label>
        <textarea value={form.meeting_minutes || ''} onChange={e => setField('meeting_minutes', e.target.value)} rows={2} />
      </div>
      <div className="form-group">
        <label>Attendees (comma-separated)</label>
        <input type="text" value={form.attendees || ''} onChange={e => setField('attendees', e.target.value)} placeholder="e.g. John Doe, Jane Smith" />
      </div>
    </>
  );

  const ord = workflowStatus?.ordinance || ordinance;
  const readingStage = ord?.reading_stage;
  const isRejected = readingStage === 'REJECTED';
  // Debug logs for chair/committee action visibility
  // console.log('User:', user);
  // console.log('Ordinance committee:', ord?.committee);
  // console.log('Chair ID:', ord?.committee?.chair_id, 'User ID:', user?.id);
  // console.log('Ordinance reading_stage:', readingStage);
  // Case-insensitive stage matching (handle null/undefined)
  const normalizedStage = readingStage ? String(readingStage).trim().toUpperCase() : undefined;
  const currentStageIndex = isRejected ? -1 : (STAGES.findIndex(s => s.key === normalizedStage));
  const availableActions = isRejected ? [] : getAvailableActions(normalizedStage, user?.role, ord, user);
        
  const currentStageDef = STAGES.find(s => s.key === normalizedStage);

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
      

      {/* Assign Committee Modal (custom for assign-committee action) */}
      <section className="workflow-section">
        {activeAction === 'assign-committee' && (
          <div className="status-modal-overlay">
            <div className="status-modal">
              <h3>Assign Committee</h3>
              <p>Select a committee to assign to this ordinance.</p>
              <div className="form-group">
                <label>Committee <span className="required">*</span></label>
                <select value={form.committee_id || ''} onChange={e => setField('committee_id', e.target.value)} disabled={submitting}>
                  <option value="">Select Committee</option>
                  {committees.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button onClick={handleSubmitAction} className="btn btn-primary" disabled={submitting}>Assign Committee</button>
                <button onClick={() => setActiveAction(null)} className="btn btn-secondary" disabled={submitting}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Current Stage Card */}
      <section className="workflow-section">
        <h3>📍 Current Stage</h3>
        <div className={["lw-stage-card", isRejected ? "rejected" : ""].filter(Boolean).join(" ")}>
          <span className="lw-stage-card-icon">
            {isRejected ? "❌" : (currentStageDef?.icon ?? (readingStage ? "❓" : "✏️"))}
          </span>
          <div>
            <strong>{isRejected ? "Rejected" : (currentStageDef?.label ?? (readingStage || "Unknown"))}</strong>
            <p>{isRejected
              ? (ord?.rejection_reason || "No reason provided")
              : (currentStageDef?.desc ?? `Current stage: ${readingStage || "Unknown"}`)
            }</p>
            {/* Debug: Show actual readingStage value */}
            {import.meta.env.MODE === 'development' && (
              <div style={{ fontSize: '0.85em', color: '#888', marginTop: 4 }}>
                <em>Stage key: {String(readingStage)}</em>
              </div>
            )}
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
                {workflowStatus.committeeReport.recommendation || "N/A"}
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
          {availableActions.includes('assign-committee') && (
            <button
              className="lw-action-btn lw-assign-committee"
              onClick={() => handleActionClick('assign-committee')}
              disabled={!!ord?.committee_id}
            >
              {ACTION_LABELS['assign-committee']?.emoji} {ACTION_LABELS['assign-committee']?.label}
            </button>
          )}
          {availableActions.includes('create-meeting') && (
            <button
              className="lw-action-btn lw-create-meeting"
              onClick={() => handleActionClick('create-meeting')}
            >
              {ACTION_LABELS['create-meeting']?.emoji} {ACTION_LABELS['create-meeting']?.label}
            </button>
          )}
          {availableActions.includes('committee-report') && (
            <button
              className="lw-action-btn lw-committee-report"
              onClick={() => handleActionClick('committee-report')}
            >
              {ACTION_LABELS['committee-report']?.emoji} {ACTION_LABELS['committee-report']?.label}
            </button>
          )}
          {availableActions.includes('first-reading') && (
            <button
              className="lw-action-btn lw-first-reading"
              onClick={() => handleActionClick('first-reading')}
            >
              {ACTION_LABELS['first-reading']?.emoji} {ACTION_LABELS['first-reading']?.label}
            </button>
          )}
          {availableActions.includes('second-reading') && (
            <button
              className="lw-action-btn lw-second-reading"
              onClick={() => handleActionClick('second-reading')}
            >
              {ACTION_LABELS['second-reading']?.emoji} {ACTION_LABELS['second-reading']?.label}
            </button>
          )}
          {availableActions.includes('third-reading-vote') && (
            <button
              className="lw-action-btn lw-third-reading-vote"
              onClick={() => handleActionClick('third-reading-vote')}
            >
              {ACTION_LABELS['third-reading-vote']?.emoji} {ACTION_LABELS['third-reading-vote']?.label}
            </button>
          )}
          {availableActions.includes('executive-approval') && (
            <button
              className="lw-action-btn lw-executive-approval"
              onClick={() => handleActionClick('executive-approval')}
            >
              {ACTION_LABELS['executive-approval']?.emoji} {ACTION_LABELS['executive-approval']?.label}
            </button>
          )}
          {availableActions.includes('executive-rejection') && (
            <button
              className="lw-action-btn lw-executive-rejection"
              onClick={() => handleActionClick('executive-rejection')}
            >
              {ACTION_LABELS['executive-rejection']?.emoji} {ACTION_LABELS['executive-rejection']?.label}
            </button>
          )}
          {availableActions.includes('post-publicly') && (
            <button
              className="lw-action-btn lw-post-publicly"
              onClick={() => handleActionClick('post-publicly')}
            >
              {ACTION_LABELS['post-publicly']?.emoji} {ACTION_LABELS['post-publicly']?.label}
            </button>
          )}
          {availableActions.includes('mark-effective') && (
            <button
              className="lw-action-btn lw-mark-effective"
              onClick={() => handleActionClick('mark-effective')}
            >
              {ACTION_LABELS['mark-effective']?.emoji} {ACTION_LABELS['mark-effective']?.label}
            </button>
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

      {/* Create Meeting Modal (for committee chair/secretary) */}
        {activeAction === 'create-meeting' && (
          <div className="status-modal-overlay">
            <div className="status-modal">
              <h3>Schedule Committee Meeting</h3>
              <div className="form-group">
                <label>Meeting Title <span className="required">*</span></label>
                <input type="text" value={form.meeting_title || ''} onChange={e => setField('meeting_title', e.target.value)} disabled={submitting} placeholder="e.g. Committee Deliberation on Proposed Measure" required />
              </div>
              <div className="form-group">
                <label>Meeting Date <span className="required">*</span></label>
                <input type="date" value={form.meeting_date || ''} onChange={e => setField('meeting_date', e.target.value)} disabled={submitting} required />
              </div>
              <div className="form-group">
                <label>Meeting Time</label>
                <input type="time" value={form.meeting_time || ''} onChange={e => setField('meeting_time', e.target.value)} disabled={submitting} />
              </div>
              <div className="modal-actions">
                <button onClick={handleSubmitAction} className="btn btn-primary" disabled={submitting}>Create Meeting</button>
                <button onClick={() => setActiveAction(null)} className="btn btn-secondary" disabled={submitting}>Cancel</button>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
            </div>
          </div>
        )}

      {/* Action Modal */}
      {activeAction && activeAction !== 'create-meeting' && (
        <div className="action-modal-overlay">
          <div className="action-modal">
            <h3>{ACTION_LABELS[activeAction]?.emoji} {ACTION_LABELS[activeAction]?.label}</h3>
            {error && <div className="workflow-alert alert-error" style={{ marginBottom: "1rem" }}><span>⚠️</span><p>{error}</p></div>}
            <div className="modal-form">

              {activeAction === "submit-to-vice-mayor" && (
                <div className="form-group">
                  <label>Comment (optional)</label>
                  <textarea rows={3} value={form.comment || ""} onChange={e => setField("comment", e.target.value)} placeholder="Add any notes for the Vice Mayor..." />
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

              {activeAction === "committee-report" && renderCommitteeReportFields()}

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
