import { useState, useEffect } from 'react';
import api from '../api/api';
import '../styles/OrdinanceList.css';

const STATUS_COLORS = {
  'Draft': '#95a5a6',
  'Submitted': '#3498db',
  'Under Review': '#f39c12',
  'Approved': '#27ae60',
  'Rejected': '#e74c3c',
  'Published': '#2ecc71',
  'Archived': '#7f8c8d',
};

const STATUS_BADGES = {
  'Draft': 'badge-secondary',
  'Submitted': 'badge-info',
  'Under Review': 'badge-warning',
  'Approved': 'badge-success',
  'Rejected': 'badge-danger',
  'Published': 'badge-success',
  'Archived': 'badge-secondary',
};

export default function OrdinanceList() {
  const [ordinances, setOrdinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedOrdinance, setSelectedOrdinance] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchOrdinances();
  }, []);

  const fetchOrdinances = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ordinances');
      setOrdinances(res.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load ordinances. Please try again.');
      console.error('Error fetching ordinances:', err);
      setOrdinances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (ordinance) => {
    setSelectedOrdinance(ordinance);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedOrdinance(null);
  };

  // Filter ordinances based on search and status
  const filteredOrdinances = ordinances.filter(o => {
    const matchSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusColor = (status) => {
    return STATUS_COLORS[status] || '#95a5a6';
  };

  const getStatusBadgeClass = (status) => {
    return STATUS_BADGES[status] || 'badge-secondary';
  };

  const uniqueStatuses = [...new Set(ordinances.map(o => o.status))];

  if (loading) {
    return (
      <div className="ordinance-list-container">
        <h3>Ordinances</h3>
        <div className="loading-spinner">
          <p>Loading ordinances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ordinance-list-container">
      <div className="ordinance-header">
        <h3>Ordinances</h3>
        <p className="ordinance-count">Total: {ordinances.length}</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="ordinance-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search ordinances by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="status-filter">
          <label htmlFor="statusFilter">Filter by Status:</label>
          <select
            id="statusFilter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <button onClick={fetchOrdinances} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      {/* Empty State */}
      {filteredOrdinances.length === 0 ? (
        <div className="empty-state">
          <p>📋 No ordinances found</p>
          {searchTerm && <p className="text-muted">Try adjusting your search terms</p>}
        </div>
      ) : (
        <>
          {/* Ordinances Table */}
          <div className="ordinance-table-wrapper">
            <table className="ordinance-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Proposer</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrdinances.map((ordinance) => (
                  <tr key={ordinance.id} className="ordinance-row">
                    <td className="title-cell">
                      <strong>{ordinance.title}</strong>
                    </td>
                    <td className="number-cell">
                      {ordinance.ordinance_number || 'N/A'}
                    </td>
                    <td className="status-cell">
                      <span
                        className={`badge ${getStatusBadgeClass(ordinance.status)}`}
                        style={{ backgroundColor: getStatusColor(ordinance.status) }}
                      >
                        {ordinance.status}
                      </span>
                    </td>
                    <td className="proposer-cell">
                      {ordinance.proposer_name || 'System'}
                    </td>
                    <td className="date-cell">
                      {ordinance.created_at ? new Date(ordinance.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => handleViewDetails(ordinance)}
                        className="btn-small btn-info"
                        aria-label={`View details for ${ordinance.title}`}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details Modal */}
          {showDetails && selectedOrdinance && (
            <div className="modal-overlay" onClick={handleCloseDetails}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h4>{selectedOrdinance.title}</h4>
                  <button
                    onClick={handleCloseDetails}
                    className="btn-close"
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </div>

                <div className="modal-body">
                  <div className="detail-row">
                    <label>Status:</label>
                    <span
                      className={`badge ${getStatusBadgeClass(selectedOrdinance.status)}`}
                      style={{ backgroundColor: getStatusColor(selectedOrdinance.status) }}
                    >
                      {selectedOrdinance.status}
                    </span>
                  </div>

                  <div className="detail-row">
                    <label>Ordinance Number:</label>
                    <span>{selectedOrdinance.ordinance_number || 'Pending'}</span>
                  </div>

                  <div className="detail-row">
                    <label>Proposer:</label>
                    <span>{selectedOrdinance.proposer_name || 'System'}</span>
                  </div>

                  <div className="detail-row">
                    <label>Date Submitted:</label>
                    <span>
                      {selectedOrdinance.created_at
                        ? new Date(selectedOrdinance.created_at).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>

                  {selectedOrdinance.approved_date && (
                    <div className="detail-row">
                      <label>Date Approved:</label>
                      <span>
                        {new Date(selectedOrdinance.approved_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  <div className="detail-section">
                    <label>Description:</label>
                    <p className="description-text">
                      {selectedOrdinance.description || 'No description provided'}
                    </p>
                  </div>

                  {selectedOrdinance.content && (
                    <div className="detail-section">
                      <label>Full Content:</label>
                      <div className="content-text">
                        {selectedOrdinance.content}
                      </div>
                    </div>
                  )}

                  {selectedOrdinance.remarks && (
                    <div className="detail-section">
                      <label>Remarks:</label>
                      <p className="remarks-text">
                        {selectedOrdinance.remarks}
                      </p>
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <button onClick={handleCloseDetails} className="btn-secondary">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
