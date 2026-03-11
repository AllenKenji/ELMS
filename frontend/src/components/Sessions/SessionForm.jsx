import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/SessionForm.css';

export default function SessionForm({ onSuccess, onCancel, sessionId = null, initialData = null }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(
    initialData || {
      title: '',
      date: '',
      time: '14:00',
      location: '',
      agenda: '',
      notes: '',
    }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.trim().length > 150) {
      newErrors.title = 'Title cannot exceed 150 characters';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.date = 'Session date cannot be in the past';
      }
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    }

    if (!formData.location?.trim()) {
      newErrors.location = 'Location is required';
    } else if (formData.location.trim().length < 3) {
      newErrors.location = 'Location must be at least 3 characters';
    }

    if (!formData.agenda?.trim()) {
      newErrors.agenda = 'Agenda is required';
    } else if (formData.agenda.trim().length < 10) {
      newErrors.agenda = 'Agenda must be at least 10 characters';
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

    // Clear error for this field
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
      // Combine date and time
      const dateTime = `${formData.date}T${formData.time}:00`;

      const payload = {
        title: formData.title.trim(),
        date: dateTime,
        location: formData.location.trim(),
        agenda: formData.agenda.trim(),
        notes: formData.notes.trim() || null,
      };

      let response;
      if (sessionId) {
        // Update existing session
        response = await api.put(`/sessions/${sessionId}`, payload);
        setSuccess('Session updated successfully!');
      } else {
        // Create new session
        response = await api.post('/sessions', payload);
        setSuccess('Session created successfully!');
      }

      // Reset form
      setFormData({
        title: '',
        date: '',
        time: '14:00',
        location: '',
        agenda: '',
        notes: '',
      });

      // Call success callback after 1.5 seconds
      setTimeout(() => onSuccess?.(response.data), 1500);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Error processing session. Please try again.';
      setError(msg);
      console.error('Session error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      date: '',
      time: '14:00',
      location: '',
      agenda: '',
      notes: '',
    });
    setFormErrors({});
    setError('');
    setSuccess('');
  };

  // Get min date (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="session-form-wrapper">
      <form onSubmit={handleSubmit} className="session-form-container">
        <div className="form-header">
          <div className="form-title-section">
            <h3>📅 {sessionId ? 'Edit Session' : 'Create New Session'}</h3>
            <p className="form-subtitle">
              Organized by: <strong>{user?.name || 'Unknown'}</strong>
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-close-form"
              aria-label="Close form"
              disabled={loading}
            >
              ✕
            </button>
          )}
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="alert">
            <span className="alert-icon">✓</span>
            <div>
              <strong>Success</strong>
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Form Grid */}
        <div className="form-grid">
          {/* Title */}
          <div className="form-group full-width">
            <label htmlFor="title">Session Title *</label>
            <input
              id="title"
              type="text"
              name="title"
              placeholder="e.g., Regular Session - March 2026"
              value={formData.title}
              onChange={handleChange}
              disabled={loading}
              maxLength="150"
              aria-invalid={!!formErrors.title}
              aria-describedby={formErrors.title ? 'title-error' : 'title-hint'}
            />
            <div className="form-hint" id="title-hint">
              {formData.title.length}/150 characters
            </div>
            {formErrors.title && (
              <span id="title-error" className="error-text">{formErrors.title}</span>
            )}
          </div>

          {/* Date */}
          <div className="form-group">
            <label htmlFor="date">Date *</label>
            <input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              disabled={loading}
              min={today}
              aria-invalid={!!formErrors.date}
              aria-describedby={formErrors.date ? 'date-error' : undefined}
            />
            {formErrors.date && (
              <span id="date-error" className="error-text">{formErrors.date}</span>
            )}
          </div>

          {/* Time */}
          <div className="form-group">
            <label htmlFor="time">Time *</label>
            <input
              id="time"
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              disabled={loading}
              aria-invalid={!!formErrors.time}
              aria-describedby={formErrors.time ? 'time-error' : undefined}
            />
            {formErrors.time && (
              <span id="time-error" className="error-text">{formErrors.time}</span>
            )}
          </div>

          {/* Location */}
          <div className="form-group full-width">
            <label htmlFor="location">Location *</label>
            <input
              id="location"
              type="text"
              name="location"
              placeholder="e.g., Barangay Hall, Community Center"
              value={formData.location}
              onChange={handleChange}
              disabled={loading}
              aria-invalid={!!formErrors.location}
              aria-describedby={formErrors.location ? 'location-error' : undefined}
            />
            {formErrors.location && (
              <span id="location-error" className="error-text">{formErrors.location}</span>
            )}
          </div>

          {/* Agenda */}
          <div className="form-group full-width">
            <label htmlFor="agenda">Agenda *</label>
            <textarea
              id="agenda"
              name="agenda"
              placeholder="List the main topics and items to be discussed..."
              value={formData.agenda}
              onChange={handleChange}
              disabled={loading}
              rows="4"
              aria-invalid={!!formErrors.agenda}
              aria-describedby={formErrors.agenda ? 'agenda-error' : 'agenda-hint'}
            />
            <div className="form-hint" id="agenda-hint">
              {formData.agenda.length} characters
            </div>
            {formErrors.agenda && (
              <span id="agenda-error" className="error-text">{formErrors.agenda}</span>
            )}
          </div>

          {/* Notes */}
          <div className="form-group full-width">
            <label htmlFor="notes">Additional Notes (Optional)</label>
            <textarea
              id="notes"
              name="notes"
              placeholder="Add any additional information..."
              value={formData.notes}
              onChange={handleChange}
              disabled={loading}
              rows="3"
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="btn-submit"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                {sessionId ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                📅 {sessionId ? 'Update Session' : 'Create Session'}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="btn-reset"
          >
            Clear Form
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="btn-cancel"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Helper Text */}
        <div className="form-helper">
          <p>
            <strong>💡 Tips:</strong>
            <ul>
              <li>Future dates only - select a date that hasn't passed</li>
              <li>Be specific in the agenda for better participation</li>
              <li>All marked with * are required fields</li>
              <li>Session will be broadcast to all council members</li>
            </ul>
          </p>
        </div>
      </form>
    </div>
  );
}