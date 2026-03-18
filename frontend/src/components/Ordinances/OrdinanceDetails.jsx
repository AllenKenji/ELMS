import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrdinanceWorkflow from './OrdinanceWorkflow';
import '../../styles/OrdinanceDetails.css';

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

export default function OrdinanceDetails({ ordinanceId, onClose, onStatusChange }) {
  const { user } = useAuth();
  const [ordinance, setOrdinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workflow, setWorkflow] = useState([]);
  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Wrap functions with useCallback to prevent dependency issues
  const fetchOrdinanceDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/ordinances/${ordinanceId}`);
      setOrdinance(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load ordinance details.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [ordinanceId]);

  const fetchWorkflowHistory = useCallback(async () => {
    try {
      const res = await api.get(`/ordinances/${ordinanceId}/history`);
      setWorkflow(res.data || []);
    } catch (err) {
      console.error('Error fetching workflow:', err);
    }
  }, [ordinanceId]);

  const fetchScheduledSessions = useCallback(async () => {
    try {
      const res = await api.get(`/ordinances/${ordinanceId}/sessions`);
      setScheduledSessions(res.data || []);
    } catch {
      setScheduledSessions([]);
    }
  }, [ordinanceId]);

  useEffect(() => {
    fetchOrdinanceDetails();
    fetchWorkflowHistory();
    fetchScheduledSessions();
  }, [fetchOrdinanceDetails, fetchWorkflowHistory, fetchScheduledSessions]);

  const handleStatusChange = async () => {
    if (!newStatus) return;

    try {
      const res = await api.put(`/ordinances/${ordinanceId}/status`, {
        status: newStatus,
        changedBy: user?.id,
        notes: 'Status updated',
      });

      setOrdinance(res.data);
      setShowStatusModal(false);
      setNewStatus('');
      fetchWorkflowHistory();
      onStatusChange?.(res.data);
    } catch (err) {
      setError('Failed to update status.');
      console.error('Error:', err);
    }
  };

  const canChangeStatus = () => {
    return ['Admin', 'Secretary'].includes(user?.role);
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/ordinances/${ordinanceId}/generate-pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordinance-${ordinance.ordinance_number || ordinanceId}.pdf`);
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
    const currentIndex = STATUS_SEQUENCE.indexOf(ordinance?.status);
    if (currentIndex === -1) return [];
    return STATUS_SEQUENCE.slice(currentIndex + 1);
  };

  const getStatusPosition = () => {
    return STATUS_SEQUENCE.indexOf(ordinance?.status) || 0;
  };

  if (loading) {
    return (
      <div className="ordinance-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="loading">Loading ordinance details...</div>
        </div>
      </div>
    );
  }

  if (!ordinance) {
    return (
      <div className="ordinance-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="error-message">Ordinance not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ordinance-details-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="modal-content large">
        {/* Header */}
        <div className="details-header">
          <div className="header-title">
            <h2>{ordinance.title}</h2>
            {ordinance.reading_stage ? (
              <span
                className="status-badge"
                style={{ backgroundColor: READING_STAGE_COLORS[ordinance.reading_stage] || '#7f8c8d' }}
              >
                {READING_STAGE_LABELS[ordinance.reading_stage] || ordinance.reading_stage}
              </span>
            ) : (
              <span
                className="status-badge"
                style={{ backgroundColor: STATUS_COLORS[ordinance.status] }}
              >
                {ordinance.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="btn-close">
            ✕
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="details-tabs">
          <button
            className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📋 Details
          </button>
          <button
            className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            📅 Timeline
          </button>
          <button
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📝 History
          </button>
          <button
            className={`tab-button ${activeTab === 'workflow' ? 'active' : ''}`}
            onClick={() => setActiveTab('workflow')}
          >
            ⚙️ Workflow
          </button>
        </div>

        {/* Tab Content */}
        <div className="details-content">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="tab-pane details-pane">
              <div className="details-grid">
                {/* Basic Info */}
                <div className="detail-section">
                  <h3>📄 Basic Information</h3>
                  <div className="detail-item">
                    <label>Ordinance Number:</label>
                    <span className="monospace">
                      {ordinance.ordinance_number || 'Pending Assignment'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    {ordinance.reading_stage ? (
                      <span
                        className="status-badge"
                        style={{ backgroundColor: READING_STAGE_COLORS[ordinance.reading_stage] || '#7f8c8d' }}
                      >
                        {READING_STAGE_LABELS[ordinance.reading_stage] || ordinance.reading_stage}
                      </span>
                    ) : (
                      <span
                        className="status-badge"
                        style={{ backgroundColor: STATUS_COLORS[ordinance.status] }}
                      >
                        {ordinance.status}
                      </span>
                    )}
                  </div>
                  <div className="detail-item">
                    <label>Proposer:</label>
                    <span>{ordinance.proposer_name || 'System'}</span>
                  </div>
                </div>

                {/* Co-authors / Sponsors */}
                {Array.isArray(ordinance.co_authors) && ordinance.co_authors.length > 0 && (
                  <div className="detail-section full-width">
                    <h3>🤝 Co-authors / Sponsors</h3>
                    <ul className="detail-list">
                      {ordinance.co_authors.map((c, idx) => (
                        <li key={c.id || c.name || idx}>
                          <span>{c.name}</span>
                          {c.email && (
                            <span style={{ color: '#888', marginLeft: 8, fontSize: '0.95em' }}>({c.email})</span>
                          )}
                          {c.role_name && (
                            <span style={{ color: '#888', marginLeft: 8, fontSize: '0.95em' }}>- {c.role_name}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Attachments */}
                {ordinance.attachments && ordinance.attachments.length > 0 && (
                  <div className="detail-section full-width">
                    <h3>📎 Attachments</h3>
                    <ul className="detail-list">
                      {ordinance.attachments.map((att, idx) => {
                        // If it's a file path (starts with /uploads/), show as download link
                        const isFile = typeof att === 'string' && att.startsWith('/uploads/');
                        return (
                          <li key={idx}>
                            {isFile ? (
                              <a href={att} target="_blank" rel="noopener noreferrer" download>
                                {att.split('/').pop()}
                              </a>
                            ) : (
                              <a href={att} target="_blank" rel="noopener noreferrer">
                                {att}
                              </a>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Dates */}
                <div className="detail-section">
                  <h3>📅 Key Dates</h3>
                  <div className="detail-item">
                    <label>Submitted:</label>
                    <span>
                      {ordinance.created_at
                        ? new Date(ordinance.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </span>
                  </div>
                  {ordinance.approved_date && (
                    <div className="detail-item">
                      <label>Approved:</label>
                      <span>
                        {new Date(ordinance.approved_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {ordinance.published_date && (
                    <div className="detail-item">
                      <label>Published:</label>
                      <span>
                        {new Date(ordinance.published_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="detail-section full-width">
                  <h3>📝 Description</h3>
                  <div className="detail-text">
                    {ordinance.description || 'No description provided'}
                  </div>
                </div>

                {/* Full Content */}
                <div className="detail-section full-width">
                  <h3>📖 Full Content</h3>
                  <div className="detail-content-box">
                    {ordinance.content || 'No content available'}
                  </div>
                </div>

                {/* Remarks */}
                {ordinance.remarks && (
                  <div className="detail-section full-width">
                    <h3>💬 Remarks</h3>
                    <div className="detail-text">
                      {ordinance.remarks}
                    </div>
                  </div>
                )}

                {/* Scheduled Sessions */}
                <div className="detail-section full-width">
                  <h3>🏛️ Scheduled Sessions</h3>
                  {scheduledSessions.length > 0 ? (
                    <ul className="session-schedule-list">
                      {scheduledSessions.map((s) => (
                        <li key={s.id} className="session-schedule-item">
                          <strong>{s.title}</strong>
                          {s.date && (
                            <span className="session-schedule-date">
                              {' — '}
                              {new Date(s.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                          {s.agenda_order && (
                            <span className="session-schedule-tag">
                              Agenda #{s.agenda_order}
                            </span>
                          )}
                          {s.reading_number && (
                            <span className="session-schedule-tag reading">
                              Reading #{s.reading_number}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="detail-text">Not scheduled in any session agenda yet.</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="detail-section full-width">
                  <h3>⚙️ Actions</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {canChangeStatus() && (
                      <button
                        onClick={() => setShowStatusModal(true)}
                        className="btn-action btn-primary"
                      >
                        🔄 Change Status
                      </button>
                    )}
                    <button
                      onClick={handleDownloadPdf}
                      className="btn-action btn-secondary"
                    >
                      📄 Download PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="tab-pane timeline-pane">
              <div className="workflow-timeline">
                <h3>Ordinance Workflow Timeline</h3>
                <div className="timeline-container">
                  <div className="timeline-bar">
                    {STATUS_SEQUENCE.map((status, index) => {
                      const isCompleted = index <= getStatusPosition();
                      const isCurrentStatus = status === ordinance.status;

                      return (
                        <div key={status} className="timeline-item">
                          <div
                            className={`timeline-dot ${isCompleted ? 'completed' : ''} ${
                              isCurrentStatus ? 'current' : ''
                            }`}
                          >
                            {isCompleted ? '✓' : ''}
                          </div>
                          <div className="timeline-label">
                            <span className={isCompleted ? 'completed' : ''}>
                              {status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline Details */}
                <div className="timeline-details">
                  <h4>Status Changes</h4>
                  {workflow && workflow.length > 0 ? (
                    <div className="timeline-list">
                      {workflow.map((item, index) => (
                        <div key={index} className="timeline-entry">
                          <div className="entry-header">
                            <span className="entry-status">{item.status}</span>
                            <span className="entry-date">
                              {new Date(item.changed_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="entry-info">
                            <p>
                              Changed by:{' '}
                              <strong>{item.changed_by_name || 'System'}</strong>
                            </p>
                            {item.notes && (
                              <p className="entry-notes">{item.notes}</p>
                            )}
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
                              {new Date(item.changed_at).toLocaleDateString(
                                'en-US',
                                {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }
                              )}
                              <br />
                              <small>
                                {new Date(
                                  item.changed_at
                                ).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </small>
                            </td>
                            <td>
                              <span
                                className="status-badge"
                                style={{
                                  backgroundColor:
                                    STATUS_COLORS[item.status],
                                }}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td>{item.changed_by_name || 'System'}</td>
                            <td className="notes-cell">
                              {item.notes || '-'}
                            </td>
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
              <OrdinanceWorkflow
                ordinanceId={ordinanceId}
                ordinance={ordinance}
                onStatusUpdate={() => {
                  fetchOrdinanceDetails();
                  fetchWorkflowHistory();
                }}
              />
            </div>
          )}
        </div>

        {/* Status Change Modal */}
        {showStatusModal && (
          <div className="status-modal-overlay">
            <div className="status-modal">
              <h3>Change Ordinance Status</h3>
              <p>
                Current Status: <strong>{ordinance.status}</strong>
              </p>

              <div className="status-options">
                <h4>Select New Status:</h4>
                {getNextStatuses().length > 0 ? (
                  getNextStatuses().map(status => (
                    <label key={status} className="status-option">
                      <input
                        type="radio"
                        name="status"
                        value={status}
                        checked={newStatus === status}
                        onChange={e => setNewStatus(e.target.value)}
                      />
                      <span className="status-label">{status}</span>
                    </label>
                  ))
                ) : (
                  <p className="no-options">No next statuses available</p>
                )}
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setNewStatus('');
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={!newStatus}
                  className="btn-confirm"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}