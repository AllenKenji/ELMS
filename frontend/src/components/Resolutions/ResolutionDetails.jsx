import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import ResolutionWorkflow from './ResolutionWorkflow';
import CommitteeSelect from '../Committees/CommitteeSelect';
import LocalMeetingRecorder from '../common/LocalMeetingRecorder';
import '../../styles/ResolutionDetails.css';

const API_BASE_URL = (api.defaults.baseURL || '').replace(/\/+$/, '');

const STATUS_COLORS = {
  'Draft': '#95a5a6',
  'Submitted': '#3498db',
  'Under Review': '#f39c12',
  'Approved': '#27ae60',
  'Rejected': '#e74c3c',
  'Published': '#2ecc71',
  'Archived': '#7f8c8d',
};

const READING_STAGE_COLORS = {
  'SUBMITTED':                  '#3498db',
  'FIRST_READING':              '#9b59b6',
  'COMMITTEE_REVIEW':           '#e67e22',
  'COMMITTEE_REPORT_SUBMITTED': '#f39c12',
  'SECOND_READING':             '#8e44ad',
  'THIRD_READING_VOTED':        '#2980b9',
  'APPROVED':                   '#27ae60',
  'REJECTED':                   '#e74c3c',
  'POSTED':                     '#16a085',
  'EFFECTIVE':                  '#1abc9c',
};

const READING_STAGE_LABELS = {
  'SUBMITTED':                  'Submitted',
  'FIRST_READING':              '1st Reading',
  'COMMITTEE_REVIEW':           'Committee Review',
  'COMMITTEE_REPORT_SUBMITTED': 'Committee Report',
  'SECOND_READING':             '2nd Reading',
  'THIRD_READING_VOTED':        '3rd Reading / Voted',
  'APPROVED':                   'Executive Approved',
  'REJECTED':                   'Rejected',
  'POSTED':                     'Posted Publicly',
  'EFFECTIVE':                  'In Effect',
};

const STATUS_SEQUENCE = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Published',
];

const SECRETARY_STATUS_OPTIONS = {
  Draft: ['Submitted'],
  Submitted: ['Under Review'],
  'Under Review': [],
  Approved: [],
  Published: [],
};

