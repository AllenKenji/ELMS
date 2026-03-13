import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrdinanceForm from '../Ordinances/OrdinanceForm';
import OrdinanceDetails from '../Ordinances/OrdinanceDetails';
import '../../styles/DraftsPage.css';

export default function DraftsPage() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [editingDraft, setEditingDraft] = useState(null);
  const [viewingDraft, setViewingDraft] = useState(null);
  const [actionMsg, setActionMsg] = useState('');

  const fetchDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [ordRes, resRes] = await Promise.all([
        api.get('/ordinances'),
        api.get('/resolutions'),
      ]);

      const ordinanceDrafts = (ordRes.data || [])
        .filter((o) => o.status === 'Draft')
        .map((o) => ({ ...o, itemType: 'Ordinance' }));

      const resolutionDrafts = (resRes.data || [])
        .filter((r) => r.status === 'Draft')
        .map((r) => ({ ...r, itemType: 'Resolution' }));

      setDrafts([...ordinanceDrafts, ...resolutionDrafts]);
    } catch (err) {
      setError('Failed to load drafts. Please try again.');
      console.error('Error fetching drafts:', err);
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const showActionMessage = (msg) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 3500);
  };

  const handleSubmit = async (draft) => {
    try {
      const endpoint = draft.itemType === 'Ordinance' ? '/ordinances' : '/resolutions';
      await api.put(`${endpoint}/${draft.id}/status`, { status: 'Submitted' });
      showActionMessage(`✅ "${draft.title}" has been submitted for review.`);
      fetchDrafts();
    } catch (err) {
      setError('Failed to submit draft. Please try again.');
      console.error('Error submitting draft:', err);
    }
  };

  const handleDelete = async (draft) => {
    if (!window.confirm(`Are you sure you want to delete "${draft.title}"?`)) return;
    try {
      const endpoint = draft.itemType === 'Ordinance' ? '/ordinances' : '/resolutions';
      await api.delete(`${endpoint}/${draft.id}`);
      showActionMessage(`🗑️ "${draft.title}" has been deleted.`);
      fetchDrafts();
    } catch (err) {
      setError('Failed to delete draft. Please try again.');
      console.error('Error deleting draft:', err);
    }
  };

  const canEdit = ['Admin', 'Secretary', 'Councilor'].includes(user?.role);
  const canDelete = ['Admin', 'Secretary'].includes(user?.role);
  const canSubmit = ['Admin', 'Secretary', 'Councilor'].includes(user?.role);

  // Filter & sort
  let filtered = drafts.filter((d) => {
    const matchSearch =
      d.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType || d.itemType === filterType;
    return matchSearch && matchType;
  });

  filtered = filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'type') return a.itemType.localeCompare(b.itemType);
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const stats = {
    total: drafts.length,
    ordinances: drafts.filter((d) => d.itemType === 'Ordinance').length,
    resolutions: drafts.filter((d) => d.itemType === 'Resolution').length,
  };

  if (editingDraft) {
    return (
      <OrdinanceForm
        ordinanceId={editingDraft.itemType === 'Ordinance' ? editingDraft.id : undefined}
        initialData={
          editingDraft.itemType === 'Ordinance'
            ? { title: editingDraft.title, description: editingDraft.description }
            : undefined
        }
        onSuccess={() => {
          setEditingDraft(null);
          fetchDrafts();
        }}
        onCancel={() => setEditingDraft(null)}
      />
    );
  }

  if (viewingDraft) {
    return (
      <OrdinanceDetails
        ordinanceId={viewingDraft.id}
        onClose={() => {
          setViewingDraft(null);
          fetchDrafts();
        }}
        onStatusChange={fetchDrafts}
      />
    );
  }

  if (loading) {
    return (
      <div className="drafts-container">
        <h3>✏️ Drafts</h3>
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading drafts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="drafts-container">
      {/* Header */}
      <div className="drafts-header">
        <div className="header-content">
          <h3>✏️ Drafts</h3>
          <p className="header-subtitle">Ordinances and resolutions in progress</p>
        </div>
        <button onClick={fetchDrafts} className="btn-refresh" title="Refresh">
          🔄
        </button>
      </div>

      {/* Stats */}
      <div className="drafts-stats">
        <div className="draft-stat-card">
          <span className="draft-stat-icon">📋</span>
          <div className="draft-stat-info">
            <span className="draft-stat-value">{stats.total}</span>
            <span className="draft-stat-label">Total Drafts</span>
          </div>
        </div>
        <div className="draft-stat-card ordinance">
          <span className="draft-stat-icon">📜</span>
          <div className="draft-stat-info">
            <span className="draft-stat-value">{stats.ordinances}</span>
            <span className="draft-stat-label">Ordinances</span>
          </div>
        </div>
        <div className="draft-stat-card resolution">
          <span className="draft-stat-icon">📄</span>
          <div className="draft-stat-info">
            <span className="draft-stat-value">{stats.resolutions}</span>
            <span className="draft-stat-label">Resolutions</span>
          </div>
        </div>
      </div>

      {/* Action Message */}
      {actionMsg && (
        <div className="alert alert-success" role="status">
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Filters */}
      <div className="drafts-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search drafts by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-group">
          <div className="type-filter">
            <label htmlFor="typeFilter">Type:</label>
            <select
              id="typeFilter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="Ordinance">Ordinance</option>
              <option value="Resolution">Resolution</option>
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
              <option value="type">Type</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results info */}
      {filtered.length > 0 && (
        <div className="results-info">
          <p>
            Showing <strong>{filtered.length}</strong> of <strong>{drafts.length}</strong> drafts
          </p>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✏️</div>
          <h4>No drafts found</h4>
          <p className="text-muted">
            {searchTerm || filterType
              ? 'Try adjusting your search or filters'
              : 'There are no draft ordinances or resolutions'}
          </p>
        </div>
      ) : (
        <div className="drafts-list">
          {filtered.map((draft) => {
            const proposerName =
              draft.proposer_name ||
              draft.submitted_by_name ||
              draft.author_name ||
              'Unknown';
            const createdDate = draft.created_at
              ? new Date(draft.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'N/A';

            return (
              <div key={`${draft.itemType}-${draft.id}`} className="draft-card">
                <div className={`draft-type-indicator ${draft.itemType.toLowerCase()}`}>
                  {draft.itemType === 'Ordinance' ? '📜' : '📄'}
                </div>
                <div className="draft-card-content">
                  <div className="draft-card-header">
                    <div>
                      <span className={`type-badge ${draft.itemType.toLowerCase()}`}>
                        {draft.itemType}
                      </span>
                      <h4 className="draft-title">{draft.title}</h4>
                    </div>
                    <span className="status-badge-draft">Draft</span>
                  </div>

                  {draft.description && (
                    <p className="draft-description">{draft.description}</p>
                  )}

                  <div className="draft-meta">
                    <span className="meta-item">👤 {proposerName}</span>
                    <span className="meta-item">📅 {createdDate}</span>
                    {(draft.ordinance_number || draft.resolution_number) && (
                      <span className="meta-item">
                        #️⃣ {draft.ordinance_number || draft.resolution_number}
                      </span>
                    )}
                  </div>

                  <div className="draft-actions">
                    {draft.itemType === 'Ordinance' && (
                      <button
                        onClick={() => setViewingDraft(draft)}
                        className="btn-action btn-view"
                        aria-label={`View ${draft.title}`}
                      >
                        👁️ View
                      </button>
                    )}
                    {canEdit && draft.itemType === 'Ordinance' && (
                      <button
                        onClick={() => setEditingDraft(draft)}
                        className="btn-action btn-edit"
                        aria-label={`Edit ${draft.title}`}
                      >
                        ✏️ Edit
                      </button>
                    )}
                    {canSubmit && (
                      <button
                        onClick={() => handleSubmit(draft)}
                        className="btn-action btn-submit"
                        aria-label={`Submit ${draft.title}`}
                      >
                        📤 Submit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(draft)}
                        className="btn-action btn-delete"
                        aria-label={`Delete ${draft.title}`}
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
