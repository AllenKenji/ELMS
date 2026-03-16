import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/ResolutionDetails.css';

const STATUS_COLORS = {
  'Draft': '#95a5a6',
  'Submitted': '#3498db',
  'Under Review': '#f39c12',
  'Approved': '#27ae60',
  'Published': '#2ecc71',
  'Rejected': '#e74c3c',
};

export default function ResolutionDetails({ resolutionId, onClose, onEdit, onDelete }) {
  const { user } = useAuth();
  const [resolution, setResolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('content');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch resolution
  useEffect(() => {
    const fetchResolution = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/resolutions/${resolutionId}`);
        setResolution(res.data);
      } catch (err) {
        setError('Failed to load resolution details');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResolution();
  }, [resolutionId]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/resolutions/${resolutionId}`);
      setShowDeleteModal(false);
      onDelete?.();
    } catch (err) {
      setError('Failed to delete resolution');
      console.error('Error:', err);
      setDeleting(false);
    }
  };

  const canEdit = ['Admin', 'Secretary'].includes(user?.role);
  const canDelete = ['Admin'].includes(user?.role);

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

  return (
    <div className="resolution-details-modal">
      <div className="modal-overlay" onClick={onClose}></div>

      <div className="modal-content">
        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h2>{resolution.title}</h2>
            <span
              className="status-badge-large"
              style={{
                backgroundColor: STATUS_COLORS[resolution.status] + '30',
                color: STATUS_COLORS[resolution.status],
              }}
            >
              {resolution.status}
            </span>
          </div>
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            📄 Content
          </button>
          <button
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            ℹ️ Information
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {activeTab === 'content' && (
            <div className="tab-content">
              <div className="content-section">
                <h3>Description</h3>
                <p>{resolution.description}</p>
              </div>

              <div className="content-section">
                <h3>Full Text</h3>
                <div className="resolution-text">
                  {resolution.content}
                </div>
              </div>

              {resolution.remarks && (
                <div className="content-section">
                  <h3>Notes</h3>
                  <p>{resolution.remarks}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'info' && (
            <div className="tab-content">
              <div className="info-grid">
                <div className="info-item">
                  <label>Resolution Number</label>
                  <p>{resolution.resolution_number || 'Auto-generated'}</p>
                </div>

                <div className="info-item">
                  <label>Status</label>
                  <p>{resolution.status}</p>
                </div>

                <div className="info-item">
                  <label>Proposer</label>
                  <p>{resolution.proposer_name || 'Unknown'}</p>
                </div>

                <div className="info-item">
                  <label>Created</label>
                  <p>{new Date(resolution.created_at).toLocaleString()}</p>
                </div>

                {resolution.updated_at && (
                  <div className="info-item">
                    <label>Updated</label>
                    <p>{new Date(resolution.updated_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-cancel"
            onClick={onClose}
          >
            Close
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleDownloadPdf}
          >
            📄 Download PDF
          </button>

          {canEdit && (
            <button
              className="btn btn-secondary"
              onClick={onEdit}
            >
              ✏️ Edit
            </button>
          )}

          {canDelete && (
            <button
              className="btn btn-danger"
              onClick={() => setShowDeleteModal(true)}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="delete-confirmation">
          <div className="confirm-content">
            <h3>Delete Resolution?</h3>
            <p>Are you sure you want to delete this resolution? This action cannot be undone.</p>

            <div className="confirm-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}