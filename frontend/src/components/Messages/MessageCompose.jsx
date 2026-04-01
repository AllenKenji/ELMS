import { useState, useEffect } from 'react';
import api from '../../api/api';
import '../../styles/MessageCompose.css';

export default function MessageCompose({ onSuccess, onCancel, replyTo = null }) {
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    receiver_id: replyTo?.sender_id || '',
    subject: replyTo ? `Re: ${replyTo.subject}` : '',
    body: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Fetch users for recipient dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users');
        setUsers(res.data || []);
      } catch (err) {
        console.error('Error fetching users:', err);
      }
    };
    fetchUsers();
  }, []);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.receiver_id) {
      newErrors.receiver_id = 'Recipient is required';
    }

    if (!formData.subject?.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.trim().length < 3) {
      newErrors.subject = 'Subject must be at least 3 characters';
    }

    if (!formData.body?.trim()) {
      newErrors.body = 'Message body is required';
    } else if (formData.body.trim().length < 5) {
      newErrors.body = 'Message must be at least 5 characters';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        receiver_id: parseInt(formData.receiver_id),
        subject: formData.subject.trim(),
        body: formData.body.trim(),
      };

      await api.post('/messages', payload);
      setSuccess('Message sent successfully!');

      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        'Error sending message. Please try again.';
      setError(msg);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      receiver_id: replyTo?.sender_id || '',
      subject: replyTo ? `Re: ${replyTo.subject}` : '',
      body: '',
    });
    setFormErrors({});
    setError('');
    setSuccess('');
  };

  return (
    <div className="compose-modal-overlay">
      <div className="compose-modal">
        {/* Header */}
        <div className="compose-header">
          <h2>New Message</h2>
          <button
            className="btn-close"
            onClick={onCancel}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="compose-form">
          {/* Alerts */}
          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              <p>{success}</p>
            </div>
          )}

          {/* Recipient Field */}
          <div className="form-group">
            <label htmlFor="receiver_id">
              To <span className="required">*</span>
            </label>
            <select
              id="receiver_id"
              name="receiver_id"
              value={formData.receiver_id}
              onChange={handleChange}
              className={formErrors.receiver_id ? 'input-error' : ''}
              required
            >
              <option value="">Select a recipient...</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
            {formErrors.receiver_id && (
              <span className="error-text">{formErrors.receiver_id}</span>
            )}
          </div>

          {/* Subject Field */}
          <div className="form-group">
            <label htmlFor="subject">
              Subject <span className="required">*</span>
            </label>
            <input
              id="subject"
              type="text"
              name="subject"
              placeholder="Message subject"
              value={formData.subject}
              onChange={handleChange}
              className={formErrors.subject ? 'input-error' : ''}
              maxLength="255"
              required
            />
            {formErrors.subject && (
              <span className="error-text">{formErrors.subject}</span>
            )}
            <span className="char-count">
              {formData.subject.length}/255
            </span>
          </div>

          {/* Body Field */}
          <div className="form-group">
            <label htmlFor="body">
              Message <span className="required">*</span>
            </label>
            <textarea
              id="body"
              name="body"
              placeholder="Type your message here..."
              value={formData.body}
              onChange={handleChange}
              className={formErrors.body ? 'input-error' : ''}
              rows="8"
              required
            />
            {formErrors.body && (
              <span className="error-text">{formErrors.body}</span>
            )}
            <span className="char-count">
              {formData.body.length} characters
            </span>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={loading}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}