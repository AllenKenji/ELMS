import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import ResolutionForm from './ResolutionForm';
import ResolutionDetails from './ResolutionDetails';
import '../../styles/ResolutionList.css';

const STATUS_COLORS = {
  'Draft': '#95a5a6',
  'Submitted': '#3498db',
  'Under Review': '#f39c12',
  'Approved': '#27ae60',
  'Published': '#2ecc71',
  'Rejected': '#e74c3c',
};

export default function ResolutionList() {
  const { user } = useAuth();
  const [resolutions, setResolutions] = useState([]);
  const [filteredResolutions, setFilteredResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showForm, setShowForm] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState(null);
  const [editingResolution, setEditingResolution] = useState(null);

  // Fetch resolutions
  const fetchResolutions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/resolutions');
      setResolutions(res.data || []);
    } catch (err) {
      setError('Failed to load resolutions');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchResolutions();
  }, []);

  // Filter and sort
  useEffect(() => {
    let filtered = [...resolutions];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.resolution_number?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    setFilteredResolutions(filtered);
  }, [resolutions, searchTerm, statusFilter, sortBy]);

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resolution?')) return;

    try {
      await api.delete(`/resolutions/${id}`);
      setResolutions(resolutions.filter(r => r.id !== id));
      setSelectedResolution(null);
    } catch (err) {
      setError('Failed to delete resolution');
      console.error('Error:', err);
    }
  };

  // Can perform actions
  const canEdit = ['Admin', 'Secretary'].includes(user?.role);
  const canDelete = ['Admin'].includes(user?.role);
  const canCreate = ['Admin', 'Secretary'].includes(user?.role);

  return (
    <div className="resolution-list-container">
      {/* Header */}
      <div className="list-header">
        <div className="header-content">
          <h3>Resolutions</h3>
          <p className="header-subtitle">View and manage community resolutions</p>
        </div>

        {canCreate && (
          <button
            className="btn-new-resolution"
            onClick={() => {
              setEditingResolution(null);
              setShowForm(true);
            }}
          >
            + New Resolution
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="list-filters">
        <div className="search-box">
          <input
            type="text"
            className="search-input"
            placeholder="Search by title, number, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="sort-filter">
          <label>Status</label>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Published">Published</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <div className="sort-filter">
          <label>Sort By</label>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
          </select>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <p>
          Showing <strong>{filteredResolutions.length}</strong> of{' '}
          <strong>{resolutions.length}</strong> resolutions
        </p>
      </div>

      {/* Loading / Empty State */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading resolutions...</p>
        </div>
      ) : filteredResolutions.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">📋</p>
          <h4>No Resolutions Found</h4>
          <p className="text-muted">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filters'
              : 'No resolutions have been created yet'}
          </p>
          {canCreate && (
            <button
              className="btn-empty-action"
              onClick={() => {
                setEditingResolution(null);
                setShowForm(true);
              }}
            >
              Create First Resolution
            </button>
          )}
        </div>
      ) : (
        /* Resolutions Grid */
        <div className="resolutions-grid">
          {filteredResolutions.map(resolution => (
            <div key={resolution.id} className="resolution-card">
              {/* Card Status */}
              <div className="card-status">
                <span
                  className="status-badge"
                  style={{
                    backgroundColor: STATUS_COLORS[resolution.status] + '30',
                    color: STATUS_COLORS[resolution.status],
                  }}
                >
                  {resolution.status}
                </span>
              </div>

              {/* Card Content */}
              <div className="card-content">
                <h4 className="resolution-title">{resolution.title}</h4>

                <div className="resolution-meta">
                  {resolution.resolution_number && (
                    <span className="meta-item">
                      <strong>#{resolution.resolution_number}</strong>
                    </span>
                  )}
                  <span className="meta-item">
                    📅{' '}
                    {new Date(resolution.created_at).toLocaleDateString()}
                  </span>
                </div>

                <p className="resolution-description">{resolution.description}</p>

                {resolution.proposer_name && (
                  <p className="resolution-proposer">
                    by <strong>{resolution.proposer_name}</strong>
                  </p>
                )}
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <button
                  className="btn-view"
                  onClick={() => setSelectedResolution(resolution)}
                >
                  View Details
                </button>
                {canEdit && (
                  <button
                    className="btn-edit-card"
                    onClick={() => {
                      setEditingResolution(resolution);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn-delete-card"
                    onClick={() => handleDelete(resolution.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ResolutionForm
          resolutionId={editingResolution?.id}
          initialData={editingResolution}
          onSuccess={() => {
            setShowForm(false);
            setEditingResolution(null);
            fetchResolutions();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingResolution(null);
          }}
        />
      )}

      {/* Details Modal */}
      {selectedResolution && (
        <ResolutionDetails
          resolutionId={selectedResolution.id}
          onClose={() => setSelectedResolution(null)}
          onEdit={() => {
            setEditingResolution(selectedResolution);
            setShowForm(true);
          }}
          onDelete={() => {
            handleDelete(selectedResolution.id);
            setSelectedResolution(null);
          }}
        />
      )}
    </div>
  );
}