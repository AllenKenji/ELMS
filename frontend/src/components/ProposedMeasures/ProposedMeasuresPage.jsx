import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrdinanceForm from '../Ordinances/OrdinanceForm';
import ResolutionForm from '../Resolutions/ResolutionForm';
import OrdinanceDetails from '../Ordinances/OrdinanceDetails';
import RichTextContent from '../common/RichTextContent';
import '../../styles/ProposedMeasuresPage.css';

const STATUS_COLORS = {
  Submitted: '#3498db',
  'Under Review': '#f39c12',
  Approved: '#27ae60',
  Rejected: '#e74c3c',
};

const STATUS_ICONS = {
  Submitted: '📤',
  'Under Review': '🔍',
  Approved: '✅',
  Rejected: '❌',
};

function getProgressStepClassName(isActive, isCompleted) {
  const classes = ['progress-step'];
  if (isActive) classes.push('active');
  if (isCompleted) classes.push('completed');
  return classes.join(' ');
}

export default function ProposedMeasuresPage() {
  const { user } = useAuth();
  const [measures, setMeasures] = useState([]);
  const [draftOptions, setDraftOptions] = useState([]);
  const [ordinanceSessions, setOrdinanceSessions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [viewingMeasure, setViewingMeasure] = useState(null);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showDraftSelector, setShowDraftSelector] = useState(false);
  const [selectedFormType, setSelectedFormType] = useState(null);
  const [loadingDraftOptions, setLoadingDraftOptions] = useState(false);
  const [activatingDraftKey, setActivatingDraftKey] = useState('');
  const [deletingMeasureKey, setDeletingMeasureKey] = useState('');
  const [draftFormInitialData, setDraftFormInitialData] = useState(null);

  const canCreate = ['Admin', 'Councilor', 'Vice Mayor'].includes(user?.role ?? '');
  const canDelete = user?.role === 'Admin';

  const showActionMessage = (message) => {
    setActionMsg(message);
    setTimeout(() => setActionMsg(''), 3500);
  };

  const fetchMeasures = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [ordRes, resRes, sessRes] = await Promise.all([
        api.get('/ordinances'),
        api.get('/resolutions'),
        api.get('/sessions').catch(() => ({ data: [] })),
      ]);

      const PROPOSED_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected'];

      const ordinances = (ordRes.data || [])
        .filter((o) => PROPOSED_STATUSES.includes(o.status))
        .map((o) => ({ ...o, itemType: 'Ordinance' }));

      const resolutions = (resRes.data || [])
        .filter((r) => PROPOSED_STATUSES.includes(r.status))
        .map((r) => ({ ...r, itemType: 'Resolution' }));

      setMeasures([...ordinances, ...resolutions]);

      // Build ordinance -> session lookup from session agenda items
      const fetchedSessions = sessRes.data || [];
      if (fetchedSessions.length > 0) {
        const agendaResults = await Promise.allSettled(
          fetchedSessions.map((s) => api.get(`/sessions/${s.id}/agenda`))
        );
        const sessionMap = {};
        agendaResults.forEach((result, idx) => {
          if (result.status === 'fulfilled') {
            const session = fetchedSessions[idx];
            (result.value.data || []).forEach((item) => {
              const oid = String(item.ordinance_id);
              if (!sessionMap[oid]) sessionMap[oid] = [];
              sessionMap[oid].push(session);
            });
          }
        });
        setOrdinanceSessions(sessionMap);
      }
    } catch (err) {
      setError('Failed to load proposed measures. Please try again.');
      console.error('Error fetching proposed measures:', err);
      setMeasures([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeasures();
  }, [fetchMeasures]);

  const fetchDraftOptions = useCallback(async () => {
    try {
      setLoadingDraftOptions(true);
      setError('');

      const [ordRes, resRes] = await Promise.all([
        api.get('/ordinances'),
        api.get('/resolutions'),
      ]);

      const ordinanceDrafts = (ordRes.data || [])
        .filter((item) => item.status === 'Draft')
        .map((item) => ({ ...item, itemType: 'Ordinance' }));

      const resolutionDrafts = (resRes.data || [])
        .filter((item) => item.status === 'Draft')
        .map((item) => ({ ...item, itemType: 'Resolution' }));

      setDraftOptions([...ordinanceDrafts, ...resolutionDrafts]);
    } catch (err) {
      setDraftOptions([]);
      setError('Failed to load drafts. Please try again.');
      console.error('Error fetching draft options:', err);
    } finally {
      setLoadingDraftOptions(false);
    }
  }, []);

  const openDraftSelector = async () => {
    setShowTypeSelector(false);
    setShowDraftSelector(true);
    await fetchDraftOptions();
  };

  const handleUseDraftAsProposedMeasure = async (draft) => {
    const draftKey = `${draft.itemType}-${draft.id}`;

    try {
      setActivatingDraftKey(draftKey);
      setError('');

      const detailEndpoint = draft.itemType === 'Ordinance'
        ? `/ordinances/${draft.id}`
        : `/resolutions/${draft.id}`;
      const detailRes = await api.get(detailEndpoint);
      const detail = detailRes?.data || draft;

      if (draft.itemType === 'Ordinance') {
        setDraftFormInitialData({
          title: detail.title || '',
          ordinance_number: detail.ordinance_number || '',
          description: detail.description || '',
          content: detail.content || '',
          co_authors: detail.co_authors || '',
          whereas_clauses: detail.whereas_clauses || '',
          effectivity_clause: detail.effectivity_clause || '',
          attachments: detail.attachments || [],
          remarks: detail.remarks || '',
        });
      } else {
        setDraftFormInitialData({
          title: detail.title || '',
          resolution_number: detail.resolution_number || '',
          description: detail.description || '',
          content: detail.content || '',
          co_authors: detail.co_authors || '',
          whereas_clauses: detail.whereas_clauses || '',
          effectivity_clause: detail.effectivity_clause || '',
          attachments: detail.attachments || [],
          remarks: detail.remarks || '',
        });
      }

      setSelectedFormType(draft.itemType);
      setShowDraftSelector(false);
      showActionMessage('Draft loaded for editing. Submitting will create a proposed measure and keep the original draft.');
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to open draft for editing. Please try again.');
      console.error('Error preparing draft for submission:', err);
    } finally {
      setActivatingDraftKey('');
    }
  };

  const handleDeleteMeasure = async (measure) => {
    const measureTypeLabel = measure.itemType?.toLowerCase() || 'measure';
    if (!window.confirm(`Delete this ${measureTypeLabel}: "${measure.title}"? This action cannot be undone.`)) {
      return;
    }

    const measureKey = `${measure.itemType}-${measure.id}`;
    setDeletingMeasureKey(measureKey);
    setError('');

    try {
      if (measure.itemType === 'Ordinance') {
        await api.delete(`/ordinances/${measure.id}`);
      } else {
        await api.delete(`/resolutions/${measure.id}`);
      }

      showActionMessage(`🗑️ "${measure.title}" deleted.`);
      await fetchMeasures();
    } catch (err) {
      setError(err?.response?.data?.error || `Failed to delete ${measureTypeLabel}. Please try again.`);
      console.error('Error deleting proposed measure:', err);
    } finally {
      setDeletingMeasureKey('');
    }
  };

  // Filter & sort
  let filtered = measures.filter((m) => {
    const matchSearch =
      m.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType || m.itemType === filterType;
    const matchStatus = !filterStatus || m.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  filtered = filtered.sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'type') return a.itemType.localeCompare(b.itemType);
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '');
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const stats = {
    total: measures.length,
    submitted: measures.filter((m) => m.status === 'Submitted').length,
    underReview: measures.filter((m) => m.status === 'Under Review').length,
    approved: measures.filter((m) => m.status === 'Approved').length,
    rejected: measures.filter((m) => m.status === 'Rejected').length,
  };

  const uniqueStatuses = [...new Set(measures.map((m) => m.status))].sort();

  if (viewingMeasure) {
    return (
      <OrdinanceDetails
        ordinanceId={viewingMeasure.id}
        onClose={() => {
          setViewingMeasure(null);
          fetchMeasures();
        }}
        onStatusChange={fetchMeasures}
      />
    );
  }

  if (selectedFormType === 'Ordinance') {
    return (
      <OrdinanceForm
        autoSubmitAfterCreate
        initialStatusOnCreate="Submitted"
        initialData={draftFormInitialData}
        onSuccess={() => {
          setDraftFormInitialData(null);
          setSelectedFormType(null);
          fetchMeasures();
          fetchDraftOptions();
        }}
        onCancel={() => {
          setDraftFormInitialData(null);
          setSelectedFormType(null);
        }}
      />
    );
  }

  if (selectedFormType === 'Resolution') {
    return (
      <ResolutionForm
        initialStatusOnCreate="Submitted"
        initialData={draftFormInitialData}
        onSuccess={() => {
          setDraftFormInitialData(null);
          setSelectedFormType(null);
          fetchMeasures();
          fetchDraftOptions();
        }}
        onCancel={() => {
          setDraftFormInitialData(null);
          setSelectedFormType(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="proposed-container">
        <h3>📋 Proposed Measures</h3>
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading proposed measures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="proposed-container">
      {/* Header */}
      <div className="proposed-header">
        <div className="header-content">
          <h3>📋 Proposed Measures</h3>
          <p className="header-subtitle">Submitted ordinances and resolutions under review</p>
        </div>
        <div className="header-actions">
          {canCreate && (
            <button
              onClick={() => setShowTypeSelector(true)}
              className="btn-new-proposed"
              aria-label="Create new proposed measure"
            >
              ➕ New Proposed Measure
            </button>
          )}
          <button onClick={fetchMeasures} className="btn-refresh" title="Refresh">
            🔄
          </button>
        </div>
      </div>

      {/* Type Selector Modal */}
      {showTypeSelector && (
        <div className="type-selector-overlay">
          <div className="type-selector-modal">
            <div className="type-selector-header">
              <h4>📋 New Proposed Measure</h4>
              <button
                className="btn-close-selector"
                onClick={() => setShowTypeSelector(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="type-selector-subtitle">Select the type of measure you want to propose:</p>
            <div className="type-selector-options">
              <button
                className="type-option-btn ordinance-option"
                onClick={() => {
                  setDraftFormInitialData(null);
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
                  setDraftFormInitialData(null);
                  setShowTypeSelector(false);
                  setSelectedFormType('Resolution');
                }}
              >
                <span className="type-option-icon">📣</span>
                <strong>Resolution</strong>
                <span className="type-option-desc">Non-binding expression or declaration</span>
              </button>
              <button
                className="type-option-btn draft-option"
                onClick={openDraftSelector}
              >
                <span className="type-option-icon">✏️</span>
                <strong>Use Existing Draft</strong>
                <span className="type-option-desc">Select a saved draft and move it to Proposed Measures</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDraftSelector && (
        <div className="type-selector-overlay">
          <div className="type-selector-modal draft-selector-modal">
            <div className="type-selector-header">
              <h4>✏️ Select Draft</h4>
              <button
                className="btn-close-selector"
                onClick={() => setShowDraftSelector(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="type-selector-subtitle">Choose a draft to use as a proposed measure.</p>

            {loadingDraftOptions ? (
              <div className="draft-selector-empty">Loading drafts...</div>
            ) : draftOptions.length === 0 ? (
              <div className="draft-selector-empty">No drafts are available to submit.</div>
            ) : (
              <div className="draft-selector-list">
                {draftOptions.map((draft) => {
                  const draftKey = `${draft.itemType}-${draft.id}`;
                  const proposerName = draft.proposer_name || draft.author_name || 'Unknown';
                  const isActivating = activatingDraftKey === draftKey;

                  return (
                    <div key={draftKey} className="draft-selector-card">
                      <div className="draft-selector-content">
                        <div className="draft-selector-top">
                          <span className={`type-badge ${draft.itemType.toLowerCase()}`}>
                            {draft.itemType}
                          </span>
                          <span className="status-badge-draft">Draft</span>
                        </div>
                        <h4>{draft.title}</h4>
                        {draft.description && <p>{draft.description}</p>}
                        <div className="draft-selector-meta">
                          <span>👤 {proposerName}</span>
                          <span>
                            #️⃣ {draft.ordinance_number || draft.resolution_number || 'Pending Number'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-action btn-submit"
                        onClick={() => handleUseDraftAsProposedMeasure(draft)}
                        disabled={isActivating}
                      >
                        {isActivating ? 'Opening...' : 'Edit then Submit as Proposed'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="proposed-stats">
        <div className="prop-stat-card">
          <span className="prop-stat-icon">📋</span>
          <div className="prop-stat-info">
            <span className="prop-stat-value">{stats.total}</span>
            <span className="prop-stat-label">Total</span>
          </div>
        </div>
        <div className="prop-stat-card submitted">
          <span className="prop-stat-icon">📤</span>
          <div className="prop-stat-info">
            <span className="prop-stat-value">{stats.submitted}</span>
            <span className="prop-stat-label">Submitted</span>
          </div>
        </div>
        <div className="prop-stat-card review">
          <span className="prop-stat-icon">🔍</span>
          <div className="prop-stat-info">
            <span className="prop-stat-value">{stats.underReview}</span>
            <span className="prop-stat-label">Under Review</span>
          </div>
        </div>
        <div className="prop-stat-card approved">
          <span className="prop-stat-icon">✅</span>
          <div className="prop-stat-info">
            <span className="prop-stat-value">{stats.approved}</span>
            <span className="prop-stat-label">Approved</span>
          </div>
        </div>
        <div className="prop-stat-card rejected">
          <span className="prop-stat-icon">❌</span>
          <div className="prop-stat-info">
            <span className="prop-stat-value">{stats.rejected}</span>
            <span className="prop-stat-label">Rejected</span>
          </div>
        </div>
      </div>

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

      <section className="measure-guidance" aria-label="Proposed measure structure guide">
        <h4>What&apos;s included in a proposed measure</h4>
        <p className="measure-guidance-subtitle">
          Use this structure when preparing an ordinance or resolution.
        </p>

        <div className="measure-guidance-grid">
          <div className="guidance-block">
            <h5>Core Contents</h5>
            <ul>
              <li>
                <strong>Title / Caption:</strong> A clear, concise name for the measure.
              </li>
              <li>
                <strong>Type:</strong> Ordinance or Resolution.
              </li>
              <li>
                <strong>Author(s):</strong> Councilor(s) who filed the measure.
              </li>
              <li>
                <strong>Co-authors / Sponsors:</strong> Councilors supporting the measure.
              </li>
              <li>
                <strong>Whereas Clauses (Recitals):</strong> Background, rationale, and legal basis.
              </li>
              <li>
                <strong>Body / Provisions:</strong> Substantive rules, regulations, or actions proposed.
              </li>
              <li>
                <strong>Effectivity Clause:</strong> When the ordinance or resolution takes effect.
              </li>
              <li>
                <strong>Attachments:</strong> Supporting documents, committee reports, or references.
              </li>
            </ul>
          </div>

          <div className="guidance-block">
            <h5>System Metadata</h5>
            <ul>
              <li>
                <strong>status:</strong> draft, filed, under committee review, approved, enacted
              </li>
              <li>
                <strong>created_at / updated_at:</strong> automatic audit timestamps
              </li>
              <li>
                <strong>session_id:</strong> assigned once scheduled for deliberation
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="proposed-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search measures by title or description..."
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
          <div className="status-filter">
            <label htmlFor="statusFilter">Status:</label>
            <select
              id="statusFilter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
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
              <option value="type">Type</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results info */}
      {filtered.length > 0 && (
        <div className="results-info">
          <p>
            Showing <strong>{filtered.length}</strong> of <strong>{measures.length}</strong> proposed measures
          </p>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h4>No proposed measures found</h4>
          <p className="text-muted">
            {searchTerm || filterType || filterStatus
              ? 'Try adjusting your search or filters'
              : 'There are no submitted or proposed measures'}
          </p>
        </div>
      ) : (
        <div className="measures-list">
          {filtered.map((measure) => {
            const proposerName =
              measure.proposer_name ||
              measure.submitted_by_name ||
              measure.author_name ||
              'Unknown';
            const submittedDate = measure.created_at
              ? new Date(measure.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'N/A';

            const statusColor = STATUS_COLORS[measure.status] || '#95a5a6';
            const statusIcon = STATUS_ICONS[measure.status] || '📄';
            const measureKey = `${measure.itemType}-${measure.id}`;
            const isDeleting = deletingMeasureKey === measureKey;

            return (
              <div key={`${measure.itemType}-${measure.id}`} className="measure-card">
                <div
                  className="measure-status-strip"
                  style={{ backgroundColor: statusColor }}
                ></div>
                <div className="measure-card-content">
                  <div className="measure-card-top">
                    <div className="measure-badges">
                      <span className={`type-badge ${measure.itemType.toLowerCase()}`}>
                        {measure.itemType}
                      </span>
                      <span
                        className="status-badge-measure"
                        style={{ backgroundColor: statusColor }}
                      >
                        {statusIcon} {measure.status}
                      </span>
                    </div>
                    {(measure.ordinance_number || measure.resolution_number) && (
                      <code className="measure-number">
                        {measure.ordinance_number || measure.resolution_number}
                      </code>
                    )}
                  </div>

                  <h4 className="measure-title">{measure.title}</h4>

                  {measure.description && (
                    <RichTextContent
                      value={measure.description}
                      className="measure-description"
                    />
                  )}

                  <div className="measure-meta">
                    <span className="meta-item">👤 {proposerName}</span>
                    <span className="meta-item">📅 {submittedDate}</span>
                    {measure.itemType === 'Ordinance' && ordinanceSessions[String(measure.id)]?.length > 0 && (
                      <span className="meta-item session-assignment">
                        🏛️{' '}
                        {ordinanceSessions[String(measure.id)]
                          .map((s) => s.title)
                          .join(', ')}
                      </span>
                    )}
                  </div>

                  {/* Progress indicator */}
                  <div className="measure-progress">
                    {['Submitted', 'Under Review', 'Approved'].map((step, idx) => {
                      const steps = ['Submitted', 'Under Review', 'Approved'];
                      const currentIdx = steps.indexOf(measure.status);
                      const isActive = measure.status === step;
                      const isCompleted = currentIdx > idx;

                      return (
                        <div key={step} className="progress-step-wrapper">
                          <div
                            className={getProgressStepClassName(isActive, isCompleted)}
                          >
                            <span className="step-dot"></span>
                            <span className="step-label">{step}</span>
                          </div>
                          {idx < 2 && (
                            <div className={`step-connector${isCompleted ? ' completed' : ''}`}></div>
                          )}
                        </div>
                      );
                    })}
                    {measure.status === 'Rejected' && (
                      <div className="rejected-label">❌ Rejected</div>
                    )}
                  </div>

                  <div className="measure-actions">
                    {measure.itemType === 'Ordinance' && (
                      <button
                        onClick={() => setViewingMeasure(measure)}
                        className="btn-action btn-view"
                        aria-label={`View details for ${measure.title}`}
                      >
                        👁️ View Details
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMeasure(measure)}
                        className="btn-action btn-delete"
                        aria-label={`Delete ${measure.title}`}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting...' : '🗑️ Delete'}
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
