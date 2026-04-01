import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import '../../styles/CommitteeDetails.css';

export default function CommitteeDetails({ committeeId, onClose, onEdit, onDelete }) {
  const { user } = useAuth();
  const [committee, setCommittee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add-member state
  const [allUsers, setAllUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Member');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // Only Admin, Vice Mayor, or the assigned chairperson can edit
  const canEdit = committee && user && (
    user.role === 'Admin' || user.role === 'Vice Mayor' || String(committee.chair_id) === String(user.id)
  );
  const canDelete = ['Admin'].includes(user?.role);
  const canManageMembers = ['Admin', 'Secretary'].includes(user?.role);

  const fetchCommittee = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/committees/${committeeId}`);
      setCommittee(res.data);
    } catch (err) {
      setError('Failed to load committee details');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [committeeId]);

  useEffect(() => {
    fetchCommittee();
  }, [fetchCommittee]);

  useEffect(() => {
    if (canManageMembers) {
      api
        .get('/users')
        .then((res) => setAllUsers(res.data || []))
        .catch(() => setAllUsers([]));
    }
  }, [canManageMembers]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/committees/${committeeId}`);
      setShowDeleteModal(false);
      onDelete?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete committee');
      setDeleting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberUserId) {
      setMemberError('Please select a user');
      return;
    }
    setAddingMember(true);
    setMemberError('');
    try {
      await api.post(`/committees/${committeeId}/members`, {
        user_id: Number(newMemberUserId),
        role: newMemberRole,
      });
      setNewMemberUserId('');
      setNewMemberRole('Member');
      setShowAddMember(false);
      fetchCommittee();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member');
      console.error('Error:', err);
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the committee?')) return;
    setRemovingMemberId(memberId);
    try {
      await api.delete(`/committees/${committeeId}/members/${memberId}`);
      fetchCommittee();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
      console.error('Error:', err);
    } finally {
      setRemovingMemberId(null);
    }
  };

  // Users not yet in committee
  const availableUsers = allUsers.filter(
    (u) => !committee?.members?.some((m) => m.user_id === u.id)
  );

  if (loading) {
    return (
      <div className="committee-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="loading">Loading committee details...</div>
        </div>
      </div>
    );
  }

  if (!committee) {
    return (
      <div className="committee-details-modal">
        <div className="modal-overlay" onClick={onClose}></div>
        <div className="modal-content">
          <div className="error-message">Committee not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="committee-details-modal">
      <div className="modal-overlay" onClick={onClose}></div>

      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{committee.name}</h2>
            <span
              className={`status-badge-large ${
                committee.status === 'Active' ? 'status-active' : 'status-inactive'
              }`}
            >
              {committee.status}
            </span>
          </div>
          {canEdit && (
            <button
              className="btn-edit-card"
              onClick={onEdit}
              type="button"
            >
              Edit
            </button>
          )}
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error">
            <span>⚠️</span>
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            ℹ️ Information
          </button>
          <button
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            👥 Members ({committee.members?.length ?? 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="modal-body">
          {/* INFO TAB */}
          {activeTab === 'info' && (
            <div className="tab-content">
              {committee.description && (
                <div className="content-section">
                  <h3>Description</h3>
                  <p>{committee.description}</p>
                </div>
              )}

              <div className="info-grid">
                <div className="info-item">
                  <label>Status</label>
                  <p>{committee.status}</p>
                </div>

                <div className="info-item">
                  <label>Chair</label>
                  <p>{committee.chair_name || '—'}</p>
                </div>

                <div className="info-item">
                  <label>Members</label>
                  <p>{committee.members?.length ?? 0}</p>
                </div>

                <div className="info-item">
                  <label>Created</label>
                  <p>{new Date(committee.created_at).toLocaleString()}</p>
                </div>

                {committee.updated_at && committee.updated_at !== committee.created_at && (
                  <div className="info-item">
                    <label>Last Updated</label>
                    <p>{new Date(committee.updated_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEMBERS TAB */}
          {activeTab === 'members' && (
            <div className="tab-content">
              <div className="members-section-header">
                <h3>Committee Members</h3>
                {canManageMembers && (
                  <button
                    className="btn-add-member"
                    onClick={() => {
                      setShowAddMember(!showAddMember);
                      setMemberError('');
                    }}
                  >
                    {showAddMember ? '✕ Cancel' : '+ Add Member'}
                  </button>
                )}
              </div>

              {/* Add Member Form */}
              {showAddMember && canManageMembers && (
                <div className="add-member-form">
                  <h4>Add New Member</h4>
                  {memberError && (
                    <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>
                      <span>⚠️</span>
                      <p>{memberError}</p>
                    </div>
                  )}
                  <div className="add-member-fields">
                    <select
                      value={newMemberUserId}
                      onChange={(e) => setNewMemberUserId(e.target.value)}
                    >
                      <option value="">— Select user —</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                    >
                      <option value="Member">Member</option>
                      <option value="Chair">Chair</option>
                      <option value="Secretary">Secretary</option>
                      <option value="Committee Secretary">Committee Secretary</option>
                    </select>

                    <div className="add-member-actions">
                      <button
                        className="btn-confirm-add"
                        onClick={handleAddMember}
                        disabled={addingMember}
                      >
                        {addingMember ? 'Adding...' : 'Add'}
                      </button>
                      <button
                        className="btn-cancel-add"
                        onClick={() => {
                          setShowAddMember(false);
                          setMemberError('');
                          setNewMemberUserId('');
                          setNewMemberRole('Member');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Members Table */}
              {committee.members?.length > 0 ? (
                <div className="members-table-wrapper">
                  <table className="members-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined</th>
                        {canManageMembers && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {committee.members.map((member) => (
                        <tr key={member.id}>
                          <td>{member.user_name}</td>
                          <td>{member.user_email}</td>
                          <td>
                            <span
                              className={`role-badge ${
                                member.role === 'Chair'
                                  ? 'role-chair'
                                  : member.role === 'Secretary'
                                  ? 'role-secretary'
                                  : member.role === 'Committee Secretary'
                                  ? 'role-committee-secretary'
                                  : 'role-member'
                              }`}
                            >
                              {member.role === 'Committee Secretary' ? 'Committee Secretary' : member.role}
                            </span>
                          </td>
                          <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                          {canManageMembers && (
                            <td>
                              <button
                                className="btn-remove-member"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMemberId === member.id}
                              >
                                {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="no-members">No members in this committee yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-cancel" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button className="btn btn-secondary" onClick={onEdit}>
              ✏️ Edit
            </button>
          )}
          {canDelete && (
            <button className="btn btn-danger" onClick={() => setShowDeleteModal(true)}>
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteModal && (
        <div className="delete-confirmation">
          <div className="confirm-content">
            <h3>Delete Committee?</h3>
            <p>
              Are you sure you want to delete <strong>{committee.name}</strong>? This action
              cannot be undone and will remove all members from this committee.
            </p>
            <div className="confirm-actions">
              <button
                className="btn btn-cancel"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
