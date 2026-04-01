

import { useEffect, useState } from 'react';
import api from '../../api/api';
import OrderOfBusinessPanel from './OrderOfBusinessPanel';
import OrderOfBusinessForm from './OrderOfBusinessForm';
import { useAuth } from '../../context/useAuth';
import '../../styles/OrderOfBusinessPage.css';


export default function OrderOfBusinessPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('oob');
  const [committeeReports, setCommitteeReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState('');
  const [showOobForm, setShowOobForm] = useState(false);
  const [oobFormData, setOobFormData] = useState(null);


  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get('/sessions');
        const fetchedSessions = res.data || [];
        setSessions(fetchedSessions);
        if (fetchedSessions.length > 0) {
          setSelectedSessionId(String(fetchedSessions[0].id));
        }
      } catch (err) {
        setError(err?.message || 'Failed to load sessions.');
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  // Fetch all committee reports at COMMITTEE_REPORT_SUBMITTED stage for the tab
  useEffect(() => {
    if (activeTab !== 'committee') return;
    setReportsLoading(true);
    setReportsError('');
    setCommitteeReports([]);
    api.get('/oob/ordinances-with-committee-reports')
      .then(res => setCommitteeReports(res.data || []))
      .catch(err => setReportsError(err?.message || 'Failed to load committee reports.'))
      .finally(() => setReportsLoading(false));
  }, [activeTab]);


  if (loading) {
    return (
      <div className="oob-page">
        <h3>📋 Order of Business</h3>
        <p>Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="oob-page">
      <div className="oob-page-header">
        <div>
          <h3>📋 Order of Business</h3>
          <p>Manage the agenda flow for a selected session</p>
        </div>
        <div className="oob-session-select-wrap">
          <label htmlFor="oobSessionSelect">Session</label>
          <select
            id="oobSessionSelect"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            disabled={sessions.length === 0}
          >
            {sessions.length === 0 ? (
              <option value="">No sessions available</option>
            ) : (
              sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="oob-tabs">
        <button
          className={activeTab === 'oob' ? 'oob-tab active' : 'oob-tab'}
          onClick={() => setActiveTab('oob')}
        >
          Order of Business
        </button>
        <button
          className={activeTab === 'committee' ? 'oob-tab active' : 'oob-tab'}
          onClick={() => setActiveTab('committee')}
        >
          Committee Reports
        </button>
      </div>

      {error && <div className="oob-page-error">{error}</div>}

      {!selectedSessionId ? (
        <div className="oob-page-empty">Select a session to view order of business.</div>
      ) : activeTab === 'oob' ? (
        <OrderOfBusinessPanel sessionId={selectedSessionId} />
      ) : (
        <div className="oob-committee-reports">
          {reportsLoading ? (
            <div>Loading committee reports...</div>
          ) : reportsError ? (
            <div className="oob-page-error">{reportsError}</div>
          ) : committeeReports.length === 0 ? (
            <div>No committee reports submitted.</div>
          ) : (
            <ol className="committee-reports-list">
              {committeeReports.map((rep) => (
                <li key={rep.committeeReport.id} className="committee-report-item">
                  <div className="cr-header">
                    <span className="cr-title">{rep.ordinance?.title || 'Ordinance'}</span>
                    <span className={"cr-recommendation rec-" + (rep.committeeReport.recommendation || '').toLowerCase()}>{rep.committeeReport.recommendation}</span>
                  </div>
                  <div className="cr-meta">
                    <span><strong>Committee:</strong> {rep.committeeReport.committee_name}</span>
                    <span><strong>Submitted by:</strong> {rep.committeeReport.submitted_by_name}</span>
                    {rep.committeeReport.meeting_date && <span><strong>Meeting date:</strong> {new Date(rep.committeeReport.meeting_date).toLocaleDateString()}</span>}
                  </div>
                  {rep.committeeReport.report_content && <div className="cr-content"><strong>Report:</strong> <p>{rep.committeeReport.report_content}</p></div>}
                  {rep.ordinance?.ordinance_number && <div className="cr-ord-num">Ordinance No: {rep.ordinance.ordinance_number}</div>}
                  {['Secretary', 'Admin'].includes(user?.role) && selectedSessionId && (
                    <button
                      className="oob-btn-add-from-report"
                      onClick={() => {
                        setOobFormData({
                          title: rep.ordinance.title,
                          item_type: 'Committee Reports',
                          related_document_type: 'ordinance',
                          related_document_id: rep.ordinance.id,
                          duration_minutes: '',
                          priority: 0,
                          status: 'Scheduled',
                          notes: '',
                        });
                        setShowOobForm(true);
                      }}
                    >
                      ➕ Add to Order of Business
                    </button>
                  )}
                </li>
              ))}
            </ol>
          )}
          {showOobForm && (
            <div className="oob-modal-overlay">
              <div className="oob-modal">
                <OrderOfBusinessForm
                  form={oobFormData}
                  ordinances={committeeReports.map(r => r.ordinance)}
                  resolutions={[]}
                  statusColors={{ Scheduled: '#3498db' }}
                  saving={false}
                  editingItem={null}
                  onChange={() => {}}
                  onCancel={() => setShowOobForm(false)}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await api.post('/order-of-business', {
                        ...oobFormData,
                        session_id: selectedSessionId,
                        related_document_id: oobFormData.related_document_id,
                        related_document_type: oobFormData.related_document_type,
                        item_type: oobFormData.item_type,
                        title: oobFormData.title,
                        status: oobFormData.status,
                        priority: oobFormData.priority,
                        duration_minutes: oobFormData.duration_minutes,
                        notes: oobFormData.notes,
                      });
                      setShowOobForm(false);
                    } catch {
                      alert('Failed to add to Order of Business.');
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
