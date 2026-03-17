import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import SessionAgendaPanel from './SessionAgendaPanel';
import OrderOfBusinessPanel from './OrderOfBusinessPanel';
import '../../styles/SessionDetails.css';

const SESSION_STATUS = {
  'Upcoming': '#3498db',
  'In Progress': '#f39c12',
  'Completed': '#27ae60',
  'Cancelled': '#e74c3c',
};

export default function SessionDetails({ sessionId, onClose, onEdit, onDelete }) {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [ordinances, setOrdinances] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSessionData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch session details
      const sessionRes = await api.get(`/sessions/${sessionId}`);
      setSession(sessionRes.data);

      // Fetch ordinances in session
      try {
        const ordinancesRes = await api.get(`/sessions/${sessionId}/ordinances`);
        setOrdinances(ordinancesRes.data || []);
      } catch {
        setOrdinances([]);
      }

      // Fetch participants
      try {
        const participantsRes = await api.get(`/sessions/${sessionId}/participants`);
        setParticipants(participantsRes.data || []);
      } catch {
        setParticipants([]);
      }
    } catch (err) {
      setError('Failed to load session details.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSessionData();
  }, [fetchSessionData]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/sessions/${sessionId}`);
      setShowDeleteModal(false);
      onDelete?.();
    } catch (err) {
      setError('Failed to delete session.');
      console.error('Error:', err);
      setDeleting(false);
    }
  };

  const getSessionStatus = () => {
    if (!session?.date) return 'Unknown';
    const sessionDate = new Date(session.date);
    const now = new Date();

    if (sessionDate < now) {
      return 'Completed';
    }
    return 'Upcoming';
  };

  const canEdit = () => {
    return ['Admin', 'Secretary'].includes(user?.role);
  };

  const canDelete = () => {
    return ['Admin', 'Secretary'].includes(user?.role);
  };

  if (loading) {
    return (
      <div className="session-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="loading">Loading session details...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="session-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="error-message">Session not found</div>
        </div>
      </div>
    );
  }

  const status = getSessionStatus();
  const sessionDateTime = new Date(session.date);

  return (
    <div className="session-details-modal">
      <div className="modal-overlay" onClick={onClose}></div>
      <div className="modal-content large">
        {/* Header */}
        <div className="details-header">
          <div className="header-title">
            <h2>{session.title}</h2>
            <span
              className="status-badge"
              style={{ backgroundColor: SESSION_STATUS[status] }}
            >
              {status}
            </span>
          </div>
          <div className="header-actions">
            {canEdit() && (
              <button
                onClick={() => onEdit?.(session)}
                className="btn-edit"
                title="Edit session"
              >
                ✏️
              </button>
            )}
            {canDelete() && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-delete"
                title="Delete session"
              >
                🗑️
              </button>
            )}
            <button onClick={onClose} className="btn-close">
              ✕
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Session Info Bar */}
        <div className="session-info-bar">
          <div className="info-item">
            <span className="info-icon">📅</span>
            <div>
              <span className="info-label">Date</span>
              <span className="info-value">
                {sessionDateTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">🕐</span>
            <div>
              <span className="info-label">Time</span>
              <span className="info-value">
                {sessionDateTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">📍</span>
            <div>
              <span className="info-label">Location</span>
              <span className="info-value">{session.location || 'Not specified'}</span>
            </div>
          </div>

          <div className="info-item">
            <span className="info-icon">👤</span>
            <div>
              <span className="info-label">Organized By</span>
              <span className="info-value">{session.created_by_name || 'System'}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="details-tabs">
          <button
            className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📋 Details
          </button>
          <button
            className={`tab-button ${activeTab === 'order-of-business' ? 'active' : ''}`}
            onClick={() => setActiveTab('order-of-business')}
          >
            📋 Order of Business
          </button>
          <button
            className={`tab-button ${activeTab === 'agenda' ? 'active' : ''}`}
            onClick={() => setActiveTab('agenda')}
          >
            📜 Agenda
          </button>
          <button
            className={`tab-button ${activeTab === 'ordinances' ? 'active' : ''}`}
            onClick={() => setActiveTab('ordinances')}
          >
            📃 Ordinances ({ordinances.length})
          </button>
          <button
            className={`tab-button ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            👥 Participants ({participants.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="details-content">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="tab-pane details-pane">
              <div className="details-grid">
                {/* Session Info */}
                <section className="detail-section">
                  <h3>📄 Session Information</h3>
                  <div className="detail-item">
                    <label>Title:</label>
                    <span>{session.title}</span>
                  </div>
                  <div className="detail-item">
                    <label>Status:</label>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: SESSION_STATUS[status] }}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Date & Time:</label>
                    <span>
                      {sessionDateTime.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })} at {sessionDateTime.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Location:</label>
                    <span>{session.location || 'Not specified'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Organized By:</label>
                    <span>{session.created_by_name || 'System'}</span>
                  </div>
                </section>

                {/* Agenda Summary */}
                <section className="detail-section full-width">
                  <h3>📋 Agenda</h3>
                  <div className="detail-text">
                    {session.agenda
                      ? session.agenda
                      : 'See the Agenda tab for scheduled ordinances.'}
                  </div>
                </section>

                {/* Notes */}
                {session.notes && (
                  <section className="detail-section full-width">
                    <h3>📝 Notes</h3>
                    <div className="detail-text">
                      {session.notes}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}

          {/* Agenda Tab */}
          {activeTab === 'order-of-business' && (
            <div className="tab-pane order-of-business-pane">
              <h3>📋 Order of Business</h3>
              <OrderOfBusinessPanel sessionId={sessionId} />
            </div>
          )}

          {/* Agenda Tab */}
          {activeTab === 'agenda' && (
            <div className="tab-pane agenda-pane">
              <h3>Session Agenda</h3>
              <SessionAgendaPanel sessionId={sessionId} />
            </div>
          )}

          {/* Ordinances Tab */}
          {activeTab === 'ordinances' && (
            <div className="tab-pane ordinances-pane">
              <h3>Ordinances in this Session</h3>
              {ordinances && ordinances.length > 0 ? (
                <div className="ordinances-grid">
                  {ordinances.map((ordinance) => (
                    <div key={ordinance.id} className="ordinance-card">
                      <div className="card-header">
                        <h4>{ordinance.title}</h4>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: {
                              'Draft': '#95a5a6',
                              'Submitted': '#3498db',
                              'Under Review': '#f39c12',
                              'Approved': '#27ae60',
                              'Published': '#2ecc71',
                            }[ordinance.status] || '#95a5a6',
                          }}
                        >
                          {ordinance.status}
                        </span>
                      </div>
                      <div className="card-body">
                        <p className="ordinance-number">
                          <strong>No:</strong> {ordinance.ordinance_number || 'Pending'}
                        </p>
                        <p className="ordinance-proposer">
                          <strong>Proposer:</strong> {ordinance.proposer_name}
                        </p>
                        <p className="ordinance-description">
                          {ordinance.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <p className="text-muted">No ordinances added to this session yet</p>
                </div>
              )}
            </div>
          )}

          {/* Participants Tab */}
          {activeTab === 'participants' && (
            <div className="tab-pane participants-pane">
              <h3>Session Participants</h3>
              {participants && participants.length > 0 ? (
                <div className="participants-list">
                  <table className="participants-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => (
                        <tr key={participant.id}>
                          <td className="name-cell">{participant.name}</td>
                          <td className="role-cell">{participant.role || 'Member'}</td>
                          <td className="email-cell">{participant.email}</td>
                          <td className="status-cell">
                            <span className="status-indicator">
                              {participant.attendance_status || 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p className="text-muted">No participants assigned yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="delete-modal-overlay">
            <div className="delete-modal">
              <h3>🗑️ Delete Session?</h3>
              <p>Are you sure you want to delete this session?</p>
              <p className="warning-text">
                ⚠️ This action cannot be undone. All associated records will be affected.
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="btn-cancel"
                >
                  Keep Session
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-danger"
                >
                  {deleting ? 'Deleting...' : 'Delete Session'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}