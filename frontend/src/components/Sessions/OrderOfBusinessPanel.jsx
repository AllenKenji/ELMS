import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import OrderOfBusinessForm from './OrderOfBusinessForm';
import RichTextContent from '../common/RichTextContent';
import '../../styles/OrderOfBusiness.css';

const STATUS_COLORS = {
  Scheduled: '#3498db',
  'In Progress': '#f39c12',
  Completed: '#27ae60',
  Postponed: '#e67e22',
  Skipped: '#95a5a6',
};

const EMPTY_FORM = {
  title: '',
  item_type: 'Other',
  related_document_type: '',
  related_document_id: '',
  duration_minutes: '',
  priority: 0,
  status: 'Scheduled',
  notes: '',
};

export default function OrderOfBusinessPanel({ sessionId, readOnly = false, fallbackAgenda = '' }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [ordinances, setOrdinances] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const canManage = !readOnly && ['Admin', 'Secretary'].includes(user?.role);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/order-of-business/${sessionId}`);
      setItems(res.data || []);
    } catch (err) {
      setItems([]);
      setError(err?.message || 'Failed to load order of business.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);


  const fetchDocuments = useCallback(async () => {
    if (!canManage) return;
    try {
      // Fetch only ordinances with committee reports at the correct stage
      const [oobOrdRes, resRes] = await Promise.all([
        api.get('/oob/ordinances-with-committee-reports'),
        api.get('/resolutions'),
      ]);
      // oobOrdRes.data is an array of { ordinance, committeeReport }
      setOrdinances((oobOrdRes.data || []).map(obj => ({ ...obj.ordinance, committeeReport: obj.committeeReport })));
      setResolutions(resRes.data || []);
    } catch {
      // non-critical
    }
  }, [canManage]);

  useEffect(() => {
    fetchItems();
    fetchDocuments();
  }, [fetchItems, fetchDocuments]);

  const openAddForm = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    setForm({
      title: item.title || '',
      item_type: item.item_type || 'Other',
      related_document_type: item.related_document_type || '',
      related_document_id: item.related_document_id || '',
      duration_minutes: item.duration_minutes || '',
      priority: item.priority || 0,
      status: item.status || 'Scheduled',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      // Reset related document when type changes
      if (name === 'related_document_type') {
        updated.related_document_id = '';
        // Auto-fill title if type is Ordinance or Resolution
        if (value === '') {
          updated.title = prev.title;
        }
      }
      // Auto-fill title from linked document
      if (name === 'related_document_id' && value) {
        if (prev.related_document_type === 'ordinance') {
          const ord = ordinances.find((o) => String(o.id) === String(value));
          if (ord) updated.title = ord.title;
        } else if (prev.related_document_type === 'resolution') {
          const res = resolutions.find((r) => String(r.id) === String(value));
          if (res) updated.title = res.title;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        session_id: sessionId,
        item_number: editingItem ? editingItem.item_number : undefined,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
        related_document_id: form.related_document_id ? parseInt(form.related_document_id, 10) : null,
        related_document_type: form.related_document_type || null,
        priority: parseInt(form.priority, 10) || 0,
      };

      if (editingItem) {
        await api.put(`/order-of-business/${editingItem.id}`, payload);
      } else {
        await api.post('/order-of-business', payload);
      }

      setShowForm(false);
      setEditingItem(null);
      setForm(EMPTY_FORM);
      fetchItems();
    } catch (err) {
      setError(err?.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this item from the order of business?')) return;
    setRemovingId(id);
    setError('');
    try {
      await api.delete(`/order-of-business/${id}`);
      fetchItems();
    } catch (err) {
      setError(err?.message || 'Failed to remove item.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleStatusChange = async (id, status) => {
    setError('');
    try {
      await api.patch(`/order-of-business/${id}/status`, { status });
      fetchItems();
    } catch (err) {
      setError(err?.message || 'Failed to update status.');
    }
  };

  const handleMoveUp = async (item, index) => {
    if (index === 0) return;
    const prev = items[index - 1];
    setError('');
    try {
      await api.post('/order-of-business/reorder', {
        items: [
          { id: item.id, item_number: prev.item_number },
          { id: prev.id, item_number: item.item_number },
        ],
      });
      fetchItems();
    } catch {
      setError('Failed to reorder items.');
    }
  };

  const handleMoveDown = async (item, index) => {
    if (index === items.length - 1) return;
    const next = items[index + 1];
    setError('');
    try {
      await api.post('/order-of-business/reorder', {
        items: [
          { id: item.id, item_number: next.item_number },
          { id: next.id, item_number: item.item_number },
        ],
      });
      fetchItems();
    } catch {
      setError('Failed to reorder items.');
    }
  };

  const getLinkedDocumentLabel = (item) => {
    if (!item.related_document_type) return null;
    if (item.related_document_type === 'ordinance' && item.ordinance_title) {
      return `Ordinance: ${item.ordinance_title}${item.ordinance_number ? ` (No. ${item.ordinance_number})` : ''}`;
    }
    if (item.related_document_type === 'resolution' && item.resolution_title) {
      return `Resolution: ${item.resolution_title}${item.resolution_number ? ` (No. ${item.resolution_number})` : ''}`;
    }
    return null;
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/order-of-business/${sessionId}/generate-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order-of-business-session-${sessionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Failed to download PDF.');
    }
  };

  if (loading) {
    return <div className="oob-loading">Loading order of business...</div>;
  }

  return (
    <div className="oob-panel">
      {error && (
        <div className="oob-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <div className="oob-empty">
          <span className="oob-empty-icon">📋</span>
          <p>No items in the order of business yet.</p>
          {fallbackAgenda?.trim() && (
            <div className="oob-fallback-agenda">
              <h5>Saved Session Agenda</h5>
              <RichTextContent value={fallbackAgenda} className="oob-fallback-agenda-content" />
            </div>
          )}
        </div>
      ) : (
        <ol className="oob-list">
          {items.map((item, index) => {
            const linkedDoc = getLinkedDocumentLabel(item);
            return (
              <li key={item.id} className={`oob-item oob-item--${item.status.toLowerCase().replace(' ', '-')}`}>
                <div className="oob-item-number">{item.item_number ?? index + 1}</div>

                <div className="oob-item-body">
                  <div className="oob-item-header">
                    <span className="oob-item-title">{item.title}</span>
                    <span className="oob-item-type-badge">{item.item_type}</span>
                  </div>

                  <div className="oob-item-meta">
                    <span
                      className="oob-status-badge"
                      style={{ backgroundColor: STATUS_COLORS[item.status] || '#7f8c8d' }}
                    >
                      {item.status}
                    </span>
                    {item.duration_minutes && (
                      <span className="oob-meta-tag">⏱️ {item.duration_minutes} min</span>
                    )}
                    {linkedDoc && (
                      <span className="oob-meta-tag oob-meta-link">🔗 {linkedDoc}</span>
                    )}
                  </div>

                  {item.notes && (
                    <p className="oob-item-notes">{item.notes}</p>
                  )}
                </div>

                <div className="oob-item-actions">
                  {canManage && (
                    <>
                      <button
                        className="oob-btn oob-btn-move"
                        onClick={() => handleMoveUp(item, index)}
                        disabled={index === 0}
                        title="Move up"
                        aria-label="Move item up"
                      >
                        ▲
                      </button>
                      <button
                        className="oob-btn oob-btn-move"
                        onClick={() => handleMoveDown(item, index)}
                        disabled={index === items.length - 1}
                        title="Move down"
                        aria-label="Move item down"
                      >
                        ▼
                      </button>

                      <select
                        className="oob-status-select"
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        aria-label="Change item status"
                      >
                        {Object.keys(STATUS_COLORS).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>

                      <button
                        className="oob-btn oob-btn-edit"
                        onClick={() => openEditForm(item)}
                        title="Edit item"
                        aria-label="Edit item"
                      >
                        ✏️
                      </button>
                      <button
                        className="oob-btn oob-btn-remove"
                        onClick={() => handleDelete(item.id)}
                        disabled={removingId === item.id}
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        {removingId === item.id ? '…' : '✕'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* Add button */}
      {items.length > 0 && (
        <div className="oob-add-section">
          <button className="oob-btn-add" onClick={handleDownloadPdf}>
            📄 Download PDF
          </button>
        </div>
      )}

      {canManage && !showForm && (
        <div className="oob-add-section">
          <button className="oob-btn-add" onClick={openAddForm}>
            ➕ Add Order of Business Item
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {canManage && showForm && (
        <OrderOfBusinessForm
          form={form}
          ordinances={ordinances}
          resolutions={resolutions}
          statusColors={STATUS_COLORS}
          saving={saving}
          editingItem={editingItem}
          onChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingItem(null);
            setForm(EMPTY_FORM);
          }}
        />
      )}
    </div>
  );
}
