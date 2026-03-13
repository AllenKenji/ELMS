import { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import '../../styles/EventsCalendar.css';

const SESSION_STATUS_COLORS = {
  Upcoming: '#27ae60',
  Active: '#3498db',
  Completed: '#7f8c8d',
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getSessionStatus(session) {
  const now = new Date();
  const sessionDate = new Date(session.date);
  if (sessionDate > now) return 'Upcoming';
  const endTime = new Date(sessionDate.getTime() + 2 * 60 * 60 * 1000);
  if (now >= sessionDate && now <= endTime) return 'Active';
  return 'Completed';
}

function buildCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d);
  }
  return days;
}

function getDayClassName(isTodayDay, isSelected, hasEvents) {
  const classes = ['calendar-day'];
  if (isTodayDay) classes.push('today');
  if (isSelected) classes.push('selected');
  if (hasEvents) classes.push('has-events');
  return classes.join(' ');
}

export default function EventsCalendar() {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [filterType, setFilterType] = useState('');

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/sessions');
      setSessions(res.data || []);
    } catch (err) {
      setError('Failed to load sessions. Please try again.');
      console.error('Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const handleToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    setSelectedDay(today.getDate());
  };

  // Group sessions by date string (YYYY-MM-DD)
  const sessionsByDate = {};
  sessions.forEach((session) => {
    const d = new Date(session.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    sessionsByDate[key].push(session);
  });

  const calendarDays = buildCalendarDays(currentYear, currentMonth);

  const getDateKey = (day) =>
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isToday = (day) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  // Sessions for the selected day
  const selectedDateKey = selectedDay ? getDateKey(selectedDay) : null;
  const selectedSessions = selectedDateKey
    ? (sessionsByDate[selectedDateKey] || []).filter(
        (s) => !filterType || s.type === filterType
      )
    : [];

  // Unique session types for filter
  const sessionTypes = [...new Set(sessions.map((s) => s.type).filter(Boolean))];

  // Monthly stats
  const monthSessions = Object.entries(sessionsByDate)
    .filter(([key]) => key.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`))
    .flatMap(([, arr]) => arr);

  const stats = {
    total: monthSessions.length,
    upcoming: monthSessions.filter((s) => getSessionStatus(s) === 'Upcoming').length,
    completed: monthSessions.filter((s) => getSessionStatus(s) === 'Completed').length,
  };

  if (loading) {
    return (
      <div className="calendar-container">
        <h3>📅 Events Calendar</h3>
        <div className="loading-spinner">
          <div className="spinner-icon"></div>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="header-content">
          <h3>📅 Events Calendar</h3>
          <p className="header-subtitle">Legislative sessions and events</p>
        </div>
        <div className="calendar-controls">
          {sessionTypes.length > 0 && (
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="filter-select"
              aria-label="Filter by session type"
            >
              <option value="">All Types</option>
              {sessionTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
          <button onClick={fetchSessions} className="btn-refresh" title="Refresh">
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="calendar-stats">
        <div className="cal-stat-card">
          <span className="cal-stat-value">{stats.total}</span>
          <span className="cal-stat-label">This Month</span>
        </div>
        <div className="cal-stat-card upcoming">
          <span className="cal-stat-value">{stats.upcoming}</span>
          <span className="cal-stat-label">Upcoming</span>
        </div>
        <div className="cal-stat-card completed">
          <span className="cal-stat-value">{stats.completed}</span>
          <span className="cal-stat-label">Completed</span>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="month-nav">
        <button onClick={handlePrevMonth} className="btn-nav" aria-label="Previous month">
          ‹
        </button>
        <div className="month-title">
          <h4>{MONTHS[currentMonth]} {currentYear}</h4>
        </div>
        <button onClick={handleNextMonth} className="btn-nav" aria-label="Next month">
          ›
        </button>
        <button onClick={handleToday} className="btn-today">
          Today
        </button>
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        {Object.entries(SESSION_STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: color }}></span>
            {status}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {/* Day headers */}
        {DAYS_OF_WEEK.map((d) => (
          <div key={d} className="calendar-day-header">{d}</div>
        ))}

        {/* Day cells */}
        {calendarDays.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="calendar-day empty"></div>;
          }

          const dateKey = getDateKey(day);
          const daySessions = (sessionsByDate[dateKey] || []).filter(
            (s) => !filterType || s.type === filterType
          );
          const hasEvents = daySessions.length > 0;
          const isSelected = selectedDay === day;
          const isTodayDay = isToday(day);

          return (
            <button
              key={day}
              className={getDayClassName(isTodayDay, isSelected, hasEvents)}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              aria-label={`${MONTHS[currentMonth]} ${day}, ${currentYear}${hasEvents ? `, ${daySessions.length} event(s)` : ''}`}
            >
              <span className="day-number">{day}</span>
              {hasEvents && (
                <div className="day-events">
                  {daySessions.slice(0, 3).map((s) => {
                    const status = getSessionStatus(s);
                    return (
                      <span
                        key={s.id}
                        className="event-dot"
                        style={{ backgroundColor: SESSION_STATUS_COLORS[status] }}
                        title={s.title}
                      ></span>
                    );
                  })}
                  {daySessions.length > 3 && (
                    <span className="event-more">+{daySessions.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Event Details Panel */}
      {selectedDay && (
        <div className="event-details-panel">
          <div className="panel-header">
            <h4>
              📋 {MONTHS[currentMonth]} {selectedDay}, {currentYear}
            </h4>
            <button
              className="btn-close-panel"
              onClick={() => setSelectedDay(null)}
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>

          {selectedSessions.length === 0 ? (
            <div className="panel-empty">
              <p>No sessions on this day.</p>
            </div>
          ) : (
            <div className="panel-sessions">
              {selectedSessions.map((session) => {
                const status = getSessionStatus(session);
                const sessionDate = new Date(session.date);
                return (
                  <div key={session.id} className="panel-session-card">
                    <div
                      className="session-status-bar"
                      style={{ backgroundColor: SESSION_STATUS_COLORS[status] }}
                    ></div>
                    <div className="session-card-content">
                      <div className="session-card-header">
                        <h5>{session.title}</h5>
                        <span
                          className="session-status-badge"
                          style={{ backgroundColor: SESSION_STATUS_COLORS[status] }}
                        >
                          {status}
                        </span>
                      </div>
                      <div className="session-meta-row">
                        <span>🕐 {sessionDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>📍 {session.location || 'Not specified'}</span>
                      </div>
                      {session.type && (
                        <div className="session-type-tag">{session.type}</div>
                      )}
                      {session.agenda && (
                        <p className="session-agenda-text">{session.agenda}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
