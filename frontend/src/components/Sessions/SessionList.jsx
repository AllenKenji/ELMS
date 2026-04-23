import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import RichTextContent from '../common/RichTextContent';
import SessionForm from './SessionForm';
import SessionDetails from './SessionDetails';
import '../../styles/SessionList.css';

function getSessionDate(session) {
  const sessionDate = new Date(session.date);
  return Number.isNaN(sessionDate.getTime()) ? null : sessionDate;
}

function isCompletedSession(session) {
  const sessionDate = getSessionDate(session);
  return Boolean(sessionDate && sessionDate < new Date());
}

function formatDuration(totalMinutes) {
  const minutes = Number(totalMinutes || 0);
  if (!minutes) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours && remainder) {
    return `${hours}h ${remainder}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${remainder}m`;
}

function formatSessionTimeRange(session) {
  const sessionDate = getSessionDate(session);
  if (!sessionDate) {
    return 'Time not specified';
  }

  const startText = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalMinutes = Number(session.total_oob_minutes || 0);
  if (!totalMinutes) {
    return startText;
  }

  const endDate = new Date(sessionDate.getTime() + totalMinutes * 60000);
  const endText = endDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${startText} - ${endText}`;
}

function matchesSessionFilter(session, filter) {
  if (filter === 'completed') {
    return isCompletedSession(session);
  }

  if (filter === 'upcoming') {
    return !isCompletedSession(session);
  }

  return true;
}

function sortSessions(list, sortBy) {
  return [...list].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date) - new Date(a.date);
    }

    return a.title.localeCompare(b.title);
  });
}

function SessionSection({ title, count, sessions, canCreateSession, onViewDetails, onEditSession }) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <section className="session-section">
      <div className="session-section-header">
        <h4>{title}</h4>
        <span className="session-section-count">{count}</span>
      </div>

      <div className="sessions-grid">
        {sessions.map((session) => {
          const sessionDate = new Date(session.date);
          const status = isCompletedSession(session) ? 'Completed' : 'Upcoming';
          const totalDuration = formatDuration(session.total_oob_minutes);

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
                    🕐 {formatSessionTimeRange(session)}
                  </span>
                </div>

                <div className="session-meta">
                  <span className="meta-item">
                    📍 {session.location || 'Not specified'}
                  </span>
                  {totalDuration && (
                    <span className="meta-item session-duration-chip">
                      ⏱️ {totalDuration}
                    </span>
                  )}
                </div>

                <RichTextContent
                  value={session.agenda}
                  className="session-agenda"
                  fallback="No agenda text provided"
                />
              </div>

              <div className="card-footer">
                <button
                  onClick={() => onViewDetails(session)}
                  className="btn-view"
                >
                  👁️ View Details
                </button>
                {canCreateSession && (
                  <button
                    onClick={() => onEditSession(session)}
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
    </section>
  );
}

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
  const [sessionFilter, setSessionFilter] = useState('upcoming');

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

  const searchedSessions = useMemo(
    () => sessions.filter((session) =>
      session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.location?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [searchTerm, sessions]
  );

  const filteredSessions = useMemo(
    () => searchedSessions.filter((session) => matchesSessionFilter(session, sessionFilter)),
    [searchedSessions, sessionFilter]
  );

  const sortedFilteredSessions = useMemo(
    () => sortSessions(filteredSessions, sortBy),
    [filteredSessions, sortBy]
  );

  const upcomingSessions = useMemo(
    () => sortSessions(searchedSessions.filter((session) => !isCompletedSession(session)), sortBy),
    [searchedSessions, sortBy]
  );

  const completedSessions = useMemo(
    () => sortSessions(searchedSessions.filter((session) => isCompletedSession(session)), sortBy),
    [searchedSessions, sortBy]
  );

  const sessionCounts = useMemo(
    () => ({
      all: searchedSessions.length,
      upcoming: searchedSessions.filter((session) => !isCompletedSession(session)).length,
      completed: searchedSessions.filter((session) => isCompletedSession(session)).length,
    }),
    [searchedSessions]
  );

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

      <div className="session-filter-tabs" role="tablist" aria-label="Filter sessions by completion status">
        <button className={sessionFilter === 'upcoming' ? 'session-filter-tab active' : 'session-filter-tab'} onClick={() => setSessionFilter('upcoming')}>
          Upcoming ({sessionCounts.upcoming})
        </button>
        <button className={sessionFilter === 'completed' ? 'session-filter-tab active' : 'session-filter-tab'} onClick={() => setSessionFilter('completed')}>
          Completed ({sessionCounts.completed})
        </button>
        <button className={sessionFilter === 'all' ? 'session-filter-tab active' : 'session-filter-tab'} onClick={() => setSessionFilter('all')}>
          All ({sessionCounts.all})
        </button>
      </div>

      {sortedFilteredSessions.length === 0 ? (
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
            <p>Showing <strong>{sortedFilteredSessions.length}</strong> of <strong>{sessions.length}</strong> sessions</p>
          </div>

          {sessionFilter === 'all' ? (
            <div className="session-sections">
              <SessionSection
                title="Upcoming Sessions"
                count={upcomingSessions.length}
                sessions={upcomingSessions}
                canCreateSession={canCreateSession}
                onViewDetails={handleViewDetails}
                onEditSession={handleEditSession}
              />
              <SessionSection
                title="Completed Sessions"
                count={completedSessions.length}
                sessions={completedSessions}
                canCreateSession={canCreateSession}
                onViewDetails={handleViewDetails}
                onEditSession={handleEditSession}
              />
            </div>
          ) : (
            <SessionSection
              title={sessionFilter === 'completed' ? 'Completed Sessions' : 'Upcoming Sessions'}
              count={sortedFilteredSessions.length}
              sessions={sortedFilteredSessions}
              canCreateSession={canCreateSession}
              onViewDetails={handleViewDetails}
              onEditSession={handleEditSession}
            />
          )}
        </>
      )}
    </div>
  );
}