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

  useEffect(() => {
    fetchOrdinanceDetails();
    fetchWorkflowHistory();
  }, [fetchOrdinanceDetails, fetchWorkflowHistory]);

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
            <span
              className="status-badge"
              style={{ backgroundColor: STATUS_COLORS[ordinance.status] }}
            >
              {ordinance.status}
            </span>
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
                <section className="detail-section">
                  <h3>📄 Basic Information</h3>
                  <div className="detail-item">
                    <label>Ordinance Number:</label>
                    <span className="monospace">
                      {ordinance.ordinance_number || 'Pending Assignment'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: STATUS_COLORS[ordinance.status] }}
                    >
                      {ordinance.status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Proposer:</label>
                    <span>{ordinance.proposer_name || 'System'}</span>
                  </div>
                </section>

                {/* Dates */}
                <section className="detail-section">
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
                </section>

                {/* Description */}
                <section className="detail-section full-width">
                  <h3>📝 Description</h3>
                  <div className="detail-text">
                    {ordinance.description || 'No description provided'}
                  </div>
                </section>

                {/* Full Content */}
                <section className="detail-section full-width">
                  <h3>📖 Full Content</h3>
                  <div className="detail-content-box">
                    {ordinance.content || 'No content available'}
                  </div>
                </section>

                {/* Remarks */}
                {ordinance.remarks && (
                  <section className="detail-section full-width">
                    <h3>💬 Remarks</h3>
                    <div className="detail-text">
                      {ordinance.remarks}
                    </div>
                  </section>
                )}

                {/* Action Buttons */}
                {canChangeStatus() && (
                  <section className="detail-section full-width">
                    <h3>⚙️ Actions</h3>
                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="btn-action btn-primary"
                    >
                      🔄 Change Status
                    </button>
                  </section>
                )}
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