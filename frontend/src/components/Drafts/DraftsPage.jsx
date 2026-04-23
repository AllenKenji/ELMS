import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrdinanceForm from '../Ordinances/OrdinanceForm';
import ResolutionForm from '../Resolutions/ResolutionForm';
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
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState(null);
  const [proposingDraft, setProposingDraft] = useState(null);
  const [proposingInitialData, setProposingInitialData] = useState(null);

  const canCreate = ['Admin', 'Councilor', 'Vice Mayor'].includes(user?.role ?? '');

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
      setError('');
      const detailEndpoint = draft.itemType === 'Ordinance'
        ? `/ordinances/${draft.id}`
        : `/resolutions/${draft.id}`;
      const detailRes = await api.get(detailEndpoint);
      const detail = detailRes?.data || draft;

      if (draft.itemType === 'Ordinance') {
        setProposingInitialData({
          title: detail.title || '',
          ordinance_number: '',
          description: detail.description || '',
          content: detail.content || '',
          co_authors: detail.co_authors || '',
          whereas_clauses: detail.whereas_clauses || '',
          effectivity_clause: detail.effectivity_clause || '',
          attachments: detail.attachments || [],
          remarks: detail.remarks || '',
        });
      } else {
        setProposingInitialData({
          title: detail.title || '',
          resolution_number: '',
          description: detail.description || '',
          content: detail.content || '',
          co_authors: detail.co_authors || '',
          whereas_clauses: detail.whereas_clauses || '',
          effectivity_clause: detail.effectivity_clause || '',
          attachments: detail.attachments || [],
          remarks: detail.remarks || '',
        });
      }
      setProposingDraft(draft);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to load draft details. Please try again.');
      console.error('Error preparing draft for submission:', err);
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
  const canSubmit = ['Admin', 'Councilor'].includes(user?.role);

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

  if (proposingDraft) {
    if (proposingDraft.itemType === 'Ordinance') {
      return (
        <OrdinanceForm
          autoSubmitAfterCreate
          initialStatusOnCreate="Submitted"
          initialData={proposingInitialData}
          onSuccess={() => {
            setProposingDraft(null);
            setProposingInitialData(null);
            fetchDrafts();
            showActionMessage('✅ New proposed measure created. Original draft is unchanged.');
          }}
          onCancel={() => {
            setProposingDraft(null);
            setProposingInitialData(null);
          }}
        />
      );
    } else {
      return (
        <ResolutionForm
          initialStatusOnCreate="Submitted"
          initialData={proposingInitialData}
          onSuccess={() => {
            setProposingDraft(null);
            setProposingInitialData(null);
            fetchDrafts();
            showActionMessage('✅ New proposed measure created. Original draft is unchanged.');
          }}
          onCancel={() => {
            setProposingDraft(null);
            setProposingInitialData(null);
          }}
        />
      );
    }
  }

  if (editingDraft) {
    if (editingDraft.itemType === 'Ordinance') {
      return (
        <OrdinanceForm
          ordinanceId={editingDraft.id}
          initialData={{
            title: editingDraft.title || '',
            ordinance_number: editingDraft.ordinance_number || '',
            description: editingDraft.description || '',
            content: editingDraft.content || '',
            remarks: editingDraft.remarks || '',
          }}
          onSuccess={() => {
            setEditingDraft(null);
            fetchDrafts();
          }}
          onCancel={() => setEditingDraft(null)}
        />
      );
    } else {
      return (
        <ResolutionForm
          resolutionId={editingDraft.id}
          initialData={{
            title: editingDraft.title || '',
            resolution_number: editingDraft.resolution_number || '',
            description: editingDraft.description || '',
            content: editingDraft.content || '',
            remarks: editingDraft.remarks || '',
          }}
          onSuccess={() => {
            setEditingDraft(null);
            fetchDrafts();
          }}
          onCancel={() => setEditingDraft(null)}
        />
      );
    }
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

  if (selectedFormType === 'Ordinance') {
    return (
      <OrdinanceForm
        onSuccess={() => {
          setSelectedFormType(null);
          fetchDrafts();
        }}
        onCancel={() => setSelectedFormType(null)}
      />
    );
  }

  if (selectedFormType === 'Resolution') {
    return (
      <ResolutionForm
        onSuccess={() => {
          setSelectedFormType(null);
          fetchDrafts();
        }}
        onCancel={() => setSelectedFormType(null)}
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
        <div className="header-actions">
          {canCreate && (
            <button
              onClick={() => setShowTypeSelector(true)}
              className="btn-new-draft"
              aria-label="Create new draft"
            >
              ➕ Create Draft
            </button>
          )}
          <button onClick={fetchDrafts} className="btn-refresh" title="Refresh">
            🔄
          </button>
        </div>
      </div>

      {/* Type Selector Modal */}
      {showTypeSelector && (
        <div className="type-selector-overlay">
          <div className="type-selector-modal">
            <div className="type-selector-header">
              <h4>✏️ New Draft</h4>
              <button
                className="btn-close-selector"
                onClick={() => setShowTypeSelector(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="type-selector-subtitle">Select the type of draft you want to create:</p>
            <div className="type-selector-options">
              <button
                className="type-option-btn ordinance-option"
                onClick={() => {
                  setShowTypeSelector(false);
                  setSelectedFormType('Ordinance');
                }}
              >
                <span className="type-option-icon">⚖️</span>
                <strong>Ordinance</strong>
                <span className="type-option-desc">Legally binding local law</span>
              </button>
              <button
                className="type-option-btn resolution-option"
                onClick={() => {
                  setShowTypeSelector(false);
                  setSelectedFormType('Resolution');
                }}
              >
                <span className="type-option-icon">📣</span>
                <strong>Resolution</strong>
                <span className="type-option-desc">Non-binding expression or declaration</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {canEdit && (
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
                        aria-label={`Use ${draft.title} as a proposed measure`}
                      >
                        📤 Use as Proposed Measure
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
