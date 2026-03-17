import '../../styles/OrderOfBusiness.css';

export default function OrderOfBusinessForm({
  form,
  ordinances,
  resolutions,
  statusColors,
  saving,
  editingItem,
  onChange,
  onCancel,
  onSubmit,
}) {
  return (
    <div className="oob-form-container">
      <h4 className="oob-form-title">
        {editingItem ? '✏️ Edit Order of Business Item' : '➕ Add Order of Business Item'}
      </h4>
      <form className="oob-form" onSubmit={onSubmit}>
        <div className="oob-form-group">
          <label htmlFor="oob-title">Title *</label>
          <input
            id="oob-title"
            type="text"
            name="title"
            value={form.title}
            onChange={onChange}
            placeholder="Agenda item title"
            required
            className="oob-input"
          />
        </div>

        <div className="oob-form-row">
          <div className="oob-form-group">
            <label htmlFor="oob-type">Item Type *</label>
            <select
              id="oob-type"
              name="item_type"
              value={form.item_type}
              onChange={onChange}
              className="oob-select"
              required
            >
              {[
                'Call to Order',
                'Roll Call',
                'Prayer',
                'Approval of Minutes',
                'Unfinished Business',
                'New Business',
                'Committee Reports',
                'Announcement',
                'Question Hour',
                'Adjournment',
                'Other Matters',
              ].map((itemType) => (
                <option key={itemType} value={itemType}>{itemType}</option>
              ))}
            </select>
          </div>

          <div className="oob-form-group">
            <label htmlFor="oob-duration">Duration (minutes)</label>
            <input
              id="oob-duration"
              type="number"
              name="duration_minutes"
              value={form.duration_minutes}
              onChange={onChange}
              min="1"
              placeholder="e.g. 15"
              className="oob-input"
            />
          </div>
        </div>

        <div className="oob-form-row">
          <div className="oob-form-group">
            <label htmlFor="oob-doc-type">Link to Document</label>
            <select
              id="oob-doc-type"
              name="related_document_type"
              value={form.related_document_type}
              onChange={onChange}
              className="oob-select"
            >
              <option value="">— None —</option>
              <option value="ordinance">Ordinance</option>
              <option value="resolution">Resolution</option>
            </select>
          </div>

          {form.related_document_type === 'ordinance' && (
            <div className="oob-form-group">
              <label htmlFor="oob-doc-id">Select Ordinance</label>
              <select
                id="oob-doc-id"
                name="related_document_id"
                value={form.related_document_id}
                onChange={onChange}
                className="oob-select"
              >
                <option value="">— Select —</option>
                {ordinances.map((ordinance) => (
                  <option key={ordinance.id} value={ordinance.id}>
                    {ordinance.title}{ordinance.ordinance_number ? ` (No. ${ordinance.ordinance_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.related_document_type === 'resolution' && (
            <div className="oob-form-group">
              <label htmlFor="oob-res-id">Select Resolution</label>
              <select
                id="oob-res-id"
                name="related_document_id"
                value={form.related_document_id}
                onChange={onChange}
                className="oob-select"
              >
                <option value="">— Select —</option>
                {resolutions.map((resolution) => (
                  <option key={resolution.id} value={resolution.id}>
                    {resolution.title}{resolution.resolution_number ? ` (No. ${resolution.resolution_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="oob-form-row">
          <div className="oob-form-group">
            <label htmlFor="oob-status">Status</label>
            <select
              id="oob-status"
              name="status"
              value={form.status}
              onChange={onChange}
              className="oob-select"
            >
              {Object.keys(statusColors).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="oob-form-group">
            <label htmlFor="oob-priority">Priority</label>
            <input
              id="oob-priority"
              type="number"
              name="priority"
              value={form.priority}
              onChange={onChange}
              min="0"
              placeholder="0"
              className="oob-input"
            />
          </div>
        </div>

        <div className="oob-form-group">
          <label htmlFor="oob-notes">Notes</label>
          <textarea
            id="oob-notes"
            name="notes"
            value={form.notes}
            onChange={onChange}
            placeholder="Optional notes or remarks"
            rows={2}
            className="oob-textarea"
          />
        </div>

        <div className="oob-form-actions">
          <button type="button" className="oob-btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="oob-btn-submit" disabled={saving}>
            {saving ? 'Saving…' : editingItem ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
