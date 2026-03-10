import { useState, useEffect, useContext } from 'react';
import api from '../api/api';
import '../styles/UserManagement.css';

const ROLES = [
  { id: '1', name: 'Secretary' },
  { id: '2', name: 'Councilor' },
  { id: '3', name: 'Captain' },
  { id: '4', name: 'DILG' },
  { id: '5', name: 'Resident' },
  { id: '6', name: 'Admin' },
];

export default function UserManagement({ users, currentUserRole, authContext }) {
  const [allUsers, setAllUsers] = useState(users || []);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [debugInfo, setDebugInfo] = useState('');

  // Try to get role from multiple sources
  const getUserRole = () => {
    // 1. From prop
    if (currentUserRole) {
      console.log('Role from prop:', currentUserRole);
      return currentUserRole;
    }
    
    // 2. From context
    if (authContext?.user?.role_id) {
      console.log('Role from context:', authContext.user.role_id);
      return authContext.user.role_id;
    }
    
    // 3. From localStorage
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('Role from localStorage:', user.role_id);
        return user.role_id;
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
    
    // 4. Default: not admin
    console.log('No role found - defaulting to non-admin');
    return null;
  };

  const userRole = getUserRole();
  const isAdmin = userRole === '6' || userRole === 6;

  useEffect(() => {
    // Debug logging
    const debugMsg = `Role: ${userRole}, IsAdmin: ${isAdmin}`;
    setDebugInfo(debugMsg);
    console.log(debugMsg);

    if (!users) {
      fetchUsers();
    }
  }, [users, userRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setAllUsers(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load users. Please try again.');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!form.email?.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!form.password?.trim()) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!form.roleId) {
      newErrors.roleId = 'Please select a role';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isAdmin) {
      setError('You do not have permission to add users.');
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/register', {
        ...form,
        roleId: parseInt(form.roleId),
      });
      
      setAllUsers(prev => [...prev, res.data]);
      setForm({ name: '', email: '', password: '', roleId: '' });
      setError('');
      setSuccess('User created successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error creating user. Please try again.';
      setError(errorMsg);
      console.error('Error creating user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = async (id) => {
    if (!isAdmin) {
      setError('You do not have permission to edit user roles.');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/users/${id}`, { role_id: parseInt(editRole) });
      
      setAllUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, role_id: parseInt(editRole) } : u))
      );
      
      setEditingId(null);
      setEditRole('');
      setError('');
      setSuccess('User role updated successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error updating role. Please try again.';
      setError(errorMsg);
      console.error('Error updating role:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      setError('You do not have permission to delete users.');
      return;
    }

    try {
      setLoading(true);
      await api.delete(`/users/${id}`);
      setAllUsers(prev => prev.filter(u => u.id !== id));
      setDeleteConfirm(null);
      setError('');
      setSuccess('User deleted successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Error deleting user. Please try again.';
      setError(errorMsg);
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (roleId) => {
    return ROLES.find(r => r.id === String(roleId))?.name || `Role ${roleId}`;
  };

  const startEditRole = (userId, currentRole) => {
    setEditingId(userId);
    setEditRole(String(currentRole));
  };

  if (!isAdmin) {
    return (
      <div className="user-management">
        <h3>User Management</h3>
        <div className="alert alert-warning">
          ⚠️ You do not have permission to manage users. Only admins can access this section.
        </div>
        <details style={{ marginTop: '1rem', color: '#666', fontSize: '0.9rem' }}>
          <summary>Debug Info</summary>
          <pre style={{ background: '#f5f5f5', padding: '0.75rem', borderRadius: '4px', overflow: 'auto' }}>
{`Current User Role: ${userRole || 'Not found'}
Is Admin: ${isAdmin}

Checking sources:
- Prop (currentUserRole): ${currentUserRole || 'undefined'}
- Auth Context: ${authContext?.user?.role_id || 'not provided'}
- LocalStorage: (check browser DevTools)

To fix this:
1. Ensure currentUserRole prop is passed correctly
2. Or use AuthContext to get current user
3. Or check localStorage['user'] in DevTools`}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="user-management">
      <h3>User Management</h3>

      {/* Alert Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Add User Form */}
      <form onSubmit={handleSubmit} className="add-user-form">
        <h4>Add New User</h4>
        
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            name="name"
            placeholder="Enter user name"
            value={form.name}
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!formErrors.name}
            aria-describedby={formErrors.name ? 'name-error' : undefined}
          />
          {formErrors.name && <span id="name-error" className="error-text">{formErrors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="Enter email address"
            value={form.email}
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!formErrors.email}
            aria-describedby={formErrors.email ? 'email-error' : undefined}
          />
          {formErrors.email && <span id="email-error" className="error-text">{formErrors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password *</label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Enter password (min 6 characters)"
            value={form.password}
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!formErrors.password}
            aria-describedby={formErrors.password ? 'password-error' : undefined}
          />
          {formErrors.password && <span id="password-error" className="error-text">{formErrors.password}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="roleId">Role *</label>
          <select 
            id="roleId"
            name="roleId" 
            value={form.roleId} 
            onChange={handleChange}
            disabled={loading}
            aria-invalid={!!formErrors.roleId}
            aria-describedby={formErrors.roleId ? 'roleId-error' : undefined}
          >
            <option value="">Select Role</option>
            {ROLES.map(role => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </select>
          {formErrors.roleId && <span id="roleId-error" className="error-text">{formErrors.roleId}</span>}
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Creating...' : 'Add User'}
        </button>
      </form>

      {/* User List */}
      <div className="user-list-container">
        <h4>All Users ({allUsers.length})</h4>
        {allUsers.length === 0 ? (
          <p className="empty-state">No users found. Add your first user above.</p>
        ) : (
          <div className="table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <tr key={u.id} className={editingId === u.id ? 'editing' : ''}>
                    <td>{u.name}</td>
                    <td className="email-cell">{u.email}</td>
                    <td className="role-cell">
                      {editingId === u.id ? (
                        <select 
                          value={editRole} 
                          onChange={(e) => setEditRole(e.target.value)}
                          disabled={loading}
                          aria-label={`Edit role for ${u.name}`}
                        >
                          {ROLES.map(role => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`role-badge role-${editRole || u.role_id}`}>
                          {getRoleName(u.role_id)}
                        </span>
                      )}
                    </td>
                    <td className="actions-cell">
                      {editingId === u.id ? (
                        <>
                          <button 
                            onClick={() => handleEditRole(u.id)}
                            disabled={loading}
                            className="btn btn-sm btn-success"
                            aria-label={`Save role changes for ${u.name}`}
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => {
                              setEditingId(null);
                              setEditRole('');
                            }}
                            disabled={loading}
                            className="btn btn-sm btn-secondary"
                            aria-label={`Cancel editing ${u.name}`}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEditRole(u.id, u.role_id)}
                            disabled={loading}
                            className="btn btn-sm btn-warning"
                            aria-label={`Edit role for ${u.name}`}
                          >
                            Edit Role
                          </button>
                          <button 
                            onClick={() => setDeleteConfirm(u.id)}
                            disabled={loading}
                            className="btn btn-sm btn-danger"
                            aria-label={`Delete ${u.name}`}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>Confirm Deletion</h4>
            <p>
              Are you sure you want to delete <strong>{allUsers.find(u => u.id === deleteConfirm)?.name}</strong>?
            </p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}
                className="btn btn-danger"
              >
                {loading ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}