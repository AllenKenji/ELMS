import { useState, useEffect } from 'react';
import api from '../api/api';
import '../styles/NotificationList.css';

const NOTIFICATION_TYPES = [
  { value: 'system', label: '⚙️ System', color: '#4a90e2' },
  { value: 'approval', label: '✓ Approval', color: '#27ae60' },
  { value: 'message', label: '📧 Message', color: '#f39c12' },
  { value: 'activity', label: '📊 Activity', color: '#3498db' },
  { value: 'mention', label: '👤 Mention', color: '#e74c3c' },
  { value: 'warning', label: '⚠️ Warning', color: '#e67e22' },
];

export default function NotificationList() {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState(''); // '', 'read', 'unread'
  const [sortBy, setSortBy] = useState('newest');

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.get('/notifications');
        setNotifications(res.data || []);
      } catch (err) {
        setError('Failed to load notifications');
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // Filter and sort
  useEffect(() => {
    let filtered = [...notifications];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(n =>
        n.title?.toLowerCase().includes(term) ||
        n.message?.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter(n => n.type === typeFilter);
    }

    // Read filter
    if (readFilter === 'read') {
      filtered = filtered.filter(n => n.is_read);
    } else if (readFilter === 'unread') {
      filtered = filtered.filter(n => !n.is_read);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        default:
          return 0;
      }
    });

    setFilteredNotifications(filtered);
  }, [notifications, searchTerm, typeFilter, readFilter, sortBy]);

  const handleMarkRead = async (id, isRead) => {
    try {
      await api.patch(`/notifications/${id}/read`, { is_read: !isRead });
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: !isRead } : n
      ));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all/read', {});
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'system': '⚙️',
      'approval': '✓',
      'message': '📧',
      'activity': '📊',
      'mention': '👤',
      'warning': '⚠️',
    };
    return icons[type] || '🔔';
  };

  const getTypeColor = (type) => {
    const colors = {
      'system': '#4a90e2',
      'approval': '#27ae60',
      'message': '#f39c12',
      'activity': '#3498db',
      'mention': '#e74c3c',
      'warning': '#e67e22',
    };
    return colors[type] || '#999';
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notification-list-container">
      {/* Header */}
      <div className="list-header">
        <div className="header-content">
          <h3>Notifications</h3>
          <p className="header-subtitle">
            {unreadCount > 0
              ? `${unreadCount} new notification${unreadCount !== 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button className="btn-mark-all" onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="list-filters">
        {/* Search */}
        <div className="search-box">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Type Filter */}
        <div className="filter-group">
          <label>Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Types</option>
            {NOTIFICATION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Read Status Filter */}
        <div className="filter-group">
          <label>Status</label>
          <select
            value={readFilter}
            onChange={(e) => setReadFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">All Notifications</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>

        {/* Sort */}
        <div className="filter-group">
          <label>Sort</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <p>
          Showing <strong>{filteredNotifications.length}</strong> of{' '}
          <strong>{notifications.length}</strong> notifications
        </p>
      </div>

      {/* Loading / Empty State */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">🎉</p>
          <h4>No Notifications</h4>
          <p>
            {searchTerm || typeFilter || readFilter
              ? 'Try adjusting your filters'
              : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        /* Notifications List */
        <div className="notifications-grid">
          {filteredNotifications.map(notif => (
            <div
              key={notif.id}
              className={`notification-card ${notif.is_read ? '' : 'unread'}`}
            >
              {/* Card Header */}
              <div className="card-header">
                <div className="header-left">
                  <div
                    className="notif-icon"
                    style={{ color: getTypeColor(notif.type) }}
                  >
                    {getNotificationIcon(notif.type)}
                  </div>
                  <div>
                    <h4 className="notif-title">{notif.title}</h4>
                    <span className="notif-type">{notif.type}</span>
                  </div>
                </div>

                {!notif.is_read && <div className="unread-dot"></div>}
              </div>

              {/* Card Content */}
              <div className="card-content">
                <p className="notif-message">{notif.message}</p>
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <span className="notif-time">
                  {new Date(notif.created_at).toLocaleString()}
                </span>

                <div className="card-actions">
                  <button
                    className="btn-action"
                    onClick={() => handleMarkRead(notif.id, notif.is_read)}
                    title={notif.is_read ? 'Mark unread' : 'Mark read'}
                  >
                    {notif.is_read ? '✉️' : '📬'}
                  </button>
                  <button
                    className="btn-action delete"
                    onClick={() => handleDelete(notif.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}