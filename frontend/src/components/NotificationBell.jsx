import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import api from '../api/api';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/api';
import '../styles/NotificationBell.css';

export default function NotificationBell() {
  const { user, accessToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Fetch unread count
  useEffect(() => {
    if (!user || !accessToken) {
      setUnreadCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/notifications/count/unread');
        setUnreadCount(res.data.unread || 0);
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          setUnreadCount(0);
          return;
        }
        console.error('Error fetching unread count:', err);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [accessToken, user]);

  // Subscribe to user-specific notification socket events for instant bell updates.
  useEffect(() => {
    if (!user?.id) return;

    const socketBaseUrl = String(import.meta.env.VITE_SOCKET_URL || API_BASE_URL)
      .trim()
      .replace(/\/+$/, '');
    const socket = io(socketBaseUrl);
    socket.emit('joinUser', user.id);

    const handleNotificationCreated = (notification) => {
      if (!notification) return;

      setUnreadCount((prev) => prev + (notification.is_read ? 0 : 1));
      setNotifications((prev) => [notification, ...prev].slice(0, 100));
    };

    socket.on('notificationCreated', handleNotificationCreated);

    return () => {
      socket.off('notificationCreated', handleNotificationCreated);
      socket.disconnect();
    };
  }, [user?.id]);

  // Fetch notifications when dropdown opens
  const handleBellClick = async () => {
    if (!user || !accessToken) return;
    if (!showDropdown) {
      setLoading(true);
      try {
        const res = await api.get('/notifications?unread=true');
        setNotifications(res.data || []);
        setSelectedIds([]);
      } catch (err) {
        if (err?.status === 401 || err?.response?.status === 401) {
          setNotifications([]);
          setSelectedIds([]);
          return;
        }
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
      setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (
      prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]
    ));
  };

  const selectAllVisible = () => {
    const visibleIds = notifications.map((n) => n.id);
    setSelectedIds(visibleIds);
  };

  const selectUnreadVisible = () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    setSelectedIds(unreadIds);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected notification(s)? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      await api.post('/notifications/bulk-delete', { ids: selectedIds });
      setNotifications((prev) => prev.filter((n) => !selectedIds.includes(n.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error('Error bulk deleting notifications:', err);
    } finally {
      setBulkDeleting(false);
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
        disabled={!user}
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
              {user && unreadCount > 0 && (
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

            {user && notifications.length > 0 && (
              <div className="dropdown-bulk-actions">
                <button className="bulk-action-btn" onClick={selectUnreadVisible}>
                  Select unread
                </button>
                <button className="bulk-action-btn" onClick={selectAllVisible}>
                  Select all
                </button>
                <button className="bulk-action-btn" onClick={clearSelection}>
                  Clear
                </button>
                <button
                  className="bulk-action-btn delete"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.length === 0 || bulkDeleting}
                >
                  {bulkDeleting ? 'Deleting...' : `Delete (${selectedIds.length})`}
                </button>
              </div>
            )}

            {/* Notifications List */}
            {!user ? (
              <div className="dropdown-empty">
                <p>Please log in to view notifications.</p>
              </div>
            ) : loading ? (
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
                    <label className="notif-select">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notif.id)}
                        onChange={() => toggleSelect(notif.id)}
                        aria-label={`Select notification ${notif.title}`}
                      />
                    </label>

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