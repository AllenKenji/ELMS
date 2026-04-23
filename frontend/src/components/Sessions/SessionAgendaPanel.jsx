import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/SessionAgendaPanel.css';

// Philippine legislative process uses three readings for ordinances
const MAX_READING_NUMBER = 3;

const READING_STAGE_LABELS = {
  SUBMITTED: 'Submitted',
  FIRST_READING: '1st Reading',
  COMMITTEE_REVIEW: 'Committee Review',
  COMMITTEE_REPORT_SUBMITTED: 'Committee Report',
  SECOND_READING: '2nd Reading',
  THIRD_READING_VOTED: '3rd Reading / Voted',
  APPROVED: 'Executive Approved',
  REJECTED: 'Rejected',
  POSTED: 'Posted Publicly',
  EFFECTIVE: 'In Effect',
};

const READING_STAGE_COLORS = {
  SUBMITTED: '#3498db',
  FIRST_READING: '#9b59b6',
  COMMITTEE_REVIEW: '#e67e22',
  COMMITTEE_REPORT_SUBMITTED: '#f39c12',
  SECOND_READING: '#8e44ad',
  THIRD_READING_VOTED: '#2980b9',
  APPROVED: '#27ae60',
  REJECTED: '#e74c3c',
  POSTED: '#16a085',
  EFFECTIVE: '#1abc9c',
};

