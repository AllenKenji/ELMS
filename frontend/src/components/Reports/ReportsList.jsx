import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useReports from '../../hooks/useReports';
import ReportForm from './ReportForm';
import ReportDetail from './ReportDetail';
import '../../styles/Reports.css';
import {
  FaPlus,
  FaDownload,
  FaTrash,
  FaEye,
  FaFilter,
  FaChevronLeft,
  FaChevronRight,
  FaChartBar,
} from 'react-icons/fa';

const STATUS_OPTIONS = ['', 'Draft', 'Generated', 'Archived'];
const TYPE_OPTIONS = ['', 'all', 'ordinances', 'resolutions', 'sessions'];
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'title', label: 'Title' },
  { value: 'bill_count', label: 'Bill Count' },
  { value: 'status', label: 'Status' },
];

export default function ReportsList() {
  const navigate = useNavigate();
  const {
    reports,
    pagination,
    filters,
    loading,
    error,
    createReport,
    deleteReport,
    exportCsv,
    changePage,
    applyFilters,
  } = useReports();

  const [showForm, setShowForm] = useState(false);
  const [viewingReport, setViewingReport] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handleCreate = async (formData) => {
    setActionError('');
    try {
      await createReport(formData);
      setShowForm(false);
      setActionSuccess('Report generated successfully!');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to create report');
    }
  };

  const handleDelete = async (id) => {
    setActionError('');
    try {
      await deleteReport(id);
      setDeleteConfirm(null);
      setActionSuccess('Report deleted.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to delete report');
    }
  };

  const handleExportCsv = (id, e) => {
    e.stopPropagation();
    exportCsv(id);
  };

  const statusBadgeClass = (status) => {
    const map = {
      Generated: 'badge-generated',
      Draft: 'badge-draft',
      Archived: 'badge-archived',
    };
    return `report-badge ${map[status] || 'badge-draft'}`;
  };

  const typeLabel = (type) => {
    const map = {
      all: 'All Legislative',
      ordinances: 'Ordinances',
      resolutions: 'Resolutions',
      sessions: 'Sessions',
    };
    return map[type] || type;
  };

  return (
    <div className="reports-container">
      {/* Header */}
      <div className="reports-header">
        <div className="header-content">
          <h3>
            <FaChartBar className="header-icon" /> Reports
          </h3>
          <p className="header-subtitle">
            Generate and manage legislative reports ({pagination.total} total)
          </p>
        </div>
        <button className="btn-new-report" onClick={() => setShowForm(true)}>
          <FaPlus /> New Report
        </button>
      </div>

      {/* Alerts */}
      {(error || actionError) && (
        <div className="alert alert-error">⚠️ {error || actionError}</div>
      )}
      {actionSuccess && (
        <div className="alert alert-success">✓ {actionSuccess}</div>
      )}

      {/* Report Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <ReportForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {viewingReport && (
        <div className="modal-overlay" onClick={() => setViewingReport(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <ReportDetail
              report={viewingReport}
              onClose={() => setViewingReport(null)}
              onExportCsv={() => exportCsv(viewingReport.id)}
            />
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-confirm" onClick={(e) => e.stopPropagation()}>
            <h4>Delete Report</h4>
            <p>
              Are you sure you want to delete &ldquo;{deleteConfirm.title}&rdquo;? This
              action cannot be undone.
            </p>
            <div className="confirm-actions">
              <button
                className="btn-danger"
                onClick={() => handleDelete(deleteConfirm.id)}
              >
                Delete
              </button>
              <button
                className="btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="reports-filters">
        <FaFilter className="filter-icon" />
        <select
          value={filters.status}
          onChange={(e) => applyFilters({ status: e.target.value })}
          className="filter-select"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={filters.report_type}
          onChange={(e) => applyFilters({ report_type: e.target.value })}
          className="filter-select"
          aria-label="Filter by type"
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.filter(Boolean).map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>

        <select
          value={filters.sort}
          onChange={(e) => applyFilters({ sort: e.target.value })}
          className="filter-select"
          aria-label="Sort by"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Sort: {o.label}
            </option>
          ))}
        </select>

        <button
          className={`btn-sort-order ${filters.order === 'ASC' ? 'asc' : ''}`}
          onClick={() =>
            applyFilters({ order: filters.order === 'DESC' ? 'ASC' : 'DESC' })
          }
          title="Toggle sort order"
        >
          {filters.order === 'DESC' ? '↓ Newest' : '↑ Oldest'}
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="reports-loading">Loading reports…</div>
      ) : reports.length === 0 ? (
        <div className="reports-empty">
          <p>No reports found. Click &ldquo;New Report&rdquo; to generate one.</p>
        </div>
      ) : (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Status</th>
                <th>Bill Count</th>
                <th>Date Range</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr
                  key={report.id}
                  className="report-row"
                  onClick={() => setViewingReport(report)}
                >
                  <td className="report-title">{report.title}</td>
                  <td>{typeLabel(report.report_type)}</td>
                  <td>
                    <span className={statusBadgeClass(report.status)}>
                      {report.status}
                    </span>
                  </td>
                  <td className="text-center">{report.bill_count}</td>
                  <td>
                    {report.date_range_start
                      ? `${new Date(report.date_range_start).toLocaleDateString()} – ${
                          report.date_range_end
                            ? new Date(report.date_range_end).toLocaleDateString()
                            : 'now'
                        }`
                      : 'All time'}
                  </td>
                  <td>{report.created_by_name || '—'}</td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  <td className="report-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-icon btn-view"
                      title="View"
                      onClick={() => setViewingReport(report)}
                    >
                      <FaEye />
                    </button>
                    <button
                      className="btn-icon btn-export"
                      title="Export CSV"
                      onClick={(e) => handleExportCsv(report.id, e)}
                    >
                      <FaDownload />
                    </button>
                    <button
                      className="btn-icon btn-delete"
                      title="Delete"
                      onClick={() => setDeleteConfirm(report)}
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="reports-pagination">
          <button
            className="btn-page"
            disabled={pagination.page <= 1}
            onClick={() => changePage(pagination.page - 1)}
            aria-label="Previous page"
          >
            <FaChevronLeft />
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn-page"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => changePage(pagination.page + 1)}
            aria-label="Next page"
          >
            <FaChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