export default function ResolutionDetails({ resolutionId, onClose, onStatusChange }) {
  const { user } = useAuth();
  const [resolution, setResolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workflow, setWorkflow] = useState([]);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [committeeMeetings, setCommitteeMeetings] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [assignCommitteeModal, setAssignCommitteeModal] = useState(false);
  const [selectedCommitteeId, setSelectedCommitteeId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [showCreateMeetingModal, setShowCreateMeetingModal] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate2, setMeetingDate2] = useState('');
  const [meetingTime2, setMeetingTime2] = useState('');
  const [meetingSubmitting, setMeetingSubmitting] = useState(false);
  const [meetingError, setMeetingError] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingMode, setMeetingMode] = useState('online');
  const [meetingLocation, setMeetingLocation] = useState('');
  const committeeId = resolution?.committee_id;
  const resolutionIdRef = resolution?.id;

  const canChangeStatus = () => {
    const role = user?.role?.toLowerCase();
    return role === 'admin' || role === 'secretary';
  };

  const canAssignCommittee = () => {
    const role = user?.role?.toLowerCase();
    const stage = String(resolution?.reading_stage || '').toUpperCase();
    return (role === 'admin' || role === 'vice mayor') && !resolution?.committee_id && stage === 'FIRST_READING';
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    try {
      const res = await api.put(`/resolutions/${resolutionId}/status`, {
        status: newStatus,
        changedBy: user?.id,
        notes: 'Status updated',
      });
      setResolution(res.data);
      setShowStatusModal(false);
      setNewStatus('');
      fetchWorkflowHistory();
      onStatusChange?.(res.data);
    } catch (err) {
      setError('Failed to update status.');
      console.error('Error:', err);
    }
  };

  const canDeleteMeeting = () => {
    if (!user || !resolution || !resolution.committee) return false;
    return user.role === 'Admin' || resolution.committee.chair_id === user.id;
  };

  const handleDeleteMeeting = async (meetingId) => {
    if (!committeeId || !meetingId) return;
    if (!window.confirm('Are you sure you want to delete this meeting?')) return;
    try {
      await api.delete(`/committees/${committeeId}/meetings/${meetingId}`);
      toast.success('Meeting deleted successfully');
      fetchCommitteeMeetings();
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setCommitteeMeetings((prev) => prev.filter((m) => m.id !== meetingId));
        toast.info('Meeting was already deleted.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to delete meeting.');
      }
    }
  };

  const fetchCommitteeMeetings = useCallback(async () => {
    if (!committeeId) {
      setCommitteeMeetings([]);
      return;
    }
    try {
      const res = await api.get(`/committees/${committeeId}/meetings`);
      const meetings = Array.isArray(res.data)
        ? res.data.filter(m => m.resolution_id === resolutionIdRef)
        : [];
      setCommitteeMeetings(meetings);
    } catch (err) {
      console.error('Failed to fetch committee meetings:', err);
      setCommitteeMeetings([]);
    }
  }, [committeeId, resolutionIdRef]);

  const canCreateMeeting = useMemo(() => {
    if (!resolution || resolution.reading_stage !== 'COMMITTEE_REVIEW' || !resolution.committee) return false;
    if (committeeMeetings.some(m => !m.ended)) return false;
    const isChair = resolution.committee.chair_id === user?.id;
    const isSecretary =
      Array.isArray(resolution.committee.members) &&
      resolution.committee.members.some(
        m => m.user_id === user?.id && (m.role === 'Committee Secretary' || m.role === 'Secretary')
      );
    return isChair || isSecretary;
  }, [resolution, user?.id, committeeMeetings]);

  const closeCreateMeetingModal = () => {
    setShowCreateMeetingModal(false);
    setMeetingTitle('');
    setMeetingDate2('');
    setMeetingTime2('');
    setMeetingMode('online');
    setMeetingLocation('');
    setMeetingError('');
  };

  const handleCreateMeeting = async () => {
    if (meetingSubmitting) return;
    setMeetingError('');
    if (!committeeId) return setMeetingError('No committee assigned.');
    if (!meetingTitle || !meetingDate2) {
      return setMeetingError('Meeting title and date are required.');
    }
    if ((meetingMode === 'online' || meetingMode === 'both') && !meetingLink.trim()) {
      return setMeetingError('Meeting link is required for online or hybrid meetings.');
    }
    if ((meetingMode === 'place' || meetingMode === 'both') && !meetingLocation.trim()) {
      return setMeetingError('Meeting place is required for place or hybrid meetings.');
    }
    setMeetingSubmitting(true);
    try {
      await api.post(`/committees/${committeeId}/meetings`, {
        title: meetingTitle,
        meeting_date: meetingDate2,
        meeting_time: meetingTime2 || '',
        resolution_id: resolutionIdRef,
        meetingLink: meetingLink.trim(),
        meeting_mode: meetingMode,
        meeting_location: meetingLocation.trim(),
      });
      closeCreateMeetingModal();
      toast.success('Meeting scheduled successfully');
      await Promise.all([
        fetchResolutionDetails(),
        fetchScheduledSessions(),
        fetchCommitteeMeetings(),
      ]);
    } catch (err) {
      console.error('Create meeting error:', err);
      setMeetingError(err.response?.data?.error || 'Failed to create meeting.');
    } finally {
      setMeetingSubmitting(false);
    }
  };

  const closeAssignCommitteeModal = () => {
    setAssignCommitteeModal(false);
    setSelectedCommitteeId('');
    setAssignError('');
  };

  const handleAssignCommittee = async () => {
    setAssignError("");
    setAssigning(true);
    try {
      const stage = String(resolution?.reading_stage || '').toUpperCase();
      if (stage !== 'FIRST_READING') {
        setAssignError('Committee can only be assigned after First Reading.');
        setAssigning(false);
        return;
      }
      if (!selectedCommitteeId) {
        setAssignError("Please select a committee.");
        setAssigning(false);
        return;
      }
      await api.post(`/resolutions/${resolutionId}/assign-committee`, {
        committee_id: selectedCommitteeId
      });
      setAssignCommitteeModal(false);
      setSelectedCommitteeId("");
      await Promise.all([
        fetchResolutionDetails(),
        fetchCommitteeMeetings(),
      ]);
    } catch (err) {
      setAssignError(err.response?.data?.error || "Failed to assign committee.");
      console.error(err);
    } finally {
      setAssigning(false);
    }
  };

  const fetchResolutionDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/resolutions/${resolutionId}`);
      setResolution(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load resolution details.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [resolutionId]);

  const fetchWorkflowHistory = useCallback(async () => {
    try {
      const res = await api.get(`/resolutions/${resolutionId}/history`);
      setWorkflow(res.data || []);
    } catch (err) {
      console.error('Error fetching workflow:', err);
    }
  }, [resolutionId]);

  const fetchScheduledSessions = useCallback(async () => {
    try {
      const res = await api.get(`/resolutions/${resolutionId}/sessions`);
      setScheduledSessions(res.data || []);
    } catch {
      setScheduledSessions([]);
    }
  }, [resolutionId]);

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([
        fetchResolutionDetails(),
        fetchWorkflowHistory(),
        fetchScheduledSessions(),
      ]);
    };
    loadAll();
  }, [fetchResolutionDetails, fetchWorkflowHistory, fetchScheduledSessions]);

  useEffect(() => {
    fetchCommitteeMeetings();
  }, [fetchCommitteeMeetings]);

  const handleDownloadFile = async (fileUrl, fileName) => {
    try {
      const response = await api.get(fileUrl.replace(API_BASE_URL, ''), {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'file');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download file');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/resolutions/${resolutionId}/generate-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `resolution-${resolution.resolution_number || resolutionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to generate PDF.');
      console.error('PDF download error:', err);
    }
  };

  const getNextStatuses = () => {
    const role = user?.role?.toLowerCase();
    if (role === 'secretary') {
      return SECRETARY_STATUS_OPTIONS[resolution?.status] || [];
    }

    const currentIndex = STATUS_SEQUENCE.indexOf(resolution?.status);
    if (currentIndex === -1) return [];
    return STATUS_SEQUENCE.slice(currentIndex + 1);
  };

  const getStatusPosition = () => {
    const index = STATUS_SEQUENCE.indexOf(resolution?.status);
    return index === -1 ? 0 : index;
  };

  const isCommitteeMemberOrSecretaryOrAdmin = useMemo(() => {
    if (!resolution || !resolution.committee || !user) return false;
    if (user.role === 'Admin') return true;
    if (!Array.isArray(resolution.committee.members)) return false;
    return resolution.committee.members.some(m => m.user_id === user.id);
  }, [resolution, user]);

  if (loading) {
    return (
      <div className="resolution-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="loading">Loading resolution details...</div>
        </div>
      </div>
    );
  }

  if (!resolution) {
    return (
      <div className="resolution-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="error-message">Resolution not found</div>
        </div>
      </div>
    );
  }

  const renderStatusBadge = () => {
    if (resolution.reading_stage) {
      return (
        <span
          className="status-badge"
          style={{ backgroundColor: READING_STAGE_COLORS[resolution.reading_stage] || '#7f8c8d' }}
        >
          {READING_STAGE_LABELS[resolution.reading_stage] || resolution.reading_stage}
        </span>
      );
    }
    return (
      <span
        className="status-badge"
        style={{ backgroundColor: STATUS_COLORS[resolution.status] || '#7f8c8d' }}
      >
        {resolution.status}
      </span>
    );
  };

  return (
    <div className="resolution-details-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="modal-content large">
        {/* Header */}
        <div className="details-header">
          <div className="header-title">
            <h2>{resolution.title}</h2>
            {renderStatusBadge()}
          </div>
          <button onClick={onClose} className="btn-close">✕</button>
        </div>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="details-tabs">
          <button className={`tab-button ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>
            📋 Details
          </button>
          <button className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
            📅 Timeline
          </button>
          <button className={`tab-button ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            📝 History
          </button>
          <button className={`tab-button ${activeTab === 'workflow' ? 'active' : ''}`} onClick={() => setActiveTab('workflow')}>
            ⚙️ Workflow
          </button>
          {isCommitteeMemberOrSecretaryOrAdmin && (
            <button className={`tab-button ${activeTab === 'committee-meetings' ? 'active' : ''}`} onClick={() => setActiveTab('committee-meetings')}>
              🏛️ Committee Meetings
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="details-content">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="tab-pane details-pane">
              <div className="details-grid">
                <div className="detail-section">
                  <h3>📄 Basic Information</h3>
                  <div className="detail-item">
                    <label>Resolution Number:</label>
                    <span className="monospace">{resolution.resolution_number || 'Pending Assignment'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    {renderStatusBadge()}
                  </div>
                  <div className="detail-item">
                    <label>Proposer:</label>
                    <span>{resolution.proposer_name || 'System'}</span>
                  </div>
                </div>

                {Array.isArray(resolution.co_authors) && resolution.co_authors.length > 0 && (
                  <div className="detail-section full-width">
                    <h3>🤝 Co-authors / Sponsors</h3>
                    <ul className="detail-list">
                      {resolution.co_authors.map((c, idx) => (
                        <li key={c.id || c.name || idx}>
                          <span>{c.name}</span>
                          {c.email && <span style={{ color: '#888', marginLeft: 8, fontSize: '0.95em' }}>({c.email})</span>}
                          {c.role_name && <span style={{ color: '#888', marginLeft: 8, fontSize: '0.95em' }}>- {c.role_name}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {resolution.attachments && resolution.attachments.length > 0 && (
                  <div className="detail-section full-width">
                    <h3>📎 Attachments</h3>
                    <ul className="detail-list">
                      {resolution.attachments.map((att, idx) => {
                        const BASE_URL = API_BASE_URL;
                        return (
                          <li key={idx}>
                            {(() => {
                              const filePath = typeof att === 'string' ? att : att.file_path || att.url;
                              if (!filePath) return <span>Invalid attachment</span>;
                              const fileUrl = filePath.startsWith('http') ? filePath : `${BASE_URL}${filePath}`;
                              const fileName = filePath.split('/').pop();
                              return (
                                <>
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">{fileName}</a>
                                  {" | "}
                                  <button onClick={() => handleDownloadFile(fileUrl, fileName)} className="btn-link" style={{ marginLeft: '6px' }}>Download</button>
                                </>
                              );
                            })()}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <div className="detail-section">
                  <h3>📅 Key Dates</h3>
                  <div className="detail-item">
                    <label>Submitted:</label>
                    <span>{resolution.created_at ? new Date(resolution.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</span>
                  </div>
                  {resolution.approved_date && (
                    <div className="detail-item">
                      <label>Approved:</label>
                      <span>{new Date(resolution.approved_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  )}
                  {resolution.published_date && (
                    <div className="detail-item">
                      <label>Published:</label>
                      <span>{new Date(resolution.published_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section full-width">
                  <h3>📝 Description</h3>
                  <div className="detail-text">{resolution.description || 'No description provided'}</div>
                </div>

                <div className="detail-section full-width">
                  <h3>📖 Full Content</h3>
                  <div className="detail-content-box">{resolution.content || 'No content available'}</div>
                </div>

                {resolution.remarks && (
                  <div className="detail-section full-width">
                    <h3>💬 Remarks</h3>
                    <div className="detail-text">{resolution.remarks}</div>
                  </div>
                )}

                <div className="detail-section full-width">
                  <h3>🏛️ Scheduled Sessions</h3>
                  {scheduledSessions.length > 0 ? (
                    <ul className="session-schedule-list">
                      {scheduledSessions.map((s) => (
                        <li key={s.id} className="session-schedule-item">
                          <strong>{s.title}</strong>
                          {s.date && (
                            <span className="session-schedule-date">
                              {' — '}{new Date(s.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          )}
                          {s.agenda_order && <span className="session-schedule-tag">Agenda #{s.agenda_order}</span>}
                          {s.reading_number && <span className="session-schedule-tag reading">Reading #{s.reading_number}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="detail-text">Not scheduled in any session agenda yet.</p>
                  )}
                </div>

                <div className="detail-section full-width">
                  <h3>⚙️ Actions</h3>
                  <div className="action-buttons">
                    {canChangeStatus() && (
                      <button onClick={() => setShowStatusModal(true)} className="btn-action-details btn-primary">🔄 Change Status</button>
                    )}
                    {canAssignCommittee() && (
                      <button onClick={() => setAssignCommitteeModal(true)} className="btn-action-details btn-accent" disabled={!!resolution?.committee_id}>🏛️ Assign Committee</button>
                    )}
                    {canCreateMeeting && (
                      <button onClick={() => setShowCreateMeetingModal(true)} className="btn-action-details btn-accent">📅 Create Meeting</button>
                    )}
                    {resolution?.reading_stage === 'COMMITTEE_REPORT_SUBMITTED' &&
                      (user?.role?.toLowerCase() === 'admin' || resolution?.committee?.chair_id === user?.id) && (
                        <button onClick={() => setActiveTab('workflow')} className="btn-action-details btn-warning">📋 Create Committee Report</button>
                    )}
                    <button onClick={handleDownloadPdf} className="btn-action-details btn-secondary">📄 Download PDF</button>
                  </div>

                  {showCreateMeetingModal && (
                    <div className="status-modal-overlay">
                      <div className="status-modal">
                        <h3>Schedule Committee Meeting</h3>
                        <div className="form-group">
                          <label>Meeting Title <span className="required">*</span></label>
                          <input type="text" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} disabled={meetingSubmitting} placeholder="e.g. Committee Deliberation on Proposed Measure" />
                        </div>
                        <div className="form-group">
                          <label>Meeting Date <span className="required">*</span></label>
                          <input type="date" value={meetingDate2} onChange={e => setMeetingDate2(e.target.value)} disabled={meetingSubmitting} />
                        </div>
                        <div className="form-group">
                          <label>Meeting Time</label>
                          <input type="time" value={meetingTime2} onChange={e => setMeetingTime2(e.target.value)} disabled={meetingSubmitting} />
                        </div>
                        <div className="form-group">
                          <label>Where <span className="required">*</span></label>
                          <select value={meetingMode} onChange={e => setMeetingMode(e.target.value)} disabled={meetingSubmitting}>
                            <option value="online">Online</option>
                            <option value="place">Place</option>
                            <option value="both">Both</option>
                          </select>
                        </div>
                        {meetingMode !== 'place' && (
                          <div className="form-group">
                            <label>Meeting Link <span className="required">*</span></label>
                            <input type="text" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} disabled={meetingSubmitting} placeholder="Paste Google Meet or Zoom link here" />
                          </div>
                        )}
                        {meetingMode !== 'online' && (
                          <div className="form-group">
                            <label>Meeting Place <span className="required">*</span></label>
                            <input type="text" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} disabled={meetingSubmitting} placeholder="e.g. Session Hall, Committee Room A" />
                          </div>
                        )}
                        <div className="form-group">
                          <p style={{ margin: 0, color: '#666', fontSize: '0.95em' }}>Choose whether this meeting is online, in-person, or both.</p>
                        </div>
                        <div className="modal-actions">
                          <button onClick={handleCreateMeeting} className="btn btn-primary" disabled={meetingSubmitting}>Create Meeting</button>
                          <button onClick={closeCreateMeetingModal} className="btn btn-secondary" disabled={meetingSubmitting}>Cancel</button>
                        </div>
                        {meetingError && <div className="alert alert-error">{meetingError}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {assignCommitteeModal && (
                  <div className="status-modal-overlay">
                    <div className="status-modal">
                      <h3>Assign Committee</h3>
                      <p>Select a committee to assign to this resolution.</p>
                      <CommitteeSelect value={selectedCommitteeId} onChange={setSelectedCommitteeId} disabled={assigning} />
                      {assignError && <div className="alert alert-error">{assignError}</div>}
                      <div className="modal-actions">
                        <button onClick={closeAssignCommitteeModal} className="btn-cancel" disabled={assigning}>Cancel</button>
                        <button onClick={handleAssignCommittee} disabled={!selectedCommitteeId || assigning} className="btn-confirm">
                          {assigning ? 'Assigning...' : 'Assign Committee'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Committee Meetings Tab */}
          {isCommitteeMemberOrSecretaryOrAdmin && activeTab === 'committee-meetings' && (
            <div className="tab-pane committee-meetings-pane">
              <h3>🏛️ Committee Meetings</h3>
              {committeeMeetings.length > 0 ? (
                <ul className="committee-meetings-list">
                  {committeeMeetings.map((meeting) => {
                    let canEndMeeting = false;
                    if (user && resolution && resolution.committee) {
                      canEndMeeting = (
                        user.role === 'Admin' ||
                        resolution.committee.chair_id === user.id ||
                        (Array.isArray(resolution.committee.members) &&
                          resolution.committee.members.some(
                            m => m.user_id === user.id && (m.role === 'Committee Secretary' || m.role === 'Secretary')
                          ))
                      );
                    }
                    return (
                      <li key={meeting.id} className="committee-meeting-item">
                        <div className="committee-meeting-main">
                          <div className="committee-meeting-header-row">
                            <strong>{meeting.title}</strong>
                            {meeting.ended && (
                              <span className="meeting-ended-label">Meeting Ended</span>
                            )}
                          </div>
                          <div className="committee-meeting-schedule">
                            {meeting.meeting_date && (
                              <span className="committee-meeting-date">
                                {new Date(meeting.meeting_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </span>
                            )}
                            {meeting.meeting_time && <span className="committee-meeting-time">at {meeting.meeting_time}</span>}
                          </div>
                          <div className="committee-meeting-venue-block">
                            <div className="committee-meeting-venue-row">
                              <span className="committee-meeting-venue-label">Format</span>
                              <span className={`committee-meeting-mode ${(meeting.meeting_mode || 'online').toLowerCase()}`}>
                                {meeting.meeting_mode === 'both' ? 'Online + Place' : meeting.meeting_mode === 'place' ? 'Place' : 'Online'}
                              </span>
                            </div>
                            {meeting.meeting_location && (
                              <div className="committee-meeting-venue-row">
                                <span className="committee-meeting-venue-label">Place</span>
                                <span className="committee-meeting-venue-value">{meeting.meeting_location}</span>
                              </div>
                            )}
                            {meeting.meeting_link && (
                              <div className="committee-meeting-venue-row">
                                <span className="committee-meeting-venue-label">Online</span>
                                <span className="committee-meeting-venue-value">Meeting link available</span>
                              </div>
                            )}
                            {meeting.secretary_name && (
                              <div className="committee-meeting-venue-row">
                                <span className="committee-meeting-venue-label">Secretary</span>
                                <span className="committee-meeting-venue-value">{meeting.secretary_name}</span>
                              </div>
                            )}
                          </div>
                          {!meeting.ended && (
                            <LocalMeetingRecorder
                              meetingTitle={meeting.title}
                              committeeId={meeting.committee_id}
                              meetingId={meeting.id}
                              recordingUrl={meeting.recording_url}
                              recordingUploadedAt={meeting.recording_uploaded_at}
                              recordingUploadedByName={meeting.recording_uploaded_by_name}
                              onUploadComplete={fetchCommitteeMeetings}
                            />
                          )}
                        </div>
                        <div className="committee-meeting-actions">
                          {meeting.meeting_link && !meeting.ended && (
                            <button className="btn btn-success btn-join-meeting" onClick={() => window.open(meeting.meeting_link, '_blank', 'noopener,noreferrer')}>
                              Join Meeting
                            </button>
                          )}
                          {canEndMeeting && !meeting.ended && (
                            <button
                              className="btn btn-warning btn-end-meeting"
                              onClick={async () => {
                                if (window.confirm('End this meeting? This will disable the join link for all participants.')) {
                                  try {
                                    await api.patch(`/committees/${meeting.committee_id}/meetings/${meeting.id}/end`);
                                    toast.success('Meeting ended');
                                    await fetchCommitteeMeetings();
                                    await fetchResolutionDetails();
                                  } catch (err) {
                                    console.error('End meeting error:', err);
                                    toast.error('Failed to end meeting');
                                  }
                                }
                              }}
                            >
                              End Meeting
                            </button>
                          )}
                          {canDeleteMeeting() && (
                            <button className="btn btn-danger btn-delete-meeting" onClick={() => handleDeleteMeeting(meeting.id)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="detail-text">No committee meetings scheduled for this resolution.</p>
              )}
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="tab-pane timeline-pane">
              <div className="workflow-timeline">
                <h3>Resolution Workflow Timeline</h3>
                <div className="timeline-container">
                  <div className="timeline-bar">
                    {STATUS_SEQUENCE.map((status, index) => {
                      const isCompleted = index <= getStatusPosition();
                      const isCurrentStatus = status === resolution.status;
                      return (
                        <div key={status} className="timeline-item">
                          <div className={`timeline-dot ${isCompleted ? 'completed' : ''} ${isCurrentStatus ? 'current' : ''}`}>
                            {isCompleted ? '✓' : ''}
                          </div>
                          <div className="timeline-label">
                            <span className={isCompleted ? 'completed' : ''}>{status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="timeline-details">
                  <h4>Status Changes</h4>
                  {workflow && workflow.length > 0 ? (
                    <div className="timeline-list">
                      {workflow.map((item, index) => (
                        <div key={index} className="timeline-entry">
                          <div className="entry-header">
                            <span className="entry-status">{item.status}</span>
                            <span className="entry-date">
                              {new Date(item.changed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="entry-info">
                            <p>Changed by: <strong>{item.changed_by_name || 'System'}</strong></p>
                            {item.notes && <p className="entry-notes">{item.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No status changes yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="tab-pane history-pane">
              <div className="audit-trail">
                <h3>Activity History</h3>
                {workflow && workflow.length > 0 ? (
                  <div className="history-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Status</th>
                          <th>Changed By</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflow.map((item, index) => (
                          <tr key={index}>
                            <td className="date-cell">
                              {new Date(item.changed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              <br />
                              <small>{new Date(item.changed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</small>
                            </td>
                            <td>
                              <span className="status-badge" style={{ backgroundColor: STATUS_COLORS[item.status] || '#7f8c8d' }}>
                                {item.status}
                              </span>
                            </td>
                            <td>{item.changed_by_name || 'System'}</td>
                            <td className="notes-cell">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-data">No activity history yet</p>
                )}
              </div>
            </div>
          )}

          {/* Workflow Tab */}
          {activeTab === 'workflow' && (
            <div className="tab-pane workflow-pane">
              <ResolutionWorkflow
                resolutionId={resolutionId}
                resolution={resolution}
                committeeMeetings={committeeMeetings}
                onStatusUpdate={() => {
                  fetchResolutionDetails();
                  fetchWorkflowHistory();
                }}
                onMeetingCreated={fetchCommitteeMeetings}
              />
            </div>
          )}
        </div>

        {/* Status Change Modal */}
        {showStatusModal && (
          <div className="status-modal-overlay">
            <div className="status-modal">
              <h3>Change Resolution Status</h3>
              <p>Current Status: <strong>{resolution.status}</strong></p>
              <div className="status-options">
                <h4>Select New Status:</h4>
                {getNextStatuses().length > 0 ? (
                  getNextStatuses().map(status => (
                    <label key={status} className="status-option">
                      <input type="radio" name="status" value={status} checked={newStatus === status} onChange={e => setNewStatus(e.target.value)} />
                      <span className="status-label">{status}</span>
                    </label>
                  ))
                ) : (
                  <p className="no-options">No next statuses available</p>
                )}
              </div>
              <div className="modal-actions">
                <button onClick={() => { setShowStatusModal(false); setNewStatus(''); }} className="btn-cancel">Cancel</button>
                <button onClick={handleStatusChange} disabled={!newStatus} className="btn-confirm">Update Status</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}