export default function SessionAgendaPanel({ sessionId, readOnly = false }) {
  const { user } = useAuth();
  const [agendaItems, setAgendaItems] = useState([]);
  const [availableOrdinances, setAvailableOrdinances] = useState([]);
  const [availableResolutions, setAvailableResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMeasureKey, setSelectedMeasureKey] = useState('');
  const [readingNumber, setReadingNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const canManage = !readOnly && ['Admin', 'Secretary'].includes(user?.role);

  const fetchAgenda = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/sessions/${sessionId}/agenda`);
      setAgendaItems(res.data || []);
    } catch {
      setAgendaItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchAvailableOrdinances = useCallback(async () => {
    if (!canManage) return;
    try {
      const [ordRes, resRes] = await Promise.all([
        api.get('/ordinances'),
        api.get('/resolutions'),
      ]);
      setAvailableOrdinances(ordRes.data || []);
      setAvailableResolutions(resRes.data || []);
    } catch {
      setAvailableOrdinances([]);
      setAvailableResolutions([]);
    }
  }, [canManage]);

  useEffect(() => {
    fetchAgenda();
    fetchAvailableOrdinances();
  }, [fetchAgenda, fetchAvailableOrdinances]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedMeasureKey) return;
    setAdding(true);
    setError('');
    try {
      const nextOrder =
        agendaItems.length > 0
          ? Math.max(...agendaItems.map((i) => i.agenda_order || 0)) + 1
          : 1;
      const payload = {
        agenda_order: nextOrder,
        reading_number: readingNumber ? parseInt(readingNumber, 10) : null,
      };
      if (selectedMeasureKey.startsWith('res-')) {
        payload.resolution_id = selectedMeasureKey.replace('res-', '');
      } else {
        payload.ordinance_id = selectedMeasureKey.replace('ord-', '');
      }
      await api.post(`/sessions/${sessionId}/add-agenda-item`, payload);
      setSelectedMeasureKey('');
      setReadingNumber('');
      setShowAddForm(false);
      fetchAgenda();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add agenda item.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (item) => {
    const itemLabel = item.item_type === 'Resolution' ? 'resolution' : 'ordinance';
    if (!window.confirm(`Remove this ${itemLabel} from the agenda?`)) return;
    const removeId = item.ordinance_id || item.resolution_id;
    setRemovingId(removeId);
    setError('');
    try {
      if (item.resolution_id) {
        await api.delete(`/sessions/${sessionId}/agenda-item/resolution/${item.resolution_id}`);
      } else {
        await api.delete(`/sessions/${sessionId}/agenda-item/${item.ordinance_id}`);
      }
      fetchAgenda();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove agenda item.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveUp = async (item, index) => {
    if (index === 0) return;
    const prev = agendaItems[index - 1];
    setError('');
    try {
      const itemPayload = {
        agenda_order: prev.agenda_order,
        reading_number: item.reading_number,
      };
      const prevPayload = {
        agenda_order: item.agenda_order,
        reading_number: prev.reading_number,
      };
      if (item.resolution_id) itemPayload.resolution_id = item.resolution_id;
      else itemPayload.ordinance_id = item.ordinance_id;
      if (prev.resolution_id) prevPayload.resolution_id = prev.resolution_id;
      else prevPayload.ordinance_id = prev.ordinance_id;
      await Promise.all([
        api.post(`/sessions/${sessionId}/add-agenda-item`, itemPayload),
        api.post(`/sessions/${sessionId}/add-agenda-item`, prevPayload),
      ]);
      fetchAgenda();
    } catch {
      setError('Failed to reorder agenda items.');
    }
  };

  const handleMoveDown = async (item, index) => {
    if (index === agendaItems.length - 1) return;
    const next = agendaItems[index + 1];
    setError('');
    try {
      const itemPayload = {
        agenda_order: next.agenda_order,
        reading_number: item.reading_number,
      };
      const nextPayload = {
        agenda_order: item.agenda_order,
        reading_number: next.reading_number,
      };
      if (item.resolution_id) itemPayload.resolution_id = item.resolution_id;
      else itemPayload.ordinance_id = item.ordinance_id;
      if (next.resolution_id) nextPayload.resolution_id = next.resolution_id;
      else nextPayload.ordinance_id = next.ordinance_id;
      await Promise.all([
        api.post(`/sessions/${sessionId}/add-agenda-item`, itemPayload),
        api.post(`/sessions/${sessionId}/add-agenda-item`, nextPayload),
      ]);
      fetchAgenda();
    } catch {
      setError('Failed to reorder agenda items.');
    }
  };

  // Measures not already on the agenda
  const agendaOrdinanceIds = new Set(agendaItems.filter(i => i.ordinance_id).map((i) => String(i.ordinance_id)));
  const agendaResolutionIds = new Set(agendaItems.filter(i => i.resolution_id).map((i) => String(i.resolution_id)));
  const unscheduledOrdinances = availableOrdinances.filter(
    (o) => !agendaOrdinanceIds.has(String(o.id))
  );
  const unscheduledResolutions = availableResolutions.filter(
    (r) => !agendaResolutionIds.has(String(r.id))
  );
  const availableMeasures = [
    ...unscheduledOrdinances.map(o => ({ ...o, _key: `ord-${o.id}`, _type: 'Ordinance', _number: o.ordinance_number })),
    ...unscheduledResolutions.map(r => ({ ...r, _key: `res-${r.id}`, _type: 'Resolution', _number: r.resolution_number })),
  ];

  if (loading) {
    return <div className="agenda-panel-loading">Loading agenda...</div>;
  }

  return (
    <div className="agenda-panel">
      {error && (
        <div className="agenda-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {agendaItems.length === 0 ? (
        <div className="agenda-empty">
          <span className="agenda-empty-icon">📋</span>
          <p>No proposed measures scheduled for this session yet.</p>
        </div>
      ) : (
        <ol className="agenda-list">
          {agendaItems.map((item, index) => {
            const itemId = item.ordinance_id || item.resolution_id;
            return (
            <li key={`${item.item_type}-${itemId}`} className="agenda-item">
              <div className="agenda-item-order">{item.agenda_order ?? index + 1}</div>
              <div className="agenda-item-body">
                <div className="agenda-item-title">{item.title || 'Untitled Measure'}</div>
                <div className="agenda-item-meta">
                  {item.item_type && (
                    <span className="agenda-meta-tag">{item.item_type}</span>
                  )}
                  {(item.ordinance_number || item.resolution_number) && (
                    <span className="agenda-meta-tag">
                      No. {item.ordinance_number || item.resolution_number}
                    </span>
                  )}
                  {item.reading_number && (
                    <span className="agenda-meta-tag reading-tag">
                      Reading #{item.reading_number}
                    </span>
                  )}
                  {item.reading_stage && (
                    <span
                      className="agenda-stage-badge"
                      style={{
                        backgroundColor:
                          READING_STAGE_COLORS[item.reading_stage] || '#7f8c8d',
                      }}
                    >
                      {READING_STAGE_LABELS[item.reading_stage] || item.reading_stage}
                    </span>
                  )}
                  {item.proposer_name && (
                    <span className="agenda-meta-tag">👤 {item.proposer_name}</span>
                  )}
                </div>
                {item.description && (
                  <p className="agenda-item-desc">{item.description}</p>
                )}
              </div>
              {canManage && (
                <div className="agenda-item-actions">
                  <button
                    className="agenda-btn agenda-btn-move"
                    onClick={() => handleMoveUp(item, index)}
                    disabled={index === 0}
                    title="Move up"
                    aria-label="Move item up"
                  >
                    ▲
                  </button>
                  <button
                    className="agenda-btn agenda-btn-move"
                    onClick={() => handleMoveDown(item, index)}
                    disabled={index === agendaItems.length - 1}
                    title="Move down"
                    aria-label="Move item down"
                  >
                    ▼
                  </button>
                  <button
                    className="agenda-btn agenda-btn-remove"
                    onClick={() => handleRemove(item)}
                    disabled={removingId === itemId}
                    title="Remove from agenda"
                    aria-label="Remove measure from agenda"
                  >
                    {removingId === itemId ? '…' : '✕'}
                  </button>
                </div>
              )}
            </li>
            );
          })}
        </ol>
      )}

      {canManage && (
        <div className="agenda-add-section">
          {showAddForm ? (
            <form className="agenda-add-form" onSubmit={handleAddItem}>
              <div className="agenda-form-row">
                <select
                  value={selectedMeasureKey}
                  onChange={(e) => setSelectedMeasureKey(e.target.value)}
                  className="agenda-select"
                  required
                >
                  <option value="">— Select a proposed measure —</option>
                  {unscheduledOrdinances.length > 0 && (
                    <optgroup label="Ordinances">
                      {availableMeasures.filter(m => m._type === 'Ordinance').map((m) => (
                        <option key={m._key} value={m._key}>
                          {m.title}{m._number ? ` (No. ${m._number})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {unscheduledResolutions.length > 0 && (
                    <optgroup label="Resolutions">
                      {availableMeasures.filter(m => m._type === 'Resolution').map((m) => (
                        <option key={m._key} value={m._key}>
                          {m.title}{m._number ? ` (No. ${m._number})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <input
                  type="number"
                  min="1"
                  max={MAX_READING_NUMBER}
                  placeholder="Reading # (1–3, optional)"
                  value={readingNumber}
                  onChange={(e) => setReadingNumber(e.target.value)}
                  className="agenda-reading-input"
                />
              </div>
              <div className="agenda-form-actions">
                <button
                  type="button"
                  className="agenda-btn-cancel"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedMeasureKey('');
                    setReadingNumber('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="agenda-btn-submit"
                  disabled={adding || !selectedMeasureKey}
                >
                  {adding ? 'Adding…' : 'Add to Agenda'}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="agenda-btn-add"
              onClick={() => setShowAddForm(true)}
              disabled={availableMeasures.length === 0}
            >
              ➕ Add Proposed Measure to Agenda
            </button>
          )}
        </div>
      )}
    </div>
  );
}
