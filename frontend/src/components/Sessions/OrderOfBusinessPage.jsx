

import { useEffect, useState, useCallback } from 'react';
import api from '../../api/api';
import OrderOfBusinessPanel from './OrderOfBusinessPanel';
import { useAuth } from '../../context/useAuth';
import '../../styles/OrderOfBusinessPage.css';

/* ── Default agenda sections (template) ─────────────────────────── */
const buildDefaultSections = () => [
  {
    key: 'call_to_order',
    label: '1. Call to Order',
    item_type: 'Call to Order',
    title: 'Call to Order',
    enabled: true,
    duration_minutes: 5,
    notes: '',
  },
  {
    key: 'roll_call',
    label: '2. Roll Call / Attendance',
    item_type: 'Roll Call',
    title: 'Roll Call / Attendance',
    enabled: true,
    duration_minutes: 10,
    notes: 'Quorum verification',
  },
  {
    key: 'prayer',
    label: '3. Prayer',
    item_type: 'Prayer',
    title: 'Prayer',
    enabled: true,
    duration_minutes: 5,
    notes: '',
  },
  {
    key: 'approval_minutes',
    label: '4. Approval of Previous Minutes',
    item_type: 'Approval of Minutes',
    title: 'Approval of Previous Minutes',
    enabled: true,
    duration_minutes: 15,
    notes: 'Display of last session\'s minutes. Motion to approve or amend.',
  },
  {
    key: 'committee_reports',
    label: '5. Committee Reports',
    item_type: 'Committee Reports',
    title: 'Committee Reports',
    enabled: true,
    duration_minutes: 30,
    notes: 'Standing & special committee reports',
    selectedReportIds: [],
  },
  {
    key: 'unfinished_business',
    label: '6. Unfinished Business',
    item_type: 'Unfinished Business',
    title: 'Unfinished Business',
    enabled: true,
    duration_minutes: 20,
    notes: 'Measures carried over from previous sessions. Pending items awaiting further action.',
  },
  {
    key: 'new_business',
    label: '7. New Business',
    item_type: 'New Business',
    title: 'New Business',
    enabled: true,
    duration_minutes: 30,
    notes: 'Filing of new ordinances, resolutions, motions. Committee referrals. Calendar of business.',
  },
  {
    key: 'debates_voting',
    label: '8. Debates and Voting',
    item_type: 'Other Matters',
    title: 'Debates and Voting',
    enabled: true,
    duration_minutes: 45,
    notes: 'Agenda items listed in order. Role-based voting interface.',
  },
  {
    key: 'privilege_speeches',
    label: '9. Privilege Speeches / Member Concerns',
    item_type: 'Question Hour',
    title: 'Privilege Speeches / Member Concerns',
    enabled: true,
    duration_minutes: 15,
    notes: 'Slots for individual members\' statements.',
  },
  {
    key: 'announcements',
    label: '10. Announcements',
    item_type: 'Announcement',
    title: 'Announcements',
    enabled: true,
    duration_minutes: 10,
    notes: 'Notices of upcoming hearings, deadlines, or events.',
  },
  {
    key: 'adjournment',
    label: '11. Adjournment',
    item_type: 'Adjournment',
    title: 'Adjournment',
    enabled: true,
    duration_minutes: 5,
    notes: 'Formal closure of the session. Automatic archival of proceedings.',
  },
];

