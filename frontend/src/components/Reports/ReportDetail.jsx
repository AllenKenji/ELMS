import '../../styles/Reports.css';
import { FaDownload, FaTimes, FaFileAlt, FaCalendarAlt, FaLayerGroup } from 'react-icons/fa';

export default function ReportDetail({ report, onClose, onExportCsv }) {
  if (!report) return null;

  const generatedData = report.generated_data || {};

  const typeLabel = (type) => {
    const map = {
      all: 'All Legislative',
      ordinances: 'Ordinances',
      resolutions: 'Resolutions',
      sessions: 'Sessions',
    };
    return map[type] || type;
  };

  const statusBadgeClass = (status) => {
    const map = {
      Generated: 'badge-generated',
      Draft: 'badge-draft',
      Archived: 'badge-archived',
    };
    return `report-badge ${map[status] || 'badge-draft'}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="report-detail">
      {/* Detail Header */}
      <div className="detail-header">
        <div>
          <h3>{report.title}</h3>
          <span className={statusBadgeClass(report.status)}>{report.status}</span>
        </div>
        <button className="btn-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
      </div>

      {/* Metadata */}
      <div className="detail-meta">
        <div className="meta-item">
          <FaLayerGroup className="meta-icon" />
          <span>
            <strong>Type:</strong> {typeLabel(report.report_type)}
          </span>
        </div>
        <div className="meta-item">
          <FaFileAlt className="meta-icon" />
          <span>
            <strong>Bill Count:</strong> {report.bill_count}
          </span>
        </div>
        <div className="meta-item">
          <FaCalendarAlt className="meta-icon" />
          <span>
            <strong>Date Range:</strong>{' '}
            {report.date_range_start
              ? `${formatDate(report.date_range_start)} – ${formatDate(report.date_range_end) || 'now'}`
              : 'All time'}
          </span>
        </div>
        <div className="meta-item">
          <span>
            <strong>Created By:</strong> {report.created_by_name || '—'}
          </span>
        </div>
        <div className="meta-item">
          <span>
            <strong>Generated At:</strong> {formatDate(report.created_at)}
          </span>
        </div>
      </div>

      {/* Description */}
      {report.description && (
        <div className="detail-description">
          <strong>Description:</strong>
          <p>{report.description}</p>
        </div>
      )}

      {/* Export */}
      <div className="detail-export">
        <button className="btn-export-csv" onClick={onExportCsv}>
          <FaDownload /> Export CSV
        </button>
      </div>

      {/* Data Sections */}
      {generatedData.ordinances && generatedData.ordinances.length > 0 && (
        <section className="detail-section">
          <h4>📋 Ordinances ({generatedData.ordinances.length})</h4>
          <div className="detail-table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Proposer</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {generatedData.ordinances.map((o) => (
                  <tr key={o.id}>
                    <td>{o.title}</td>
                    <td>{o.ordinance_number || '—'}</td>
                    <td>
                      <span className="inline-badge">{o.status}</span>
                    </td>
                    <td>{o.proposer_name || '—'}</td>
                    <td>{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {generatedData.resolutions && generatedData.resolutions.length > 0 && (
        <section className="detail-section">
          <h4>📄 Resolutions ({generatedData.resolutions.length})</h4>
          <div className="detail-table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Number</th>
                  <th>Status</th>
                  <th>Proposer</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {generatedData.resolutions.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.resolution_number || '—'}</td>
                    <td>
                      <span className="inline-badge">{r.status}</span>
                    </td>
                    <td>{r.proposer_name || '—'}</td>
                    <td>{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {generatedData.sessions && generatedData.sessions.length > 0 && (
        <section className="detail-section">
          <h4>📅 Sessions ({generatedData.sessions.length})</h4>
          <div className="detail-table-wrapper">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {generatedData.sessions.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{formatDate(s.date)}</td>
                    <td>{s.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!generatedData.ordinances &&
        !generatedData.resolutions &&
        !generatedData.sessions && (
          <p className="detail-empty">No data available for this report.</p>
        )}
    </div>
  );
}
