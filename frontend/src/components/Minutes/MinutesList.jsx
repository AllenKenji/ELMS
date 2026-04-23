import { useState } from 'react';
import useMinutes from '../../hooks/useMinutes';
import MinutesForm from './MinutesForm';
import MinutesDetail from './MinutesDetail';
import '../../styles/Minutes.css';
import {
  FaPlus,
  FaDownload,
  FaTrash,
  FaEye,
  FaFilter,
  FaChevronLeft,
  FaChevronRight,
  FaRobot,
} from 'react-icons/fa';

const STATUS_OPTIONS = ['', 'Draft', 'Generated', 'Archived'];
const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date Created' },
  { value: 'title', label: 'Title' },
  { value: 'meeting_date', label: 'Meeting Date' },
  { value: 'status', label: 'Status' },
];

export default function MinutesList() {
  const {
    minutes,
    pagination,
    filters,
    loading,
    error,
    createMinutes,
    generateMinutes,
    transcribeRecording,
    deleteMinutes,
    exportText,
    changePage,
    applyFilters,
  } = useMinutes();

  const [showForm, setShowForm] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [transcribingRecordingId, setTranscribingRecordingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handleCreate = async (formData) => {
    setActionError('');
    try {
      await createMinutes(formData);
      setShowForm(false);
      setActionSuccess('Transcript saved! Click "Generate AI Minutes" to process it.');
      setTimeout(() => setActionSuccess(''), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to save transcript');
    }
  };

  const handleGenerate = async (id) => {
    setActionError('');
    setGenerating(true);
    try {
      const updated = await generateMinutes(id);
      if (viewingRecord?.id === id) {
        setViewingRecord(updated);
      }
      setActionSuccess('AI minutes generated successfully!');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to generate minutes. Check your OpenAI API configuration.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    setActionError('');
    try {
      await deleteMinutes(id);
      setDeleteConfirm(null);
      setActionSuccess('Meeting minutes deleted.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.message || 'Failed to delete minutes');
    }
  };

  const handleTranscribeRecording = async (minutesId, recordingId) => {
    setActionError('');
    setTranscribingRecordingId(recordingId);
    try {
      const updated = await transcribeRecording(minutesId, recordingId);
      if (viewingRecord?.id === minutesId) {
        setViewingRecord(updated);
      }
      setActionSuccess('Recording transcript added to the linked minutes record.');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to transcribe recording.');
    } finally {
      setTranscribingRecordingId(null);
    }
  };

  const handleExportText = (id, e) => {
    if (e) e.stopPropagation();
    exportText(id);
  };

  const statusBadgeClass = (status) => {
    const map = {
      Generated: 'badge-generated',
      Draft: 'badge-draft',
      Archived: 'badge-archived',
    };
    return `minutes-badge ${map[status] || 'badge-draft'}`;
  };

  const summarizeRecordingStatuses = (record) => {
    const recordings = Array.isArray(record.recordings) ? record.recordings : [];
    const summary = recordings.reduce((accumulator, item) => {
      const key = String(item.transcript_status || 'pending').toLowerCase();
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    return [
      summary.completed ? { key: 'completed', label: `${summary.completed} transcribed` } : null,
      summary.pending ? { key: 'pending', label: `${summary.pending} pending` } : null,
      summary.failed ? { key: 'failed', label: `${summary.failed} failed` } : null,
    ].filter(Boolean);
  };

  return (
    <div className="minutes-container">
      {/* Header */}
      <div className="minutes-header">
        <div className="header-content">
          <h3>
            <FaRobot className="header-icon" /> AI Meeting Minutes
          </h3>
          <p className="header-subtitle">
            Generate structured minutes from meeting transcripts ({pagination.total} total)
          </p>
        </div>
        <button className="btn-new-minutes" onClick={() => setShowForm(true)}>
          <FaPlus /> New Minutes
        </button>
      </div>

      {/* Alerts */}
      {(error || actionError) && (
        <div className="alert alert-error">⚠️ {error || actionError}</div>
      )}
      {actionSuccess && (
        <div className="alert alert-success">✓ {actionSuccess}</div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <MinutesForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {viewingRecord && (
        <div className="modal-overlay" onClick={() => setViewingRecord(null)}>
          <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
            <MinutesDetail
              record={viewingRecord}
              onClose={() => setViewingRecord(null)}
              onExportText={handleExportText}
              onGenerate={handleGenerate}
              onTranscribeRecording={handleTranscribeRecording}
              generating={generating}
              transcribingRecordingId={transcribingRecordingId}
            />
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-confirm" onClick={(e) => e.stopPropagation()}>
            <h4>Delete Meeting Minutes</h4>
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
      <div className="minutes-filters">
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
        <div className="minutes-loading">Loading meeting minutes…</div>
      ) : minutes.length === 0 ? (
        <div className="minutes-empty">
          <p>No meeting minutes found. Click &ldquo;New Minutes&rdquo; to get started.</p>
        </div>
      ) : (
        <div className="minutes-table-wrapper">
          <table className="minutes-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Meeting Date</th>
                <th>Status</th>
                <th>Recordings</th>
                <th>Transcription</th>
                <th>Created By</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {minutes.map((record) => (
                <tr
                  key={record.id}
                  className="minutes-row"
                  onClick={() => setViewingRecord(record)}
                >
                  <td className="minutes-title">{record.title}</td>
                  <td>
                    {record.meeting_date
                      ? new Date(record.meeting_date).toLocaleDateString()
                      : '—'}
                  </td>
                  <td>
                    <span className={statusBadgeClass(record.status)}>
                      {record.status}
                    </span>
                  </td>
                  <td>{record.recording_count || 0}</td>
                  <td>
                    <div className="minutes-status-summary">
                      {summarizeRecordingStatuses(record).length > 0 ? summarizeRecordingStatuses(record).map((item) => (
                        <span key={item.key} className={`minutes-badge minutes-badge-strong transcript-${item.key}`}>
                          {item.label}
                        </span>
                      )) : (
                        <span className="minutes-badge minutes-badge-strong transcript-none">No recordings</span>
                      )}
                    </div>
                  </td>
                  <td>{record.created_by_name || '—'}</td>
                  <td>{new Date(record.created_at).toLocaleDateString()}</td>
                  <td className="minutes-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-icon btn-view"
                      title="View"
                      onClick={() => setViewingRecord(record)}
                    >
                      <FaEye />
                    </button>
                    {record.status !== 'Generated' && (
                      <button
                        className="btn-icon btn-generate"
                        title="Generate AI Minutes"
                        onClick={() => handleGenerate(record.id)}
                        disabled={generating}
                      >
                        <FaRobot />
                      </button>
                    )}
                    {record.status === 'Generated' && (
                      <button
                        className="btn-icon btn-export"
                        title="Export Text"
                        onClick={(e) => handleExportText(record.id, e)}
                      >
                        <FaDownload />
                      </button>
                    )}
                    <button
                      className="btn-icon btn-delete"
                      title="Delete"
                      onClick={() => setDeleteConfirm(record)}
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
        <div className="minutes-pagination">
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