export default function OrderOfBusinessPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('oob');

  // Committee reports
  const [committeeReports, setCommitteeReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [headerInfo, setHeaderInfo] = useState({
    sessionTitle: '',
    date: '',
    time: '',
    venue: '',
    presidingOfficer: '',
    secretary: '',
  });
  const [sections, setSections] = useState(buildDefaultSections);
  const [saving, setSaving] = useState(false);

  // Unassigned OOB items
  const [unassignedItems, setUnassignedItems] = useState([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);

  // Compiled OOB list (sessions that have OOB items)
  const [oobSessions, setOobSessions] = useState([]);
  const [oobSessionsLoading, setOobSessionsLoading] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [deletingSessionId, setDeletingSessionId] = useState(null);

  const canManage = ['Secretary', 'Admin'].includes(user?.role);

  /* ── Fetchers ──────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await api.get('/sessions');
        const list = res.data || [];
        setSessions(list);
        if (list.length) setSelectedSessionId(String(list[0].id));
      } catch (err) {
        setError(err?.message || 'Failed to load sessions.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fetchCommitteeReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError('');
    try {
      const res = await api.get('/oob/ordinances-with-committee-reports');
      setCommitteeReports(res.data || []);
    } catch (err) {
      setReportsError(err?.message || 'Failed to load committee reports.');
      setCommitteeReports([]);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => { fetchCommitteeReports(); }, [fetchCommitteeReports]);

  const fetchUnassigned = useCallback(async () => {
    setUnassignedLoading(true);
    try {
      const res = await api.get('/order-of-business/unassigned');
      setUnassignedItems(res.data || []);
    } catch { setUnassignedItems([]); }
    finally { setUnassignedLoading(false); }
  }, []);

  useEffect(() => { fetchUnassigned(); }, [fetchUnassigned]);

  const fetchOobSessions = useCallback(async () => {
    setOobSessionsLoading(true);
    try {
      const res = await api.get('/order-of-business/sessions-with-oob');
      setOobSessions(res.data || []);
    } catch { setOobSessions([]); }
    finally { setOobSessionsLoading(false); }
  }, []);

  useEffect(() => { fetchOobSessions(); }, [fetchOobSessions]);

  /* ── Helpers ───────────────────────────────────────────────────── */
  const handleDeleteUnassigned = async (id) => {
    if (!window.confirm('Remove this item from the order of business?')) return;
    try { await api.delete(`/order-of-business/${id}`); fetchUnassigned(); }
    catch { setError('Failed to remove item.'); }
  };

  const toggleSection = (key) => {
    setSections(prev => prev.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s));
  };

  const updateSection = (key, field, value) => {
    setSections(prev => prev.map(s => s.key === key ? { ...s, [field]: value } : s));
  };

  const toggleReportSelection = (ordinanceId) => {
    setSections(prev => prev.map(s => {
      if (s.key !== 'committee_reports') return s;
      const ids = s.selectedReportIds || [];
      const next = ids.includes(ordinanceId)
        ? ids.filter(id => id !== ordinanceId)
        : [...ids, ordinanceId];
      return { ...s, selectedReportIds: next };
    }));
  };

  const resetForm = () => {
    setShowCreateForm(false);
    setHeaderInfo({ sessionTitle: '', date: '', time: '', venue: '', presidingOfficer: '', secretary: '' });
    setSections(buildDefaultSections());
  };

  const handleDownloadPdf = async (sessionId) => {
    try {
      const response = await api.get(`/order-of-business/${sessionId}/generate-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order-of-business-session-${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Failed to download PDF.');
    }
  };

  const handleDeleteOobBySession = async (sessionId, sessionTitle) => {
    if (!window.confirm(`Delete all order of business items for "${sessionTitle}"? This cannot be undone.`)) return;
    setDeletingSessionId(sessionId);
    setError('');
    try {
      await api.delete(`/order-of-business/session/${sessionId}`);
      fetchOobSessions();
      fetchUnassigned();
    } catch (err) {
      setError(err?.message || 'Failed to delete order of business.');
    } finally {
      setDeletingSessionId(null);
    }
  };

  /* ── Submit: Batch-create all enabled sections ─────────────────── */
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const enabled = sections.filter(s => s.enabled);
    if (enabled.length === 0) return;

    setSaving(true);
    setError('');

    // Build header notes string for Call to Order item
    const headerParts = [];
    if (headerInfo.sessionTitle) headerParts.push(`Session: ${headerInfo.sessionTitle}`);
    if (headerInfo.date) headerParts.push(`Date: ${headerInfo.date}`);
    if (headerInfo.time) headerParts.push(`Time: ${headerInfo.time}`);
    if (headerInfo.venue) headerParts.push(`Venue: ${headerInfo.venue}`);
    if (headerInfo.presidingOfficer) headerParts.push(`Presiding Officer: ${headerInfo.presidingOfficer}`);
    if (headerInfo.secretary) headerParts.push(`Secretary: ${headerInfo.secretary}`);

    try {
      // Expand committee reports section into individual items per selected report
      const items = [];
      for (const sec of enabled) {
        if (sec.key === 'committee_reports' && sec.selectedReportIds?.length > 0) {
          for (const ordId of sec.selectedReportIds) {
            const rep = committeeReports.find(r => String(r.ordinance.id) === String(ordId));
            items.push({
              title: rep ? `Committee Report: ${rep.ordinance.title}` : sec.title,
              item_type: 'Committee Reports',
              related_document_type: 'ordinance',
              related_document_id: ordId,
              duration_minutes: sec.duration_minutes ? parseInt(sec.duration_minutes, 10) : null,
              notes: rep ? `Committee: ${rep.committeeReport.committee_name} | Recommendation: ${rep.committeeReport.recommendation}` : sec.notes,
              session_id: selectedSessionId || null,
            });
          }
        } else {
          const notes =
            sec.key === 'call_to_order' && headerParts.length
              ? [headerParts.join('\n'), sec.notes].filter(Boolean).join('\n\n')
              : sec.notes;
          items.push({
            title: sec.title,
            item_type: sec.item_type,
            duration_minutes: sec.duration_minutes ? parseInt(sec.duration_minutes, 10) : null,
            notes: notes || null,
            session_id: selectedSessionId || null,
          });
        }
      }

      await api.post('/order-of-business/batch', { items });
      resetForm();
      fetchUnassigned();
      fetchOobSessions();
    } catch {
      setError('Failed to create order of business.');
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="oob-page">
        <h3>📋 Order of Business</h3>
        <p>Loading sessions...</p>
      </div>
    );
  }

  const crSection = sections.find(s => s.key === 'committee_reports');

  return (
    <div className="oob-page">
      {/* Header */}
      <div className="oob-page-header">
        <div>
          <h3>📋 Order of Business</h3>
          <p>Manage the agenda flow for a selected session</p>
        </div>
        {sessions.length > 0 && (
          <div className="oob-session-select-wrap">
            <label htmlFor="oobSessionSelect">Session</label>
            <select id="oobSessionSelect" value={selectedSessionId} onChange={(e) => setSelectedSessionId(e.target.value)}>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="oob-tabs">
        <button className={activeTab === 'oob' ? 'oob-tab active' : 'oob-tab'} onClick={() => setActiveTab('oob')}>Order of Business</button>
        <button className={activeTab === 'committee' ? 'oob-tab active' : 'oob-tab'} onClick={() => setActiveTab('committee')}>Committee Reports</button>
      </div>

      {error && <div className="oob-page-error">{error}</div>}

      {/* ── OOB Tab ──────────────────────────────────────────────── */}
      {activeTab === 'oob' ? (
        <div>
          {/* ── Compiled OOB List (primary view) ─────────────────── */}
          {oobSessionsLoading ? (
            <div className="oob-compiled-loading">Loading created agendas...</div>
          ) : oobSessions.length > 0 ? (
            <div className="oob-compiled-section">
              <h4 className="oob-compiled-title">📂 Created Order of Business</h4>
              <ul className="oob-compiled-list">
                {oobSessions.map((s) => (
                  <li key={s.id} className={`oob-compiled-item${expandedSessionId === String(s.id) ? ' expanded' : ''}`}>
                    <div className="oob-compiled-row">
                      <button
                        className="oob-compiled-name"
                        onClick={() => setExpandedSessionId(expandedSessionId === String(s.id) ? null : String(s.id))}
                        title="Click to view/edit items"
                      >
                        <span className="oob-compiled-expand-icon">{expandedSessionId === String(s.id) ? '▼' : '▶'}</span>
                        <span className="oob-compiled-session-title">{s.title}</span>
                        <span className="oob-compiled-count">{s.item_count} item{s.item_count !== 1 ? 's' : ''}</span>
                      </button>
                      <div className="oob-compiled-actions">
                        <button
                          className="oob-compiled-btn oob-compiled-btn-pdf"
                          onClick={() => handleDownloadPdf(s.id)}
                          title="Download PDF"
                        >
                          📄 PDF
                        </button>
                        {canManage && (
                          <button
                            className="oob-compiled-btn oob-compiled-btn-delete"
                            onClick={() => handleDeleteOobBySession(s.id, s.title)}
                            disabled={deletingSessionId === s.id}
                            title="Delete all items for this session"
                          >
                            {deletingSessionId === s.id ? '…' : '🗑️ Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedSessionId === String(s.id) && (
                      <div className="oob-compiled-panel">
                        <OrderOfBusinessPanel sessionId={String(s.id)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            !unassignedItems.length && !unassignedLoading && (
              <div className="oob-page-empty">No order of business items yet. Click the button below to create one.</div>
            )
          )}

          {/* ── Create button / form ─────────────────────────────── */}
          {canManage && !showCreateForm && (
            <div className="oob-create-section">
              <button className="oob-btn-create" onClick={() => setShowCreateForm(true)}>
                ➕ Create Order of Business
              </button>
            </div>
          )}

          {canManage && showCreateForm && (
            <div className="oob-create-form-wrapper">
              <h4 className="oob-create-form-title">Create Order of Business</h4>
              <form className="oob-create-form" onSubmit={handleCreateSubmit}>

                {/* ▸ Header Information */}
                <fieldset className="oob-fieldset">
                  <legend className="oob-legend">📝 Header Information</legend>
                  <div className="oob-form-row-inline">
                    <div className="oob-form-group">
                      <label>Session Title</label>
                      <input className="oob-input" placeholder='e.g. "Regular Session – April 1, 2026"' value={headerInfo.sessionTitle} onChange={e => setHeaderInfo(p => ({ ...p, sessionTitle: e.target.value }))} />
                    </div>
                    <div className="oob-form-group">
                      <label>Date</label>
                      <input className="oob-input" type="date" value={headerInfo.date} onChange={e => setHeaderInfo(p => ({ ...p, date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="oob-form-row-inline">
                    <div className="oob-form-group">
                      <label>Time</label>
                      <input className="oob-input" type="time" value={headerInfo.time} onChange={e => setHeaderInfo(p => ({ ...p, time: e.target.value }))} />
                    </div>
                    <div className="oob-form-group">
                      <label>Venue</label>
                      <input className="oob-input" placeholder="Session hall / location" value={headerInfo.venue} onChange={e => setHeaderInfo(p => ({ ...p, venue: e.target.value }))} />
                    </div>
                  </div>
                  <div className="oob-form-row-inline">
                    <div className="oob-form-group">
                      <label>Presiding Officer</label>
                      <input className="oob-input" placeholder="Name of presiding officer" value={headerInfo.presidingOfficer} onChange={e => setHeaderInfo(p => ({ ...p, presidingOfficer: e.target.value }))} />
                    </div>
                    <div className="oob-form-group">
                      <label>Secretary</label>
                      <input className="oob-input" placeholder="Name of secretary" value={headerInfo.secretary} onChange={e => setHeaderInfo(p => ({ ...p, secretary: e.target.value }))} />
                    </div>
                  </div>
                </fieldset>

                {/* ▸ Agenda Sections */}
                <fieldset className="oob-fieldset">
                  <legend className="oob-legend">📋 Agenda Sections</legend>
                  <p className="oob-form-hint">Toggle sections to include. Customize titles, duration, and notes for each.</p>

                  <div className="oob-sections-list">
                    {sections.map((sec) => (
                      <div key={sec.key} className={`oob-section-card ${sec.enabled ? '' : 'disabled'}`}>
                        <div className="oob-section-card-header">
                          <label className="oob-section-toggle">
                            <input type="checkbox" checked={sec.enabled} onChange={() => toggleSection(sec.key)} />
                            <span className="oob-section-label">{sec.label}</span>
                          </label>
                          <span className="oob-item-type-badge">{sec.item_type}</span>
                        </div>

                        {sec.enabled && (
                          <div className="oob-section-card-body">
                            <div className="oob-form-row-inline">
                              <div className="oob-form-group">
                                <label>Title</label>
                                <input className="oob-input" value={sec.title} onChange={e => updateSection(sec.key, 'title', e.target.value)} />
                              </div>
                              <div className="oob-form-group" style={{ maxWidth: 120 }}>
                                <label>Duration (min)</label>
                                <input className="oob-input" type="number" min="1" value={sec.duration_minutes} onChange={e => updateSection(sec.key, 'duration_minutes', e.target.value)} />
                              </div>
                            </div>

                            {/* Committee Reports section — show selectable reports */}
                            {sec.key === 'committee_reports' && (
                              <div className="oob-form-group oob-cr-picker">
                                <label>Select Committee Reports to Discuss</label>
                                {reportsLoading ? (
                                  <span className="oob-form-hint">Loading reports…</span>
                                ) : committeeReports.length === 0 ? (
                                  <span className="oob-form-hint">No committee reports available.</span>
                                ) : (
                                  <div className="oob-cr-checkbox-list">
                                    {committeeReports.map(rep => (
                                      <label key={rep.committeeReport.id} className="oob-cr-checkbox-item">
                                        <input
                                          type="checkbox"
                                          checked={(sec.selectedReportIds || []).includes(rep.ordinance.id)}
                                          onChange={() => toggleReportSelection(rep.ordinance.id)}
                                        />
                                        <span className="oob-cr-checkbox-text">
                                          <strong>{rep.ordinance.title}</strong>
                                          <span className={'cr-recommendation rec-' + (rep.committeeReport.recommendation || '').toLowerCase()}>
                                            {rep.committeeReport.recommendation}
                                          </span>
                                          <span className="oob-cr-committee-name">{rep.committeeReport.committee_name}</span>
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="oob-form-group">
                              <label>Notes</label>
                              <textarea className="oob-textarea" rows={2} value={sec.notes} onChange={e => updateSection(sec.key, 'notes', e.target.value)} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>

                <div className="oob-form-actions">
                  <button type="button" className="oob-btn-cancel" onClick={resetForm}>Cancel</button>
                  <button type="submit" className="oob-btn-submit" disabled={saving || sections.every(s => !s.enabled)}>
                    {saving ? 'Creating…' : `Create Agenda (${sections.filter(s => s.enabled).length + ((crSection?.selectedReportIds?.length || 1) - 1)} items)`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Unassigned OOB items */}
          {unassignedItems.length > 0 && (
            <div className="oob-unassigned-section">
              <h4>📌 Unassigned Items (not yet linked to a session)</h4>
              <p className="oob-unassigned-hint">These items will be linked when a session is created.</p>
              <ol className="committee-reports-list">
                {unassignedItems.map(item => (
                  <li key={item.id} className="committee-report-item">
                    <div className="cr-header">
                      <span className="cr-title">{item.title}</span>
                      <span className="oob-item-type-badge">{item.item_type}</span>
                    </div>
                    <div className="cr-meta">
                      {item.ordinance_title && <span><strong>Ordinance:</strong> {item.ordinance_title}</span>}
                      {item.resolution_title && <span><strong>Resolution:</strong> {item.resolution_title}</span>}
                      {item.notes && <span><strong>Notes:</strong> {item.notes}</span>}
                    </div>
                    {canManage && (
                      <button className="oob-btn-remove-unassigned" onClick={() => handleDeleteUnassigned(item.id)}>✕ Remove</button>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {unassignedLoading && <div>Loading unassigned items...</div>}
        </div>
      ) : (
        /* ── Committee Reports Tab ────────────────────────────────── */
        <div className="oob-committee-reports">
          {reportsLoading ? (
            <div>Loading committee reports...</div>
          ) : reportsError ? (
            <div className="oob-page-error">{reportsError}</div>
          ) : committeeReports.length === 0 ? (
            <div>No committee reports submitted.</div>
          ) : (
            <ol className="committee-reports-list">
              {committeeReports.map(rep => (
                <li key={rep.committeeReport.id} className="committee-report-item">
                  <div className="cr-header">
                    <span className="cr-title">{rep.ordinance?.title || 'Ordinance'}</span>
                    <span className={'cr-recommendation rec-' + (rep.committeeReport.recommendation || '').toLowerCase()}>{rep.committeeReport.recommendation}</span>
                  </div>
                  <div className="cr-meta">
                    <span><strong>Committee:</strong> {rep.committeeReport.committee_name}</span>
                    <span><strong>Submitted by:</strong> {rep.committeeReport.submitted_by_name}</span>
                    {rep.committeeReport.meeting_date && <span><strong>Meeting date:</strong> {new Date(rep.committeeReport.meeting_date).toLocaleDateString()}</span>}
                  </div>
                  {rep.committeeReport.report_content && <div className="cr-content"><strong>Report:</strong> <p>{rep.committeeReport.report_content}</p></div>}
                  {rep.ordinance?.ordinance_number && <div className="cr-ord-num">Ordinance No: {rep.ordinance.ordinance_number}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
