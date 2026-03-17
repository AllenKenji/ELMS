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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedOrdinanceId, setSelectedOrdinanceId] = useState('');
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
      const res = await api.get('/ordinances');
      setAvailableOrdinances(res.data || []);
    } catch {
      setAvailableOrdinances([]);
    }
  }, [canManage]);

  useEffect(() => {
    fetchAgenda();
    fetchAvailableOrdinances();
  }, [fetchAgenda, fetchAvailableOrdinances]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!selectedOrdinanceId) return;
    setAdding(true);
    setError('');
    try {
      const nextOrder =
        agendaItems.length > 0
          ? Math.max(...agendaItems.map((i) => i.agenda_order || 0)) + 1
          : 1;
      await api.post(`/sessions/${sessionId}/add-agenda-item`, {
        ordinance_id: selectedOrdinanceId,
        agenda_order: nextOrder,
        reading_number: readingNumber ? parseInt(readingNumber, 10) : null,
      });
      setSelectedOrdinanceId('');
      setReadingNumber('');
      setShowAddForm(false);
      fetchAgenda();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to add agenda item.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ordinanceId) => {
    if (!window.confirm('Remove this ordinance from the agenda?')) return;
    setRemovingId(ordinanceId);
    setError('');
    try {
      await api.delete(`/sessions/${sessionId}/agenda-item/${ordinanceId}`);
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
      await Promise.all([
        api.post(`/sessions/${sessionId}/add-agenda-item`, {
          ordinance_id: item.ordinance_id,
          agenda_order: prev.agenda_order,
          reading_number: item.reading_number,
        }),
        api.post(`/sessions/${sessionId}/add-agenda-item`, {
          ordinance_id: prev.ordinance_id,
          agenda_order: item.agenda_order,
          reading_number: prev.reading_number,
        }),
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
      await Promise.all([
        api.post(`/sessions/${sessionId}/add-agenda-item`, {
          ordinance_id: item.ordinance_id,
          agenda_order: next.agenda_order,
          reading_number: item.reading_number,
        }),
        api.post(`/sessions/${sessionId}/add-agenda-item`, {
          ordinance_id: next.ordinance_id,
          agenda_order: item.agenda_order,
          reading_number: next.reading_number,
        }),
      ]);
      fetchAgenda();
    } catch {
      setError('Failed to reorder agenda items.');
    }
  };

  // Ordinances not already on the agenda
  const agendaOrdinanceIds = new Set(agendaItems.map((i) => String(i.ordinance_id)));
  const unscheduledOrdinances = availableOrdinances.filter(
    (o) => !agendaOrdinanceIds.has(String(o.id))
  );

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
          <p>No ordinances scheduled for this session yet.</p>
        </div>
      ) : (
        <ol className="agenda-list">
          {agendaItems.map((item, index) => (
            <li key={item.ordinance_id} className="agenda-item">
              <div className="agenda-item-order">{item.agenda_order ?? index + 1}</div>
              <div className="agenda-item-body">
                <div className="agenda-item-title">{item.title || 'Untitled Ordinance'}</div>
                <div className="agenda-item-meta">
                  {item.ordinance_number && (
                    <span className="agenda-meta-tag">
                      No. {item.ordinance_number}
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
                    onClick={() => handleRemove(item.ordinance_id)}
                    disabled={removingId === item.ordinance_id}
                    title="Remove from agenda"
                    aria-label="Remove ordinance from agenda"
                  >
                    {removingId === item.ordinance_id ? '…' : '✕'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canManage && (
        <div className="agenda-add-section">
          {showAddForm ? (
            <form className="agenda-add-form" onSubmit={handleAddItem}>
              <div className="agenda-form-row">
                <select
                  value={selectedOrdinanceId}
                  onChange={(e) => setSelectedOrdinanceId(e.target.value)}
                  className="agenda-select"
                  required
                >
                  <option value="">— Select an ordinance —</option>
                  {unscheduledOrdinances.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                      {o.ordinance_number ? ` (No. ${o.ordinance_number})` : ''}
                    </option>
                  ))}
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
                    setSelectedOrdinanceId('');
                    setReadingNumber('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="agenda-btn-submit"
                  disabled={adding || !selectedOrdinanceId}
                >
                  {adding ? 'Adding…' : 'Add to Agenda'}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="agenda-btn-add"
              onClick={() => setShowAddForm(true)}
              disabled={unscheduledOrdinances.length === 0}
            >
              ➕ Add Ordinance to Agenda
            </button>
          )}
        </div>
      )}
    </div>
  );
}
