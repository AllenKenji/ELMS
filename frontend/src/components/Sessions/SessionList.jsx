import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import RichTextContent from '../common/RichTextContent';
import SessionForm from './SessionForm';
import SessionDetails from './SessionDetails';
import '../../styles/SessionList.css';

export default function SessionList() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [sortBy, setSortBy] = useState('date');

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/sessions');
      setSessions(res.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load sessions.');
      console.error('Error:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleNewSession = () => {
    setEditingSession(null);
    setShowForm(true);
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
    setShowForm(true);
    setShowDetails(false);
  };

  const handleDeleteSession = () => {
    fetchSessions();
    setShowDetails(false);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSession(null);
    fetchSessions();
  };

  const handleViewDetails = (session) => {
    setSelectedSession(session);
    setShowDetails(true);
  };

  // Filter and sort
  let filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  filteredSessions = filteredSessions.sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date) - new Date(a.date);
    }
    return a.title.localeCompare(b.title);
  });

  const canCreateSession = ['Admin', 'Secretary'].includes(user?.role);

  if (showForm && editingSession) {
    return (
      <SessionForm
        sessionId={editingSession.id}
        initialData={{
          title: editingSession.title,
          date: editingSession.date?.split('T')[0],
          time: editingSession.date?.split('T')[1]?.substring(0, 5) || '14:00',
          location: editingSession.location,
          agenda: editingSession.agenda,
          notes: editingSession.notes,
        }}
        onSuccess={handleFormSuccess}
        onCancel={() => {
          setShowForm(false);
          setEditingSession(null);
        }}
      />
    );
  }

  if (showForm) {
    return (
      <SessionForm
        onSuccess={handleFormSuccess}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  if (showDetails && selectedSession) {
    return (
      <SessionDetails
        sessionId={selectedSession.id}
        onClose={() => {
          setShowDetails(false);
          setSelectedSession(null);
        }}
        onEdit={handleEditSession}
        onDelete={handleDeleteSession}
      />
    );
  }

  if (loading) {
    return (
      <div className="session-list-container">
        <h3>📅 Legislative Sessions</h3>
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="session-list-container">
      {/* Header */}
      <div className="list-header">
        <div className="header-content">
          <h3>📅 Legislative Sessions</h3>
          <p className="header-subtitle">Schedule and manage council sessions</p>
        </div>
        {canCreateSession && (
          <button
            onClick={handleNewSession}
            className="btn-new-session"
            aria-label="Create new session"
          >
            ➕ New Session
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="list-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="🔍 Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
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
          </select>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h4>No sessions found</h4>
          <p className="text-muted">
            {searchTerm ? 'Try adjusting your search' : 'No sessions scheduled yet'}
          </p>
          {!searchTerm && canCreateSession && (
            <button onClick={handleNewSession} className="btn-empty-action">
              ➕ Create First Session
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="results-info">
            <p>Showing <strong>{filteredSessions.length}</strong> of <strong>{sessions.length}</strong> sessions</p>
          </div>

          {/* Sessions Grid */}
          <div className="sessions-grid">
            {filteredSessions.map((session) => {
              const sessionDate = new Date(session.date);
              const status = sessionDate < new Date() ? 'Completed' : 'Upcoming';

              return (
                <div key={session.id} className="session-card">
                  <div className="card-status">
                    <span className={`status-badge ${status.toLowerCase()}`}>
                      {status}
                    </span>
                  </div>

                  <div className="card-content">
                    <h4>{session.title}</h4>

                    <div className="session-meta">
                      <span className="meta-item">
                        📅 {sessionDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="meta-item">
                        🕐 {sessionDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="session-meta">
                      <span className="meta-item">
                        📍 {session.location || 'Not specified'}
                      </span>
                    </div>

                    <RichTextContent
                      value={session.agenda}
                      className="session-agenda"
                      fallback="No agenda text provided"
                    />
                  </div>

                  <div className="card-footer">
                    <button
                      onClick={() => handleViewDetails(session)}
                      className="btn-view"
                    >
                      👁️ View Details
                    </button>
                    {canCreateSession && (
                      <button
                        onClick={() => handleEditSession(session)}
                        className="btn-edit-card"
                      >
                        ✏️ Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}