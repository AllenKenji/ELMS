import { useState, useEffect } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import RichTextEditor from '../common/RichTextEditor';
import { richTextToPlainText, hasMeaningfulRichText } from '../../utils/richText';
import '../../styles/SessionForm.css';

const MAX_READING_NUMBER = 3;

function normalizeSessionFormData(data) {
  const source = data || {};
  let normalizedDate = '';
  let normalizedTime = '14:00';

  if (source.date) {
    const parsed = new Date(source.date);
    if (!Number.isNaN(parsed.getTime())) {
      normalizedDate = parsed.toISOString().split('T')[0];
      normalizedTime = parsed.toTimeString().slice(0, 5);
    }
  }

  return {
    title: source.title ?? '',
    date: normalizedDate,
    time: source.time ?? normalizedTime,
    location: source.location ?? '',
    agenda: source.agenda ?? '',
    notes: source.notes ?? '',
  };
}

function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default function SessionForm({ onSuccess, onCancel, sessionId = null, initialData = null }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState(normalizeSessionFormData(initialData));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Agenda builder state (only used when creating a new session)
  const canManageAgenda = ['Admin', 'Secretary'].includes(user?.role);
  const [agendaItems, setAgendaItems] = useState([]);
  const [availableOrdinances, setAvailableOrdinances] = useState([]);
  const [selectedOrdinanceId, setSelectedOrdinanceId] = useState('');
  const [readingNumber, setReadingNumber] = useState('');
  const [showAgendaAdd, setShowAgendaAdd] = useState(false);
  const [agendaError, setAgendaError] = useState('');

  // Unassigned OOB items state
  const [unassignedOob, setUnassignedOob] = useState([]);
  const [selectedOobIds, setSelectedOobIds] = useState(new Set());

  useEffect(() => {
    setFormData(normalizeSessionFormData(initialData));
  }, [initialData]);

  useEffect(() => {
    if (!sessionId && canManageAgenda) {
      api.get('/ordinances')
        .then(res => setAvailableOrdinances(res.data || []))
        .catch(() => setAvailableOrdinances([]));
      // Fetch unassigned OOB items
      api.get('/order-of-business/unassigned')
        .then(res => {
          const items = res.data || [];
          setUnassignedOob(items);
          // Pre-select all unassigned items
          setSelectedOobIds(new Set(items.map(i => i.id)));
        })
        .catch(() => setUnassignedOob([]));
    }
  }, [sessionId, canManageAgenda]);

  const agendaOrdinanceIds = new Set(agendaItems.map(i => String(i.ordinance_id)));
  const unscheduledOrdinances = availableOrdinances.filter(
    o => !agendaOrdinanceIds.has(String(o.id))
  );

  const handleAddAgendaItem = () => {
    if (!selectedOrdinanceId) return;
    const ordinance = availableOrdinances.find(o => String(o.id) === String(selectedOrdinanceId));
    if (!ordinance) return;
    if (agendaOrdinanceIds.has(String(selectedOrdinanceId))) {
      setAgendaError('This ordinance is already on the agenda.');
      return;
    }
    const parsedReading = readingNumber ? parseInt(readingNumber, 10) : null;
    if (parsedReading !== null && (parsedReading < 1 || parsedReading > MAX_READING_NUMBER)) {
      setAgendaError(`Reading number must be between 1 and ${MAX_READING_NUMBER}.`);
      return;
    }
    setAgendaError('');
    setAgendaItems(prev => [
      ...prev,
      {
        ordinance_id: ordinance.id,
        title: ordinance.title,
        ordinance_number: ordinance.ordinance_number,
        description: ordinance.description,
        reading_number: parsedReading,
        agenda_order: prev.length + 1,
      },
    ]);
    setSelectedOrdinanceId('');
    setReadingNumber('');
    setShowAgendaAdd(false);
  };

  const handleRemoveAgendaItem = (ordinanceId) => {
    setAgendaItems(prev => {
      const updated = prev.filter(i => String(i.ordinance_id) !== String(ordinanceId));
      return updated.map((item, idx) => ({ ...item, agenda_order: idx + 1 }));
    });
    setAgendaError('');
  };

  const handleMoveAgendaItem = (index, direction) => {
    setAgendaItems(prev => {
      const updated = [...prev];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= updated.length) return prev;
      [updated[index], updated[swapIndex]] = [updated[swapIndex], updated[index]];
      return updated.map((item, idx) => ({ ...item, agenda_order: idx + 1 }));
    });
  };

  const validateForm = () => {
    const newErrors = {};
    const agendaText = richTextToPlainText(formData.agenda || '');

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

    if (!hasMeaningfulRichText(formData.agenda)) {
      newErrors.agenda = 'Agenda is required';
    } else if (agendaText.length < 10) {
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

  const handleAgendaChange = (htmlValue) => {
    setFormData(prev => ({
      ...prev,
      agenda: htmlValue,
    }));

    if (formErrors.agenda) {
      setFormErrors(prev => ({
        ...prev,
        agenda: '',
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
        title: safeTrim(formData.title),
        date: dateTime,
        location: safeTrim(formData.location),
        agenda: safeTrim(formData.agenda),
        notes: safeTrim(formData.notes) || null,
      };

      let response;
      if (sessionId) {
        // Update existing session
        response = await api.put(`/sessions/${sessionId}`, payload);
        setSuccess('Session updated successfully!');
      } else {
        // Create new session
        response = await api.post('/sessions', payload);
        const newSessionId = response.data?.id || response.data?.session?.id;

        // Assign selected unassigned OOB items to the new session
        if (newSessionId && selectedOobIds.size > 0) {
          try {
            await api.post('/order-of-business/assign-session', {
              session_id: newSessionId,
              item_ids: Array.from(selectedOobIds),
            });
          } catch {
            setError(prev => prev
              ? prev + ' Some order of business items could not be assigned.'
              : 'Session created, but some order of business items could not be assigned.'
            );
          }
        }

        // Add agenda items sequentially after session creation
        if (newSessionId && agendaItems.length > 0) {
          const failedItems = [];
          for (const item of agendaItems) {
            try {
              await api.post(`/sessions/${newSessionId}/add-agenda-item`, {
                ordinance_id: item.ordinance_id,
                agenda_order: item.agenda_order,
                reading_number: item.reading_number || null,
              });
            } catch {
              failedItems.push(item.title || `Ordinance #${item.ordinance_id}`);
            }
          }
          if (failedItems.length > 0) {
            setError(
              `Session created, but some agenda items could not be added: ${failedItems.join(', ')}. You can add them later from the session details page.`
            );
          }
        }

        setSuccess('Session created successfully!');
      }

      // Reset form
      setFormData(normalizeSessionFormData());
      setAgendaItems([]);

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
    setFormData(normalizeSessionFormData());
    setFormErrors({});
    setError('');
    setSuccess('');
    setAgendaItems([]);
    setSelectedOrdinanceId('');
    setReadingNumber('');
    setShowAgendaAdd(false);
    setAgendaError('');
    setSelectedOobIds(new Set(unassignedOob.map(i => i.id)));
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
              value={formData.title ?? ''}
              onChange={handleChange}
              disabled={loading}
              maxLength="150"
              aria-invalid={!!formErrors.title}
              aria-describedby={formErrors.title ? 'title-error' : 'title-hint'}
            />
            <div className="form-hint" id="title-hint">
              {(formData.title || '').length}/150 characters
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
              value={formData.date ?? ''}
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
              value={formData.time ?? ''}
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
              value={formData.location ?? ''}
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
            <RichTextEditor
              id="agenda"
              placeholder="List the main topics and items to be discussed..."
              value={formData.agenda ?? ''}
              onChange={handleAgendaChange}
              disabled={loading}
              ariaInvalid={!!formErrors.agenda}
              ariaDescribedBy={formErrors.agenda ? 'agenda-error' : 'agenda-hint'}
            />
            <div className="form-hint" id="agenda-hint">
              {richTextToPlainText(formData.agenda || '').length} characters
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
              value={formData.notes ?? ''}
              onChange={handleChange}
              disabled={loading}
              rows="3"
            />
          </div>
        </div>

        {/* Unassigned Order of Business Items – link to this session */}
        {!sessionId && canManageAgenda && unassignedOob.length > 0 && (
          <div className="agenda-builder-section">
            <div className="agenda-builder-header">
              <h4 className="agenda-builder-title">📋 Order of Business Items</h4>
              <p className="agenda-builder-subtitle">
                Select the order of business items to include in this session.
              </p>
            </div>
            <ol className="agenda-builder-list">
              {unassignedOob.map((item) => (
                <li key={item.id} className="agenda-builder-item">
                  <label className="oob-checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedOobIds.has(item.id)}
                      onChange={(e) => {
                        setSelectedOobIds(prev => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        });
                      }}
                    />
                    <div className="agenda-builder-item-body">
                      <div className="agenda-builder-item-title">{item.title}</div>
                      <div className="agenda-builder-item-meta">
                        <span className="agenda-builder-meta-tag">{item.item_type}</span>
                        {item.ordinance_title && (
                          <span className="agenda-builder-meta-tag">
                            Ordinance: {item.ordinance_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Agenda Builder – only shown when creating a new session for eligible roles */}
        {!sessionId && canManageAgenda && (
          <div className="agenda-builder-section">
            <div className="agenda-builder-header">
              <h4 className="agenda-builder-title">📋 Session Agenda (Optional)</h4>
              <p className="agenda-builder-subtitle">
                Add proposed measures to the session agenda before saving.
              </p>
            </div>

            {agendaError && (
              <div className="agenda-builder-error">
                <span>⚠️</span> {agendaError}
              </div>
            )}

            {agendaItems.length === 0 ? (
              <div className="agenda-builder-empty">
                <span className="agenda-builder-empty-icon">📄</span>
                <p>No ordinances added yet. Use the button below to add proposed measures.</p>
              </div>
            ) : (
              <ol className="agenda-builder-list">
                {agendaItems.map((item, index) => (
                  <li key={item.ordinance_id} className="agenda-builder-item">
                    <div className="agenda-builder-item-order">{item.agenda_order}</div>
                    <div className="agenda-builder-item-body">
                      <div className="agenda-builder-item-title">
                        {item.title || 'Untitled Ordinance'}
                      </div>
                      <div className="agenda-builder-item-meta">
                        {item.ordinance_number && (
                          <span className="agenda-builder-meta-tag">
                            No. {item.ordinance_number}
                          </span>
                        )}
                        {item.reading_number && (
                          <span className="agenda-builder-meta-tag agenda-builder-reading-tag">
                            Reading #{item.reading_number}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="agenda-builder-item-actions">
                      <button
                        type="button"
                        className="agenda-builder-btn agenda-builder-btn-move"
                        onClick={() => handleMoveAgendaItem(index, -1)}
                        disabled={index === 0}
                        title="Move up"
                        aria-label="Move item up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="agenda-builder-btn agenda-builder-btn-move"
                        onClick={() => handleMoveAgendaItem(index, 1)}
                        disabled={index === agendaItems.length - 1}
                        title="Move down"
                        aria-label="Move item down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="agenda-builder-btn agenda-builder-btn-remove"
                        onClick={() => handleRemoveAgendaItem(item.ordinance_id)}
                        title="Remove from agenda"
                        aria-label="Remove ordinance from agenda"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="agenda-builder-add-section">
              {showAgendaAdd ? (
                <div className="agenda-builder-add-form">
                  <div className="agenda-builder-form-row">
                    <select
                      value={selectedOrdinanceId}
                      onChange={e => setSelectedOrdinanceId(e.target.value)}
                      className="agenda-builder-select"
                    >
                      <option value="">— Select an ordinance —</option>
                      {unscheduledOrdinances.map(o => (
                        <option key={o.id} value={o.id}>
                          {o.title}{o.ordinance_number ? ` (No. ${o.ordinance_number})` : ''}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      max={MAX_READING_NUMBER}
                      placeholder="Reading # (1–3, optional)"
                      value={readingNumber}
                      onChange={e => setReadingNumber(e.target.value)}
                      className="agenda-builder-reading-input"
                    />
                  </div>
                  <div className="agenda-builder-form-actions">
                    <button
                      type="button"
                      className="agenda-builder-btn-cancel"
                      onClick={() => {
                        setShowAgendaAdd(false);
                        setSelectedOrdinanceId('');
                        setReadingNumber('');
                        setAgendaError('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="agenda-builder-btn-submit"
                      onClick={handleAddAgendaItem}
                      disabled={!selectedOrdinanceId}
                    >
                      Add to Agenda
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="agenda-builder-btn-add"
                  onClick={() => setShowAgendaAdd(true)}
                  disabled={unscheduledOrdinances.length === 0}
                >
                  ➕ Add Ordinance to Agenda
                </button>
              )}
            </div>
          </div>
        )}

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
          <p><strong>💡 Tips:</strong></p>
          <ul>
            <li>Future dates only - select a date that hasn't passed</li>
            <li>Be specific in the agenda for better participation</li>
            <li>All marked with * are required fields</li>
            <li>Session will be broadcast to all council members</li>
          </ul>
        </div>
      </form>
    </div>
  );
}