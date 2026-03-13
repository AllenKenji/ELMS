import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import CommitteeForm from './CommitteeForm';
import CommitteeDetails from './CommitteeDetails';
import '../../styles/CommitteeList.css';

export default function CommitteeList() {
  const { user } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [filteredCommittees, setFilteredCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCommittee, setSelectedCommittee] = useState(null);
  const [editingCommittee, setEditingCommittee] = useState(null);

  const fetchCommittees = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/committees');
      setCommittees(res.data || []);
    } catch (err) {
      setError('Failed to load committees');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  useEffect(() => {
    let filtered = [...committees];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.description?.toLowerCase().includes(term) ||
          c.chair_name?.toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    setFilteredCommittees(filtered);
  }, [committees, searchTerm, statusFilter]);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this committee?')) return;
    try {
      await api.delete(`/committees/${id}`);
      setCommittees(committees.filter((c) => c.id !== id));
      setSelectedCommittee(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete committee');
      console.error('Error:', err);
    }
  };

  const canCreate = ['Admin', 'Secretary'].includes(user?.role);
  const canEdit = ['Admin', 'Secretary'].includes(user?.role);
  const canDelete = ['Admin'].includes(user?.role);

  return (
    <div className="committee-list-container">
      {/* Header */}
      <div className="list-header">
        <div className="header-content">
          <h3>Committees</h3>
          <p className="header-subtitle">View and manage legislative committees</p>
        </div>

        {canCreate && (
          <button
            className="btn-new-committee"
            onClick={() => {
              setEditingCommittee(null);
              setShowForm(true);
            }}
          >
            + New Committee
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
            placeholder="Search by name, description, or chair..."
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
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <p>
          Showing <strong>{filteredCommittees.length}</strong> of{' '}
          <strong>{committees.length}</strong> committees
        </p>
      </div>

      {/* Loading / Empty / Grid */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading committees...</p>
        </div>
      ) : filteredCommittees.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">🏛️</p>
          <h4>No Committees Found</h4>
          <p className="text-muted">
            {searchTerm || statusFilter
              ? 'Try adjusting your search or filters'
              : 'No committees have been created yet'}
          </p>
          {canCreate && (
            <button
              className="btn-empty-action"
              onClick={() => {
                setEditingCommittee(null);
                setShowForm(true);
              }}
            >
              Create First Committee
            </button>
          )}
        </div>
      ) : (
        <div className="committees-grid">
          {filteredCommittees.map((committee) => (
            <div key={committee.id} className="committee-card">
              <div className="card-status">
                <span
                  className={`status-badge ${
                    committee.status === 'Active' ? 'status-active' : 'status-inactive'
                  }`}
                >
                  {committee.status}
                </span>
              </div>

              <div className="card-content">
                <h4 className="committee-name">{committee.name}</h4>

                <div className="committee-meta">
                  {committee.chair_name && (
                    <span className="meta-item">👤 {committee.chair_name}</span>
                  )}
                  <span className="meta-item">
                    📅 {new Date(committee.created_at).toLocaleDateString()}
                  </span>
                </div>

                {committee.description && (
                  <p className="committee-description">{committee.description}</p>
                )}
              </div>

              <div className="card-footer">
                <button
                  className="btn-view"
                  onClick={() => setSelectedCommittee(committee)}
                >
                  View Details
                </button>
                {canEdit && (
                  <button
                    className="btn-edit-card"
                    onClick={() => {
                      setEditingCommittee(committee);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                )}
                {canDelete && (
                  <button
                    className="btn-delete-card"
                    onClick={() => handleDelete(committee.id)}
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
        <CommitteeForm
          committeeId={editingCommittee?.id}
          initialData={editingCommittee}
          onSuccess={() => {
            setShowForm(false);
            setEditingCommittee(null);
            fetchCommittees();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingCommittee(null);
          }}
        />
      )}

      {/* Details Modal */}
      {selectedCommittee && (
        <CommitteeDetails
          committeeId={selectedCommittee.id}
          onClose={() => setSelectedCommittee(null)}
          onEdit={() => {
            setEditingCommittee(selectedCommittee);
            setShowForm(true);
            setSelectedCommittee(null);
          }}
          onDelete={() => {
            handleDelete(selectedCommittee.id);
          }}
        />
      )}
    </div>
  );
}
