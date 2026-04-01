import { useState } from 'react';
import CommitteeMinutesForm from './CommitteeMinutesForm';
import useCommitteeMinutes from '../../hooks/useCommitteeMinutes';
import '../../styles/Minutes.css';

export default function CommitteeMinutesList({ committeeId }) {
  const {
    minutes,
    loading,
    error,
    createMinutes,
    updateMinutes,
    deleteMinutes,
    getMinutesById,
  } = useCommitteeMinutes(committeeId);

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const handleCreate = async (formData) => {
    setActionError('');
    try {
      await createMinutes(formData);
      setShowForm(false);
      setActionSuccess('Committee minutes saved!');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to save minutes');
    }
  };

  const handleEditClick = async (id) => {
    const record = await getMinutesById(id);
    setEditingRecord(record);
    };


  const handleEdit = async (id, updates) => {
    setActionError('');
    try {
      await updateMinutes(id, updates);
      setEditingRecord(null);
      setActionSuccess('Committee minutes updated!');
      setTimeout(() => setActionSuccess(''), 4000);
    } catch (err) {
      setActionError(err.message || 'Failed to update minutes');
    }
  };

  const handleDelete = async (id) => {
    setActionError('');
    try {
      await deleteMinutes(id);
      setDeleteConfirm(null);
      setActionSuccess('Committee minutes deleted.');
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err) {
      setActionError(err.message || 'Failed to delete minutes');
    }
  };

  return (
    <div className="minutes-container">
      <div className="minutes-header">
        <h3>Committee Meeting Minutes</h3>
        <button className="btn-new-minutes" onClick={() => setShowForm(true)}>
          + New Minutes
        </button>
      </div>
      {(error || actionError) && (
        <div className="alert alert-error">⚠️ {error || actionError}</div>
      )}
      {actionSuccess && (
        <div className="alert alert-success">✓ {actionSuccess}</div>
      )}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <CommitteeMinutesForm
              onSubmit={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
      {/* Table */}
      {loading ? (
        <div className="minutes-loading">Loading committee minutes…</div>
      ) : minutes.length === 0 ? (
        <div className="minutes-empty">
          <p>No committee minutes found. Click "New Minutes" to get started.</p>
        </div>
      ) : (
        <div className="minutes-table-wrapper">
          <table className="minutes-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Meeting Date</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {minutes.map((record) => (
                <tr key={record.id} className="minutes-row">
                  <td>{record.title}</td>
                  <td>{record.meeting_date ? new Date(record.meeting_date).toLocaleDateString() : '—'}</td>
                  <td>{record.status}</td>
                  <td>{record.created_by_name || '—'}</td>
                  <td className="minutes-actions">
                    <button
                        className="btn-icon btn-edit"
                        title="Edit"
                        onClick={() => handleEditClick(record.id)}
                    >
                        Edit
                    </button>

                    <button className="btn-icon btn-delete" title="Delete" onClick={() => setDeleteConfirm(record)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Edit Modal */}
      {editingRecord && (
        <div className="modal-overlay" onClick={() => setEditingRecord(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <CommitteeMinutesForm
              initialData={editingRecord}
              onSubmit={data => handleEdit(editingRecord.id, data)}
              onCancel={() => setEditingRecord(null)}
            />
          </div>
        </div>
      )}
      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-confirm" onClick={e => e.stopPropagation()}>
            <h4>Delete Committee Minutes</h4>
            <p>Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>
                Delete
              </button>
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
