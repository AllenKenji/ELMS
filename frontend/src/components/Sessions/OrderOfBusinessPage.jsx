import { useEffect, useState } from 'react';
import api from '../../api/api';
import OrderOfBusinessPanel from './OrderOfBusinessPanel';
import '../../styles/OrderOfBusinessPage.css';

export default function OrderOfBusinessPage() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      {error && <div className="oob-page-error">{error}</div>}

      {!selectedSessionId ? (
        <div className="oob-page-empty">Select a session to view order of business.</div>
      ) : (
        <OrderOfBusinessPanel sessionId={selectedSessionId} />
      )}
    </div>
  );
}
