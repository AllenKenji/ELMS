import { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { useAuth } from '../../context/useAuth';
import VotingSessionForm from './VotingSessionForm';
import VotingInterface from './VotingInterface';
import '../../styles/VotingDashboard.css';
import { FaVoteYea, FaPlus, FaChartBar, FaLock, FaDotCircle } from 'react-icons/fa';

export default function VotingDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate = ['Admin', 'Secretary', 'Councilor'].includes(user?.role);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/votes/sessions');
      setSessions(response.data);
    } catch (err) {
      console.error('Error fetching voting sessions:', err);
      setError('Failed to load voting sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const closedSessions = sessions.filter(s => s.status === 'closed');

  return (
    <div className="voting-dashboard">
      <div className="voting-header">
        <div className="voting-title">
          <FaVoteYea className="voting-title-icon" />
          <div>
            <h3>Voting System</h3>
            <p className="voting-subtitle">Manage and participate in legislative votes</p>
          </div>
        </div>
        {canCreate && (
          <button
            className="btn-new-vote"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? '✕ Cancel' : <><FaPlus /> New Vote</>}
          </button>
        )}
      </div>

      {showForm && (
        <VotingSessionForm
          onSuccess={() => {
            setShowForm(false);
            fetchSessions();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {error && <div className="voting-error">{error}</div>}

      {loading ? (
        <div className="voting-loading">Loading voting sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="voting-empty">
          <FaVoteYea className="empty-icon" />
          <p>No voting sessions yet</p>
          {canCreate && <p className="empty-hint">Click &quot;New Vote&quot; to create the first voting session.</p>}
        </div>
      ) : (
        <>
          {activeSessions.length > 0 && (
            <section className="sessions-section">
              <h4 className="section-label">
                <FaDotCircle className="label-icon active" /> Active Sessions ({activeSessions.length})
              </h4>
              <div className="sessions-grid">
                {activeSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => setSelectedSession(session)}
                  />
                ))}
              </div>
            </section>
          )}

          {closedSessions.length > 0 && (
            <section className="sessions-section">
              <h4 className="section-label">
                <FaLock className="label-icon closed" /> Closed Sessions ({closedSessions.length})
              </h4>
              <div className="sessions-grid">
                {closedSessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onClick={() => setSelectedSession(session)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {selectedSession && (
        <VotingInterface
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onUpdate={() => {
            fetchSessions();
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}

function SessionCard({ session, onClick }) {
  return (
    <div className={`session-card ${session.status}`} onClick={onClick}>
      <div className="session-card-header">
        <h4>{session.title}</h4>
        <span className={`status-badge ${session.status}`}>
          {session.status === 'active' ? '● Active' : '● Closed'}
        </span>
      </div>
      <p className="session-question">{session.question}</p>
      <div className="session-card-footer">
        <span className="vote-count">
          <FaChartBar /> {session.total_votes} vote{session.total_votes !== 1 ? 's' : ''}
        </span>
        <button className="btn-view-results">
          {session.status === 'active' ? 'Vote / Results' : 'View Results'}
        </button>
      </div>
    </div>
  );
}
