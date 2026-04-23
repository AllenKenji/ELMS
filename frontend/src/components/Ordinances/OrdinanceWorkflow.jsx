import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import LocalMeetingRecorder from '../common/LocalMeetingRecorder';
import '../../styles/OrdinanceWorkflow.css';

function getLatestEndedMeeting(meetings, ordinanceId) {
  return meetings.find((meeting) => meeting.ordinance_id === ordinanceId && meeting.ended);
}

function normalizeAttendeesInput(attendeesValue) {
  if (Array.isArray(attendeesValue)) {
    return attendeesValue.join(', ');
  }

  return String(attendeesValue || '').trim();
}

const STAGES = [
  { key: 'DRAFT', label: '0. Draft', icon: '✏️', desc: 'Councilor is preparing the proposed measure' },
  { key: 'SUBMITTED', label: '1. Submitted', icon: '📤', desc: 'Councilor submitted to Secretary' },
  { key: 'FIRST_READING', label: '2. First Reading', icon: '📖', desc: 'Read by title in session; referred to committee' },
  { key: 'COMMITTEE_REVIEW', label: '3. Committee Review', icon: '🔍', desc: 'Committee deliberates and studies the measure' },
  { key: 'COMMITTEE_REPORT_SUBMITTED', label: '4. Committee Report', icon: '📋', desc: 'Committee submitted its recommendation' },
  { key: 'SECOND_READING', label: '5. Second Reading', icon: '📖', desc: 'Full reading, debate, and amendments in session' },
  { key: 'THIRD_READING_VOTING', label: '6. Voting Open', icon: '🗳️', desc: 'Electronic voting is in progress' },
  { key: 'THIRD_READING_VOTED', label: '7. Third Reading / Vote', icon: '✅', desc: 'Final vote taken by full council' },
  { key: 'APPROVED', label: '8. Executive Approved', icon: '🏛️', desc: 'Mayor/Vice Mayor approved the measure' },
  { key: 'POSTED', label: '9. Posted Publicly', icon: '📢', desc: 'Posted for public information period' },
  { key: 'EFFECTIVE', label: '10. In Effect', icon: '⚖️', desc: 'Ordinance is now in full effect' },
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const ROLE_ACTIONS = {
  Secretary: ['first-reading', 'second-reading', 'open-voting', 'close-voting', 'post-publicly', 'mark-effective'],
  Admin:     ['assign-committee', 'first-reading', 'second-reading', 'open-voting', 'close-voting', 'post-publicly', 'mark-effective', 'executive-approval', 'executive-rejection', 'committee-report'],
  'Vice Mayor':   ['assign-committee', 'executive-approval', 'executive-rejection'],
  Councilor: ['submit-to-vice-mayor', 'create-meeting', 'committee-report', 'cast-vote'],
  'Committee Secretary': ['create-meeting', 'committee-report'],
};

function canDo(userRole, action) {
  return ROLE_ACTIONS[userRole]?.includes(action) ?? false;
}

function getAvailableActions(readingStage, userRole, ord, user, workflowStatus) {
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
      return canDo(userRole, 'first-reading') ? ['first-reading'] : [];
    case 'FIRST_READING':
      return canDo(userRole, 'assign-committee') ? ['assign-committee'] : [];
    case 'COMMITTEE_REPORT_SUBMITTED': {
      const acts = [];
      if (canDo(userRole, 'committee-report')) acts.push('committee-report');
      if (workflowStatus?.committeeReport && canDo(userRole, 'second-reading')) acts.push('second-reading');
      return acts;
    }
    case 'SECOND_READING':
      return canDo(userRole, 'open-voting') ? ['open-voting'] : [];
    case 'THIRD_READING_VOTING': {
      const acts = [];
      if (canDo(userRole, 'cast-vote')) acts.push('cast-vote');
      if (canDo(userRole, 'close-voting')) acts.push('close-voting');
      return acts;
    }
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
  'assign-committee':    { emoji: '🔍', label: 'Refer to Committee' },
  'committee-report':    { emoji: '📋', label: 'Submit Committee Report' },
  'second-reading':      { emoji: '📖', label: 'Record Second Reading' },
  'open-voting':         { emoji: '🗳️', label: 'Open Voting' },
  'cast-vote':           { emoji: '✋', label: 'Cast Your Vote' },
  'close-voting':        { emoji: '🔒', label: 'Close Voting & Tally' },
  'executive-approval':  { emoji: '✅', label: 'Executive Approval' },
  'executive-rejection': { emoji: '❌', label: 'Executive Rejection' },
  'post-publicly':       { emoji: '📢', label: 'Post Publicly' },
  'mark-effective':      { emoji: '⚖️', label: 'Mark as Effective' },
  'create-meeting':      { emoji: '📅', label: 'Create Meeting' },
};

export default function OrdinanceWorkflow({ ordinanceId, ordinance, committeeMeetings = [], onStatusUpdate, onMeetingCreated }) {
  const { user } = useAuth();

  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [form, setForm] = useState({});
  const [votingStatus, setVotingStatus] = useState(null);
  const [votingLoading, setVotingLoading] = useState(false);

  const fetchVotingStatus = useCallback(async () => {
    try {
      setVotingLoading(true);
      const res = await api.get(`/ordinances/${ordinanceId}/voting-status`);
      setVotingStatus(res.data);
    } catch { setVotingStatus(null); }
    finally { setVotingLoading(false); }
  }, [ordinanceId]);

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
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      setError(`Failed to load workflow data: ${msg}`);
      console.error('Workflow fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [ordinanceId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch voting status when stage is voting-related
  useEffect(() => {
    const stage = workflowStatus?.ordinance?.reading_stage;
    if (stage === 'THIRD_READING_VOTING' || stage === 'THIRD_READING_VOTED') {
      fetchVotingStatus();
    }
  }, [workflowStatus?.ordinance?.reading_stage, fetchVotingStatus]);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleActionClick = (action) => {
    setError('');

    if (action === 'committee-report') {
      const endedMeeting = getLatestEndedMeeting(committeeMeetings, ordinanceId);
      setForm({
        recommendation: '',
        report_content: '',
        meeting_date: endedMeeting?.meeting_date || '',
        meeting_minutes: endedMeeting?.meeting_minutes || endedMeeting?.meeting_transcript || '',
        attendees: normalizeAttendeesInput(endedMeeting?.meeting_attendees),
      });
      setActiveAction(action);
      return;
    }

    setActiveAction(action);
    setForm({});
  };

  const handleSubmitAction = async () => {
    setSubmitting(true);
    setError('');
    try {
      let body = {};
      let selfHandled = false; // true if the branch makes its own API call

      if (activeAction === 'submit-to-vice-mayor') {
        body = { comment: form.comment };
      } else if (activeAction === 'first-reading' || activeAction === 'second-reading') {
        body = { session_id: form.session_id || null, discussion_notes: form.discussion_notes, presiding_officer: form.presiding_officer || null };
      } else if (activeAction === 'assign-committee') {
        const committeeId = form.committee_id || ord?.committee_id;
        if (!committeeId) { setError('Please select a committee.'); setSubmitting(false); return; }
        body = { committee_id: committeeId };
      } else if (activeAction === 'committee-report') {
        if (!form.recommendation) { setError('Please select a recommendation.'); setSubmitting(false); return; }
        const committeeId = ord?.committee_id;
        if (!committeeId) {
          setError('Committee not assigned yet.');
          setSubmitting(false);
          return;
        }
        const endedMeeting = getLatestEndedMeeting(committeeMeetings, ordinanceId);

        // Extract from ended committee meeting if available
        let meeting_date = form.meeting_date || null;
        let meeting_minutes = form.meeting_minutes || '';
        let attendees = [];
        if (Array.isArray(form.attendees)) {
          attendees = form.attendees;
        } else if (typeof form.attendees === 'string') {
          attendees = form.attendees.split(',').map(a => a.trim()).filter(Boolean);
        }

        if (endedMeeting) {
          meeting_date = endedMeeting.meeting_date || meeting_date;
          meeting_minutes = endedMeeting.meeting_minutes || endedMeeting.meeting_transcript || meeting_minutes;
          const endedMeetingAttendees = endedMeeting.meeting_attendees;
          if (endedMeetingAttendees) {
            if (Array.isArray(endedMeetingAttendees)) {
              attendees = endedMeetingAttendees;
            } else if (typeof endedMeetingAttendees === 'string') {
              attendees = endedMeetingAttendees.split(',').map(a => a.trim()).filter(Boolean);
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
        selfHandled = true;
        
      } else if (activeAction === 'open-voting') {
        body = { session_id: form.session_id || null };
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
        const meetingMode = form.meeting_mode || 'online';
        const meetingLink = (form.meeting_link || '').trim();
        const meetingLocation = (form.meeting_location || '').trim();

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

        if ((meetingMode === 'online' || meetingMode === 'both') && !meetingLink) {
          setError('Meeting link is required for online or hybrid meetings.');
          setSubmitting(false);
          return;
        }

        if ((meetingMode === 'place' || meetingMode === 'both') && !meetingLocation) {
          setError('Meeting place is required for place or hybrid meetings.');
          setSubmitting(false);
          return;
        }

        await api.post(`/committees/${committeeId}/meetings`, {
          title: form.meeting_title,
          meeting_date: form.meeting_date,
          meeting_time: form.meeting_time || '',
          ordinance_id: ordinanceId,
          meetingLink: meetingLink,
          meeting_mode: meetingMode,
          meeting_location: meetingLocation,
        });
        selfHandled = true;
        await Promise.resolve(onMeetingCreated?.());
      }

      // Make the generic API call for actions that only prepared body
      if (!selfHandled) {
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
  const activeCommitteeMeetings = committeeMeetings.filter((meeting) => !meeting.ended);
  // Debug logs for chair/committee action visibility
  // console.log('User:', user);
  // console.log('Ordinance committee:', ord?.committee);
  // console.log('Chair ID:', ord?.committee?.chair_id, 'User ID:', user?.id);
  // console.log('Ordinance reading_stage:', readingStage);
  // Case-insensitive stage matching (handle null/undefined)
  const normalizedStage = readingStage ? String(readingStage).trim().toUpperCase() : undefined;
  const currentStageIndex = isRejected ? -1 : (STAGES.findIndex(s => s.key === normalizedStage));
  const availableActions = isRejected ? [] : getAvailableActions(normalizedStage, user?.role, ord, user, workflowStatus);
        
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
                  <div className="lw-stage-meta">
                    <span className="lw-step-index">{idx}</span>
                    <span className="lw-stage-name">{stage.label}</span>
                  </div>
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
              <h3>Refer to Committee</h3>
              <p>Select a committee to study and deliberate on this ordinance.</p>
              <div className="form-group">
                <label>Committee <span className="required">*</span></label>
                <select value={form.committee_id || ord?.committee_id || ''} onChange={e => setField('committee_id', e.target.value)} disabled={submitting}>
                  <option value="">Select Committee</option>
                  {committees.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button onClick={handleSubmitAction} className="btn btn-primary" disabled={submitting}>Refer to Committee</button>
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

      {/* Electronic Voting Panel — shown when voting is open */}
      {(normalizedStage === 'THIRD_READING_VOTING' || (normalizedStage === 'THIRD_READING_VOTED' && votingStatus?.votingSession)) && (
        <section className="workflow-section">
          <h3>🗳️ {normalizedStage === 'THIRD_READING_VOTING' ? 'Live Voting — Third Reading' : 'Voting Results — Third Reading'}</h3>
          {votingLoading ? (
            <p>Loading voting data...</p>
          ) : votingStatus ? (
            <div className="lw-electronic-voting">
              {/* Vote Tally */}
              <div className="lw-vote-tally">
                <div className="lw-vote-tally-item yes">
                  <span className="lw-vote-tally-label">✅ Yes</span>
                  <span className="lw-vote-tally-count">{votingStatus.results?.find(r => r.vote_option === 'Yes')?.count || 0}</span>
                </div>
                <div className="lw-vote-tally-item no">
                  <span className="lw-vote-tally-label">❌ No</span>
                  <span className="lw-vote-tally-count">{votingStatus.results?.find(r => r.vote_option === 'No')?.count || 0}</span>
                </div>
                <div className="lw-vote-tally-item abstain">
                  <span className="lw-vote-tally-label">➖ Abstain</span>
                  <span className="lw-vote-tally-count">{votingStatus.results?.find(r => r.vote_option === 'Abstain')?.count || 0}</span>
                </div>
                <div className="lw-vote-tally-item total">
                  <span className="lw-vote-tally-label">Total Votes</span>
                  <span className="lw-vote-tally-count">{votingStatus.totalVotes || 0} / {votingStatus.totalCouncilors || 0}</span>
                </div>
              </div>

              {/* Cast Vote — Councilors only, when voting is active */}
              {normalizedStage === 'THIRD_READING_VOTING' && user?.role === 'Councilor' && (
                <div className="lw-cast-vote">
                  {votingStatus.userVote ? (
                    <div className="lw-already-voted">
                      <p>You voted: <strong>{votingStatus.userVote}</strong></p>
                    </div>
                  ) : (
                    <div className="lw-vote-buttons">
                      <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>Cast your vote:</p>
                      {['Yes', 'No', 'Abstain'].map(option => (
                        <button
                          key={option}
                          className={`lw-action-btn lw-vote-${option.toLowerCase()}`}
                          disabled={submitting}
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to vote "${option}"? This cannot be changed.`)) return;
                            setSubmitting(true);
                            setError('');
                            try {
                              await api.post(`/ordinances/${ordinanceId}/cast-vote`, { vote_option: option });
                              await fetchVotingStatus();
                            } catch (err) {
                              setError(err.response?.data?.error || 'Failed to cast vote');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          {option === 'Yes' ? '✅' : option === 'No' ? '❌' : '➖'} {option}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Close Voting — Secretary/Admin only */}
              {normalizedStage === 'THIRD_READING_VOTING' && ['Secretary', 'Admin'].includes(user?.role) && (
                <div className="lw-close-voting" style={{ marginTop: '1rem' }}>
                  <button
                    className="lw-action-btn lw-close-voting-btn"
                    disabled={submitting}
                    onClick={async () => {
                      if (!window.confirm('Close voting and tally results? This cannot be undone.')) return;
                      setSubmitting(true);
                      setError('');
                      try {
                        await api.post(`/ordinances/${ordinanceId}/close-voting`);
                        setActiveAction(null);
                        await fetchData();
                        await fetchVotingStatus();
                        onStatusUpdate?.();
                      } catch (err) {
                        setError(err.response?.data?.error || 'Failed to close voting');
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    🔒 Close Voting &amp; Tally Results
                  </button>
                </div>
              )}

              {/* Individual Votes */}
              {votingStatus.voters?.length > 0 && (
                <div className="lw-voters-list" style={{ marginTop: '1rem' }}>
                  <h4>Individual Votes</h4>
                  <table className="lw-voters-table">
                    <thead>
                      <tr><th>Councilor</th><th>Vote</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                      {votingStatus.voters.map(v => (
                        <tr key={v.id}>
                          <td>{v.name}</td>
                          <td><span className={`lw-vote-badge ${v.vote_option.toLowerCase()}`}>{v.vote_option}</span></td>
                          <td>{new Date(v.voted_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Final result (shown after voting is closed) */}
              {votingStatus.votingSession?.status === 'closed' && ord?.voting_results && (
                <div className={["lw-vote-results", ord.voting_results.passed ? "passed" : "failed"].join(" ")} style={{ marginTop: '1rem' }}>
                  <span className="lw-vote-result-label">{ord.voting_results.passed ? "✅ PASSED" : "❌ FAILED"}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="no-data">No voting data available</p>
          )}
        </section>
      )}

      {/* Voting Results (for stages after voting, when no active session) */}
      {ord?.voting_results && normalizedStage !== 'THIRD_READING_VOTING' && !votingStatus?.votingSession && (
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
              disabled={!!workflowStatus?.committeeReport}
              title={workflowStatus?.committeeReport ? 'Committee report already submitted' : ''}
            >
              {ACTION_LABELS['committee-report']?.emoji} {workflowStatus?.committeeReport ? 'Committee Report Submitted' : ACTION_LABELS['committee-report']?.label}
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
          {availableActions.includes('open-voting') && (
            <button
              className="lw-action-btn lw-open-voting"
              onClick={() => handleActionClick('open-voting')}
            >
              {ACTION_LABELS['open-voting']?.emoji} {ACTION_LABELS['open-voting']?.label}
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
              <div className="form-group">
                <label>Where <span className="required">*</span></label>
                <select value={form.meeting_mode || 'online'} onChange={e => setField('meeting_mode', e.target.value)} disabled={submitting}>
                  <option value="online">Online</option>
                  <option value="place">Place</option>
                  <option value="both">Both</option>
                </select>
              </div>
              {(form.meeting_mode || 'online') !== 'place' && (
                <div className="form-group">
                  <label>Meeting Link {(form.meeting_mode || 'online') !== 'place' && <span className="required">*</span>}</label>
                  <input type="url" value={form.meeting_link || ''} onChange={e => setField('meeting_link', e.target.value)} disabled={submitting} placeholder="e.g. https://meet.google.com/abc-defg-hij" />
                </div>
              )}
              {(form.meeting_mode || 'online') !== 'online' && (
                <div className="form-group">
                  <label>Meeting Place <span className="required">*</span></label>
                  <input type="text" value={form.meeting_location || ''} onChange={e => setField('meeting_location', e.target.value)} disabled={submitting} placeholder="e.g. Session Hall, Committee Room A" />
                </div>
              )}
              <div className="form-group">
                <p style={{ margin: 0, color: '#666', fontSize: '0.95em' }}>
                  Choose whether this meeting is online, in-person, or both.
                </p>
              </div>
              <div className="lw-recorder-stack">
                <h4>Recording Controls</h4>
                {activeCommitteeMeetings.length > 0 ? (
                  activeCommitteeMeetings.map((meeting) => (
                    <div key={meeting.id} className="lw-recorder-card">
                      <div className="lw-recorder-card-header">
                        <strong>{meeting.title}</strong>
                        <span>
                          {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No date'}
                          {meeting.meeting_time ? ` at ${meeting.meeting_time}` : ''}
                        </span>
                      </div>
                      <LocalMeetingRecorder
                        meetingTitle={meeting.title}
                        committeeId={meeting.committee_id}
                        meetingId={meeting.id}
                        recordingUrl={meeting.recording_url}
                        recordingUploadedAt={meeting.recording_uploaded_at}
                        recordingUploadedByName={meeting.recording_uploaded_by_name}
                        onUploadComplete={onMeetingCreated}
                      />
                    </div>
                  ))
                ) : (
                  <p className="lw-recorder-empty">
                    Create a meeting first, then reopen this action to record and upload it from the workflow tab.
                  </p>
                )}
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

              {activeAction === "open-voting" && (
                <div className="form-group">
                  <label>Session (optional)</label>
                  <select value={form.session_id || ""} onChange={e => setField("session_id", e.target.value)}>
                    <option value="">— Select session —</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.title} — {new Date(s.date).toLocaleDateString()}</option>
                    ))}
                  </select>
                  <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9em' }}>
                    This will open electronic voting. Councilors will be notified and can cast their votes (Yes / No / Abstain).
                  </p>
                </div>
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
