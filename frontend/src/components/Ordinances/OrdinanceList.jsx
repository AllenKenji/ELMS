import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrdinanceDetails from './OrdinanceDetails';
import '../../styles/OrdinanceList.css';

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
  const { user } = useAuth();
  const [ordinances, setOrdinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedOrdinance, setSelectedOrdinance] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Memoize fetchOrdinances to prevent dependency issues
  const fetchOrdinances = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');
      
      // Fetch ordinances for current user only
      const res = await api.get(`/ordinances?proposer_id=${user.id}`);
      setOrdinances((res.data || []).filter((ordinance) => ordinance.status === 'Approved'));
    } catch (err) {
      setError('Failed to load ordinances. Please try again.');
      console.error('Error fetching ordinances:', err);
      setOrdinances([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchOrdinances();
  }, [fetchOrdinances]);

  const canDelete = ['Admin', 'Secretary'].includes(user?.role);

  const handleViewDetails = (ordinance) => {
    setSelectedOrdinance(ordinance);
    setShowDetailsModal(true);
  };

  const handleDelete = async (ordinance) => {
    if (!window.confirm(`Are you sure you want to delete "${ordinance.title}"?`)) return;
    try {
      await api.delete(`/ordinances/${ordinance.id}`);
      fetchOrdinances();
    } catch (err) {
      setError('Failed to delete ordinance. Please try again.');
      console.error('Error deleting ordinance:', err);
    }
  };

  // Filter ordinances based on search and status
  let filteredOrdinances = ordinances.filter(o => {
    const matchSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        o.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = !filterStatus || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Sort ordinances
  filteredOrdinances = filteredOrdinances.sort((a, b) => {
    switch (sortBy) {
      case 'title':
        return a.title.localeCompare(b.title);
      case 'status':
        return (a.status || '').localeCompare(b.status || '');
      case 'date':
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  const getStatusColor = (status) => {
    return STATUS_COLORS[status] || '#95a5a6';
  };

  const getStatusBadgeClass = (status) => {
    return STATUS_BADGES[status] || 'badge-secondary';
  };

  const uniqueStatuses = [...new Set(ordinances.map(o => o.status))].sort();

  // Statistics
  const stats = {
    total: ordinances.length,
    approved: ordinances.filter(o => o.status === 'Approved').length,
  };

  if (loading) {
    return (
      <div className="ordinance-list-container">
        <h3>My Ordinances</h3>
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading ordinances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ordinance-list-container">
      {/* Header with Stats */}
      <div className="ordinance-header">
        <div className="header-content">
          <h3>📜 Ordinances</h3>
          <p className="header-subtitle">Enacted ordinances from approved proposed measures</p>
        </div>
        <button onClick={fetchOrdinances} className="btn-refresh" title="Refresh list" aria-label="Refresh ordinances list">
          🔄
        </button>
      </div>

      {/* Statistics Cards */}
      {ordinances.length > 0 && (
        <div className="stats-container">
          <div className="stat-card">
            <div className="stat-icon">📋</div>
            <div className="stat-info">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-label">Approved</span>
              <span className="stat-value">{stats.approved}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <div>
            <strong>Error</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="ordinance-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search ordinances by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <div className="status-filter">
            <label htmlFor="statusFilter">Status:</label>
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

          <div className="sort-filter">
            <label htmlFor="sortBy">Sort by:</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="date">Date (Newest)</option>
              <option value="title">Title (A-Z)</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>

        <button onClick={fetchOrdinances} className="btn-refresh" title="Refresh list" aria-label="Refresh ordinances list">
          🔄
        </button>
      </div>

      {/* Empty State */}
      {filteredOrdinances.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h4>No ordinances found</h4>
          {searchTerm ? (
            <p className="text-muted">Try adjusting your search terms</p>
          ) : (
            <p className="text-muted">No approved ordinances found yet.</p>
          )}
        </div>
      ) : (
        <>
          {/* Results Info */}
          <div className="results-info">
            <p>Showing <strong>{filteredOrdinances.length}</strong> of <strong>{ordinances.length}</strong> ordinances</p>
          </div>

          {/* Ordinances Table */}
          <div className="ordinance-table-wrapper">
            <table className="ordinance-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Date Submitted</th>
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
                      <code>{ordinance.ordinance_number || 'Pending'}</code>
                    </td>
                    <td className="status-cell">
                      <span
                        className={`badge ${getStatusBadgeClass(ordinance.status)}`}
                        style={{ backgroundColor: getStatusColor(ordinance.status) }}
                      >
                        {ordinance.status}
                      </span>
                    </td>
                    <td className="date-cell">
                      {ordinance.created_at
                        ? new Date(ordinance.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'N/A'}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => handleViewDetails(ordinance)}
                        className="btn-small btn-info"
                        aria-label={`View details for ${ordinance.title}`}
                      >
                        👁️ View
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(ordinance)}
                          className="btn-small btn-danger"
                          aria-label={`Delete ${ordinance.title}`}
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details Modal */}
          {showDetailsModal && selectedOrdinance && (
            <OrdinanceDetails
              ordinanceId={selectedOrdinance.id}
              onClose={() => {
                setShowDetailsModal(false);
                setSelectedOrdinance(null);
              }}
              onStatusChange={() => {
                fetchOrdinances();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}