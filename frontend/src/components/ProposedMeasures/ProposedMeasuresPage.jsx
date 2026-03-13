import { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import OrdinanceDetails from '../Ordinances/OrdinanceDetails';
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
  const [measures, setMeasures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [viewingMeasure, setViewingMeasure] = useState(null);

  const fetchMeasures = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const [ordRes, resRes] = await Promise.all([
        api.get('/ordinances'),
        api.get('/resolutions'),
      ]);

      const PROPOSED_STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected'];

      const ordinances = (ordRes.data || [])
        .filter((o) => PROPOSED_STATUSES.includes(o.status))
        .map((o) => ({ ...o, itemType: 'Ordinance' }));

      const resolutions = (resRes.data || [])
        .filter((r) => PROPOSED_STATUSES.includes(r.status))
        .map((r) => ({ ...r, itemType: 'Resolution' }));

      setMeasures([...ordinances, ...resolutions]);
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
        <button onClick={fetchMeasures} className="btn-refresh" title="Refresh">
          🔄
        </button>
      </div>

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

      {error && (
        <div className="alert alert-error" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

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
                    <p className="measure-description">{measure.description}</p>
                  )}

                  <div className="measure-meta">
                    <span className="meta-item">👤 {proposerName}</span>
                    <span className="meta-item">📅 {submittedDate}</span>
                  </div>

                  {/* Progress indicator */}
                  <div className="measure-progress">
                    {['Submitted', 'Under Review', 'Approved'].map((step, idx) => {
                      const steps = ['Submitted', 'Under Review', 'Approved'];
                      const currentIdx = steps.indexOf(measure.status);
                      const isActive = measure.status === step;
                      const isCompleted = currentIdx > idx;
                      const isRejected = measure.status === 'Rejected';

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
