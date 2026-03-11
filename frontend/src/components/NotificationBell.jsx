import { useState, useEffect } from 'react';
import api from '../api/api';
import '../styles/NotificationBell.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/notifications/count/unread');
        setUnreadCount(res.data.unread || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
      }
    };

    fetchUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when dropdown opens
  const handleBellClick = async () => {
    if (!showDropdown) {
      setLoading(true);
      try {
        const res = await api.get('/notifications?unread=true');
        setNotifications(res.data || []);
      } catch (err) {
        console.error('Error fetching notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    setShowDropdown(!showDropdown);
  };

  const handleMarkRead = async (id, isRead) => {
    try {
      await api.patch(`/notifications/${id}/read`, { is_read: !isRead });
      setNotifications(notifications.map(n =>
        n.id === id ? { ...n, is_read: !isRead } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Error marking notification:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
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

  return (
    <div className="notification-bell-container">
      {/* Bell Button */}
      <button
        className="bell-button"
        onClick={handleBellClick}
        aria-label="Notifications"
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className="bell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          <div
            className="dropdown-overlay"
            onClick={() => setShowDropdown(false)}
          ></div>

          <div className="notification-dropdown">
            {/* Header */}
            <div className="dropdown-header">
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button
                  className="mark-all-btn"
                  onClick={async () => {
                    try {
                      await api.patch('/notifications/mark-all/read', {});
                      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
                      setUnreadCount(0);
                    } catch (err) {
                      console.error('Error:', err);
                    }
                  }}
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            {loading ? (
              <div className="dropdown-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="dropdown-empty">
                <p>All caught up! 🎉</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`notification-item ${notif.is_read ? '' : 'unread'}`}
                  >
                    <div
                      className="notif-icon"
                      style={{ color: getTypeColor(notif.type) }}
                    >
                      {getNotificationIcon(notif.type)}
                    </div>

                    <div className="notif-content">
                      <h4 className="notif-title">{notif.title}</h4>
                      <p className="notif-message">{notif.message.substring(0, 60)}...</p>
                      <span className="notif-time">
                        {new Date(notif.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="notif-actions">
                      <button
                        className="notif-action-btn"
                        onClick={() => handleMarkRead(notif.id, notif.is_read)}
                        title={notif.is_read ? 'Mark unread' : 'Mark read'}
                      >
                        {notif.is_read ? '✉️' : '📬'}
                      </button>
                      <button
                        className="notif-action-btn delete"
                        onClick={() => handleDelete(notif.id)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="dropdown-footer">
              <a href="/dashboard/notifications" className="view-all-link">
                View all notifications →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}