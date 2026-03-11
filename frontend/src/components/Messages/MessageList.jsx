import { useState, useEffect } from 'react';
import api from '../../api/api';
import MessageThread from './MessageThread';
import MessageCompose from './MessageCompose';
import '../../styles/MessageList.css';

export default function MessageList() {
  
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI State
  const [activeTab, setActiveTab] = useState('inbox'); // inbox, sent
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch messages
  const fetchMessages = async (tab = 'inbox') => {
    try {
      setLoading(true);
      setError('');
      
      const endpoint = tab === 'inbox' ? '/messages/inbox' : '/messages/sent';
      const res = await api.get(endpoint);
      setMessages(res.data || []);
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/messages/count/unread');
      setUnreadCount(res.data.unread || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMessages(activeTab);
    fetchUnreadCount();
  }, [activeTab]);

  // Search filter
  useEffect(() => {
    let filtered = [...messages];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.subject?.toLowerCase().includes(term) ||
        msg.body?.toLowerCase().includes(term) ||
        msg.sender_name?.toLowerCase().includes(term) ||
        msg.receiver_name?.toLowerCase().includes(term)
      );
    }

    setFilteredMessages(filtered);
  }, [messages, searchTerm]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message?')) return;

    try {
      await api.delete(`/messages/${id}`);
      setMessages(messages.filter(m => m.id !== id));
      setSelectedMessage(null);
    } catch (err) {
      setError('Failed to delete message');
      console.error('Error:', err);
    }
  };

  const handleMarkRead = async (id, isRead) => {
    try {
      await api.patch(`/messages/${id}/read`, { is_read: !isRead });
      setMessages(messages.map(m =>
        m.id === id ? { ...m, is_read: !isRead } : m
      ));
      if (selectedMessage?.id === id) {
        setSelectedMessage({ ...selectedMessage, is_read: !isRead });
      }
      fetchUnreadCount();
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="message-list-container">
      {/* Header */}
      <div className="message-header">
        <div className="header-content">
          <h3>Messages</h3>
          <p className="header-subtitle">Send and receive messages with users</p>
        </div>
        <button
          className="btn-compose"
          onClick={() => setShowCompose(true)}
        >
          ✉️ New Message
        </button>
      </div>

      {/* Tabs */}
      <div className="message-tabs">
        <button
          className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('inbox')}
        >
          📥 Inbox
          {unreadCount > 0 && (
            <span className="badge">{unreadCount}</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'sent' ? 'active' : ''}`}
          onClick={() => setActiveTab('sent')}
        >
          📤 Sent
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error">
          <span>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="message-search">
        <input
          type="text"
          placeholder="Search messages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Messages List */}
      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading messages...</p>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="empty-state">
          <p className="empty-icon">📭</p>
          <h4>No Messages</h4>
          <p>
            {searchTerm
              ? 'No messages match your search'
              : activeTab === 'inbox'
              ? 'Your inbox is empty'
              : 'You haven\'t sent any messages yet'}
          </p>
          {activeTab === 'inbox' && (
            <button
              className="btn-empty-action"
              onClick={() => setShowCompose(true)}
            >
              Send First Message
            </button>
          )}
        </div>
      ) : (
        <div className="messages-grid">
          {filteredMessages.map(message => (
            <div
              key={message.id}
              className={`message-card ${message.is_read ? '' : 'unread'}`}
              onClick={() => setSelectedMessage(message)}
            >
              {/* Unread Badge */}
              {!message.is_read && activeTab === 'inbox' && (
                <div className="unread-indicator"></div>
              )}

              {/* Card Content */}
              <div className="card-header">
                <h4 className="message-subject">{message.subject}</h4>
                <span className="message-date">
                  {new Date(message.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="message-from">
                {activeTab === 'inbox' ? '📨 From' : '📤 To'}: {activeTab === 'inbox' ? message.sender_name : message.receiver_name}
              </p>

              <p className="message-preview">{message.body.substring(0, 80)}...</p>

              {/* Card Actions */}
              <div className="card-actions">
                <button
                  className="btn-read-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkRead(message.id, message.is_read);
                  }}
                  title={message.is_read ? 'Mark unread' : 'Mark read'}
                >
                  {message.is_read ? '👁️' : '👁️‍🗨️'}
                </button>
                <button
                  className="btn-delete-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(message.id);
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message Thread Modal */}
      {selectedMessage && (
        <MessageThread
          message={selectedMessage}
          onClose={() => setSelectedMessage(null)}
          onDelete={() => {
            handleDelete(selectedMessage.id);
          }}
          onReply={() => {
            setShowCompose(true);
            setSelectedMessage(null);
          }}
        />
      )}

      {/* Compose Modal */}
      {showCompose && (
        <MessageCompose
          onSuccess={() => {
            setShowCompose(false);
            fetchMessages(activeTab);
            fetchUnreadCount();
          }}
          onCancel={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}