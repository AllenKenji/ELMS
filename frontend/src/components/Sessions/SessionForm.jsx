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
  const [availableResolutions, setAvailableResolutions] = useState([]);
  const [selectedMeasureKey, setSelectedMeasureKey] = useState('');
  const [readingNumber, setReadingNumber] = useState('');
  const [showAgendaAdd, setShowAgendaAdd] = useState(false);
  const [agendaError, setAgendaError] = useState('');

  // Unassigned OOB items state
  const [unassignedOob, setUnassignedOob] = useState([]);
  const [selectedOobIds, setSelectedOobIds] = useState(new Set());

  // OOB Documents state (for auto-filling session)
  const [oobDocuments, setOobDocuments] = useState([]);
  const [selectedOobDocId, setSelectedOobDocId] = useState('');

  useEffect(() => {
    setFormData(normalizeSessionFormData(initialData));
  }, [initialData]);

  useEffect(() => {
    if (!sessionId && canManageAgenda) {
      api.get('/ordinances')
        .then(res => setAvailableOrdinances(res.data || []))
        .catch(() => setAvailableOrdinances([]));
      api.get('/resolutions')
        .then(res => setAvailableResolutions(res.data || []))
        .catch(() => setAvailableResolutions([]));
      // Fetch unassigned OOB items
      api.get('/order-of-business/unassigned')
        .then(res => {
          const items = res.data || [];
          setUnassignedOob(items);
          // Pre-select all unassigned items
          setSelectedOobIds(new Set(items.map(i => i.id)));
        })
        .catch(() => setUnassignedOob([]));
      // Fetch OOB documents for auto-fill
      api.get('/order-of-business/documents')
        .then(res => setOobDocuments(res.data || []))
        .catch(() => setOobDocuments([]));
    }
  }, [sessionId, canManageAgenda]);

  const agendaOrdinanceIds = new Set(agendaItems.filter(i => i.item_type === 'Ordinance').map(i => String(i.measure_id)));
  const agendaResolutionIds = new Set(agendaItems.filter(i => i.item_type === 'Resolution').map(i => String(i.measure_id)));
  const unscheduledOrdinances = availableOrdinances.filter(
    o => !agendaOrdinanceIds.has(String(o.id))
  );
  const unscheduledResolutions = availableResolutions.filter(
    r => !agendaResolutionIds.has(String(r.id))
  );
  // Combine into a single list with prefixed keys
  const availableMeasures = [
    ...unscheduledOrdinances.map(o => ({ ...o, _key: `ord-${o.id}`, _type: 'Ordinance', _number: o.ordinance_number })),
    ...unscheduledResolutions.map(r => ({ ...r, _key: `res-${r.id}`, _type: 'Resolution', _number: r.resolution_number })),
  ];

  const handleSelectOobDocument = async (docId) => {
    setSelectedOobDocId(docId);
    if (!docId) return;
    try {
      const res = await api.get(`/order-of-business/documents/${docId}`);
      const doc = res.data;
      // Auto-fill session form fields from the OOB document
      setFormData(prev => ({
        ...prev,
        title: doc.title || prev.title,
        date: doc.date ? new Date(doc.date).toISOString().split('T')[0] : prev.date,
        time: doc.time ? doc.time.slice(0, 5) : prev.time,
        location: doc.venue || prev.location,
      }));
      // Build agenda text from the document's items
      if (doc.items && doc.items.length > 0) {
        const agendaText = doc.items
          .map((item, i) => `${item.item_number ?? i + 1}. ${item.title}`)
          .join('\n');
        setFormData(prev => ({
          ...prev,
          agenda: prev.agenda && prev.agenda.length > 20 ? prev.agenda : agendaText,
        }));
      }
      setFormErrors({});
    } catch {
      // Silently fail — user can still fill manually
    }
  };

  const handleAddAgendaItem = () => {
    if (!selectedMeasureKey) return;
    const measure = availableMeasures.find(m => m._key === selectedMeasureKey);
    if (!measure) return;
    const parsedReading = readingNumber ? parseInt(readingNumber, 10) : null;
    if (parsedReading !== null && (parsedReading < 1 || parsedReading > MAX_READING_NUMBER)) {
      setAgendaError(`Reading number must be between 1 and ${MAX_READING_NUMBER}.`);
      return;
    }
    setAgendaError('');
    setAgendaItems(prev => [
      ...prev,
      {
        item_type: measure._type,
        measure_id: measure.id,
        title: measure.title,
        measure_number: measure._number,
        description: measure.description,
        reading_number: parsedReading,
        agenda_order: prev.length + 1,
      },
    ]);
    setSelectedMeasureKey('');
    setReadingNumber('');
    setShowAgendaAdd(false);
  };

  const handleRemoveAgendaItem = (itemType, measureId) => {
    setAgendaItems(prev => {
      const updated = prev.filter(i => !(i.item_type === itemType && String(i.measure_id) === String(measureId)));
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
              const payload = {
                agenda_order: item.agenda_order,
                reading_number: item.reading_number || null,
              };
              if (item.item_type === 'Resolution') {
                payload.resolution_id = item.measure_id;
              } else {
                payload.ordinance_id = item.measure_id;
              }
              await api.post(`/sessions/${newSessionId}/add-agenda-item`, payload);
            } catch {
              failedItems.push(item.title || `${item.item_type} #${item.measure_id}`);
            }
          }
          if (failedItems.length > 0) {
            setError(
              `Session created, but some agenda items could not be added: ${failedItems.join(', ')}. You can add them later from the session details page.`
            );
          }
        }

        // Auto-add participants from OOB document (presiding officer, secretary, committee members)
        if (newSessionId && selectedOobDocId) {
          try {
            await api.post(`/sessions/${newSessionId}/participants/from-oob`, {
              oob_document_id: selectedOobDocId,
            });
          } catch {
            // Non-blocking — participants can be added manually later
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
    setSelectedMeasureKey('');
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

        {/* OOB Document Selector – auto-fill session from existing Order of Business */}
        {!sessionId && canManageAgenda && oobDocuments.length > 0 && (
          <div className="oob-doc-selector">
            <label htmlFor="oobDocSelect">📋 Fill from Order of Business</label>
            <select
              id="oobDocSelect"
              value={selectedOobDocId}
              onChange={(e) => handleSelectOobDocument(e.target.value)}
              disabled={loading}
            >
              <option value="">— Select an Order of Business to auto-fill —</option>
              {oobDocuments.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}{doc.date ? ` (${new Date(doc.date).toLocaleDateString()})` : ''} — {doc.item_count} item{doc.item_count !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
            <p className="form-hint">Selecting an Order of Business will auto-fill the session title, date, time, location, and agenda.</p>
          </div>
        )}

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
                <p>No proposed measures added yet. Use the button below to add ordinances or resolutions.</p>
              </div>
            ) : (
              <ol className="agenda-builder-list">
                {agendaItems.map((item, index) => (
                  <li key={`${item.item_type}-${item.measure_id}`} className="agenda-builder-item">
                    <div className="agenda-builder-item-order">{item.agenda_order}</div>
                    <div className="agenda-builder-item-body">
                      <div className="agenda-builder-item-title">
                        {item.title || 'Untitled Measure'}
                      </div>
                      <div className="agenda-builder-item-meta">
                        <span className="agenda-builder-meta-tag">{item.item_type}</span>
                        {item.measure_number && (
                          <span className="agenda-builder-meta-tag">
                            No. {item.measure_number}
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
                        onClick={() => handleRemoveAgendaItem(item.item_type, item.measure_id)}
                        title="Remove from agenda"
                        aria-label="Remove measure from agenda"
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
                      value={selectedMeasureKey}
                      onChange={e => setSelectedMeasureKey(e.target.value)}
                      className="agenda-builder-select"
                    >
                      <option value="">— Select a proposed measure —</option>
                      {availableMeasures.length > 0 && (
                        <>
                          {unscheduledOrdinances.length > 0 && (
                            <optgroup label="Ordinances">
                              {availableMeasures.filter(m => m._type === 'Ordinance').map(m => (
                                <option key={m._key} value={m._key}>
                                  {m.title}{m._number ? ` (No. ${m._number})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {unscheduledResolutions.length > 0 && (
                            <optgroup label="Resolutions">
                              {availableMeasures.filter(m => m._type === 'Resolution').map(m => (
                                <option key={m._key} value={m._key}>
                                  {m.title}{m._number ? ` (No. ${m._number})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      )}
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
                        setSelectedMeasureKey('');
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
                      disabled={!selectedMeasureKey}
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
                  disabled={availableMeasures.length === 0}
                >
                  ➕ Add Proposed Measure to Agenda
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