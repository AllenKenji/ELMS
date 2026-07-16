import { Fragment, useState, useEffect, useRef } from 'react';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import '../styles/UserManagement.css';

const API_BASE_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:5000')
  .trim()
  .replace(/\/+$/, '');

const ROLES = [
  { id: '1', name: 'Admin' },
  { id: '2', name: 'Secretary' },
  { id: '3', name: 'Councilor' },
  { id: '4', name: 'Vice Mayor' },
  { id: '5', name: 'Resident' },
  { id: '6', name: 'Committee Secretary' },
];

export default function UserManagement({ users, currentUserRole, authContext }) {
  const { user: authUser, updateUser } = useAuth();
  const [allUsers, setAllUsers] = useState(Array.isArray(users) ? users : []);
  const [form, setForm] = useState({ name: '', email: '', password: '', roleId: '' });
  const [newUserPhotoFile, setNewUserPhotoFile] = useState(null);
  const [newUserSignatureFile, setNewUserSignatureFile] = useState(null);
  const [addUserFormKey, setAddUserFormKey] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [signatureFiles, setSignatureFiles] = useState({});
  const [signatureBusyUserId, setSignatureBusyUserId] = useState(null);
  const [photoFiles, setPhotoFiles] = useState({});
  const [photoBusyUserId, setPhotoBusyUserId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [drawSignatureUser, setDrawSignatureUser] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawnStroke, setHasDrawnStroke] = useState(false);
  const canvasRef = useRef(null);

  // Try to get role from multiple sources
  const getUserRole = () => {
    // 1. From prop
    if (currentUserRole) {
      console.log('Role from prop:', currentUserRole);
      return currentUserRole;
    }
    
    // 2. From context
    if (authContext?.user?.role || authContext?.user?.role_id) {
      console.log('Role from context:', authContext.user.role || authContext.user.role_id);
      return authContext.user.role || authContext.user.role_id;
    }

    // 3. From AuthProvider
    if (authUser?.role || authUser?.role_id) {
      console.log('Role from AuthProvider:', authUser.role || authUser.role_id);
      return authUser.role || authUser.role_id;
    }
    
    // 4. From localStorage
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        console.log('Role from localStorage:', user.role || user.role_id);
        return user.role || user.role_id;
      }
    } catch (e) {
      console.error('Error reading from localStorage:', e);
    }
    
    // 5. Default: not admin
    console.log('No role found - defaulting to non-admin');
    return null;
  };

  const userRole = getUserRole();
  const normalizedRole = String(userRole || '').trim().toLowerCase();
  const isAdmin = normalizedRole === 'admin' || normalizedRole === '1';

  useEffect(() => {
    console.log(`Role: ${userRole}, IsAdmin: ${isAdmin}`);

    if (!users && isAdmin) {
      fetchUsers();
    }
  }, [users, userRole, isAdmin]);

  useEffect(() => {
    if (Array.isArray(users)) {
      setAllUsers(users);
    }
  }, [users]);

  useEffect(() => {
    if (!drawSignatureUser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    const width = 500;
    const height = 170;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.strokeStyle = '#111111';
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    setHasDrawnStroke(false);
    setIsDrawing(false);
  }, [drawSignatureUser]);

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
      const res = await api.post('/auth/register', {
        ...form,
        roleId: parseInt(form.roleId),
      });
      
      const createdUser = res.data;
      setAllUsers(prev => [...prev, createdUser]);

      const uploadIssues = [];
      if (newUserPhotoFile) {
        try {
          await uploadPhotoFile(createdUser.id, newUserPhotoFile);
        } catch (uploadErr) {
          uploadIssues.push(uploadErr?.message || 'profile photo');
        }
      }

      if (newUserSignatureFile) {
        try {
          await uploadSignatureFile(createdUser.id, newUserSignatureFile);
        } catch (uploadErr) {
          uploadIssues.push(uploadErr?.message || 'e-signature');
        }
      }

      setForm({ name: '', email: '', password: '', roleId: '' });
      setNewUserPhotoFile(null);
      setNewUserSignatureFile(null);
      setAddUserFormKey((prev) => prev + 1);
      setError('');
      setSuccess('User created successfully!');

      if (uploadIssues.length > 0) {
        setError(`User was created, but ${uploadIssues.join(' and ')} could not be uploaded.`);
      }
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error creating user. Please try again.';
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
      await api.patch(`/users/${id}/role`, { role_id: parseInt(editRole) });
      
      setAllUsers(prev =>
        prev.map(u => (u.id === id ? { ...u, role_id: parseInt(editRole) } : u))
      );
      
      setEditingId(null);
      setEditRole('');
      setError('');
      setSuccess('User role updated successfully!');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error updating role. Please try again.';
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
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'Error deleting user. Please try again.';
      setError(errorMsg);
      console.error('Error deleting user:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (roleId) => {
    return ROLES.find(r => r.id === String(roleId))?.name || `Role ${roleId}`;
  };

  const getUserSignatureUrl = (user) => {
    return user?.e_signature_url || user?.signature_url || null;
  };

  const getUserPhotoUrl = (user) => {
    return user?.e_profile_photo_url || user?.photo_url || user?.profile_photo_url || null;
  };

  const hasUserSignature = (user) => {
    return Boolean(getUserSignatureUrl(user) || user?.e_signature_has_data);
  };

  const hasUserPhoto = (user) => {
    return Boolean(getUserPhotoUrl(user) || user?.e_profile_photo_has_data);
  };

  const getUserSignaturePreviewUrl = (user) => {
    return `${API_BASE_URL}/users/${user.id}/signature/preview`;
  };

  const handlePreviewSignature = async (user) => {
    try {
      const response = await api.get(`/users/${user.id}/signature/preview`, {
        responseType: 'blob',
      });

      const mimeType = response.headers?.['content-type'] || 'image/png';
      const objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to load signature preview.');
    }
  };

  const handlePreviewPhoto = async (user) => {
    try {
      const response = await api.get(`/users/${user.id}/photo/preview`, {
        responseType: 'blob',
      });

      const mimeType = response.headers?.['content-type'] || 'image/png';
      const objectUrl = window.URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      window.open(objectUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setError(err?.message || 'Failed to load profile photo preview.');
    }
  };

  const toAbsoluteSignatureUrl = (signatureUrl) => {
    if (!signatureUrl) return null;
    if (/^https?:\/\//i.test(signatureUrl)) return signatureUrl;
    return `${API_BASE_URL}${signatureUrl.startsWith('/') ? '' : '/'}${signatureUrl}`;
  };

  const handleSignatureFileChange = (userId, file) => {
    setSignatureFiles((prev) => ({
      ...prev,
      [userId]: file || null,
    }));
  };

  const handlePhotoFileChange = (userId, file) => {
    setPhotoFiles((prev) => ({
      ...prev,
      [userId]: file || null,
    }));
  };

  const uploadSignatureFile = async (userId, file) => {
    const payload = new FormData();
    payload.append('signature', file);

    const res = await api.post(`/users/${userId}/signature`, payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const signatureUrl = res.data?.signature_url || null;
    setAllUsers((prev) => prev.map((u) => (
      u.id === userId ? { ...u, e_signature_url: signatureUrl } : u
    )));
  };

  const uploadPhotoFile = async (userId, file) => {
    const payload = new FormData();
    payload.append('photo', file);

    const res = await api.post(`/users/${userId}/photo`, payload, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const photoUrl = res.data?.photo_url || null;
    setAllUsers((prev) => prev.map((u) => (
      u.id === userId ? { ...u, e_profile_photo_url: photoUrl } : u
    )));

    if (String(authUser?.id) === String(userId)) {
      updateUser((currentUser) => currentUser ? { ...currentUser, photo_url: photoUrl } : currentUser);
    }
  };

  const handleUploadSignature = async (userId) => {
    const selectedFile = signatureFiles[userId];
    if (!selectedFile) {
      setError('Please select a signature image first.');
      return;
    }

    try {
      setSignatureBusyUserId(userId);
      setError('');
      await uploadSignatureFile(userId, selectedFile);
      setSignatureFiles((prev) => ({ ...prev, [userId]: null }));
      setSuccess('E-signature uploaded successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to upload e-signature. Please try again.');
    } finally {
      setSignatureBusyUserId(null);
    }
  };

  const handleDeleteSignature = async (userId) => {
    try {
      setSignatureBusyUserId(userId);
      setError('');
      await api.delete(`/users/${userId}/signature`);
      setAllUsers((prev) => prev.map((u) => (
        u.id === userId ? { ...u, e_signature_url: null } : u
      )));
      setSuccess('E-signature removed successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to remove e-signature. Please try again.');
    } finally {
      setSignatureBusyUserId(null);
    }
  };

  const handleUploadPhoto = async (userId) => {
    const selectedFile = photoFiles[userId];
    if (!selectedFile) {
      setError('Please select a profile photo first.');
      return;
    }

    try {
      setPhotoBusyUserId(userId);
      setError('');
      await uploadPhotoFile(userId, selectedFile);
      setPhotoFiles((prev) => ({ ...prev, [userId]: null }));
      setSuccess('Profile photo uploaded successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to upload profile photo. Please try again.');
    } finally {
      setPhotoBusyUserId(null);
    }
  };

  const handleDeletePhoto = async (userId) => {
    try {
      setPhotoBusyUserId(userId);
      setError('');
      await api.delete(`/users/${userId}/photo`);
      setAllUsers((prev) => prev.map((u) => (
        u.id === userId ? { ...u, e_profile_photo_url: null } : u
      )));
      if (String(authUser?.id) === String(userId)) {
        updateUser((currentUser) => currentUser ? { ...currentUser, photo_url: null } : currentUser);
      }
      setSuccess('Profile photo removed successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.message || 'Failed to remove profile photo. Please try again.');
    } finally {
      setPhotoBusyUserId(null);
    }
  };

  const openDrawSignatureModal = (user) => {
    setDrawSignatureUser(user);
    setError('');
  };

  const closeDrawSignatureModal = () => {
    setDrawSignatureUser(null);
    setIsDrawing(false);
    setHasDrawnStroke(false);
  };

  const getCanvasPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const source = event.touches?.[0] || event.changedTouches?.[0] || event;
    return {
      x: source.clientX - rect.left,
      y: source.clientY - rect.top,
    };
  };

  const beginStroke = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const drawStroke = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawnStroke(true);
  };

  const endStroke = (event) => {
    if (!isDrawing) return;
    if (event?.preventDefault) event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.closePath();
    setIsDrawing(false);
  };

  const clearDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const width = Number(canvas.style.width.replace('px', '')) || 500;
    const height = Number(canvas.style.height.replace('px', '')) || 170;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    setHasDrawnStroke(false);
  };

  const saveDrawnSignature = async () => {
    if (!drawSignatureUser || !canvasRef.current) return;
    if (!hasDrawnStroke) {
      setError('Please draw a signature first.');
      return;
    }

    try {
      setSignatureBusyUserId(drawSignatureUser.id);
      setError('');
      const blob = await new Promise((resolve) => {
        canvasRef.current.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        setError('Unable to save the drawn signature. Please try again.');
        return;
      }

      const file = new File([blob], `signature-user-${drawSignatureUser.id}.png`, { type: 'image/png' });
      await uploadSignatureFile(drawSignatureUser.id, file);
      setSuccess('E-signature drawn and uploaded successfully.');
      setTimeout(() => setSuccess(''), 3000);
      closeDrawSignatureModal();
    } catch (err) {
      setError(err?.message || 'Failed to upload drawn signature. Please try again.');
    } finally {
      setSignatureBusyUserId(null);
    }
  };

  const startEditRole = (userId, currentRole) => {
    setEditingId(userId);
    setEditRole(String(currentRole));
  };

  const toggleSelectedUser = (userId) => {
    setSelectedUserId((prev) => (prev === userId ? null : userId));
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
      <form key={addUserFormKey} onSubmit={handleSubmit} className="add-user-form">
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

        <div className="form-group">
          <label htmlFor="newUserPhoto">Profile Photo</label>
          <input
            id="newUserPhoto"
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => setNewUserPhotoFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
          <small className="helper-text">Optional. Uploads to the new user account after it is created.</small>
        </div>

        <div className="form-group">
          <label htmlFor="newUserSignature">E-Signature</label>
          <input
            id="newUserSignature"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => setNewUserSignatureFile(e.target.files?.[0] || null)}
            disabled={loading}
          />
          <small className="helper-text">Optional. Uploads to the new user account after it is created.</small>
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
                  <th>Photo</th>
                  <th>E-Signature</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map(u => (
                  <Fragment key={u.id}>
                    <tr
                      key={u.id}
                      className={`${editingId === u.id ? 'editing' : ''} ${selectedUserId === u.id ? 'selected' : ''}`}
                      onClick={() => toggleSelectedUser(u.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleSelectedUser(u.id);
                        }
                      }}
                    >
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
                    <td className="photo-cell">
                      {hasUserPhoto(u) ? (
                        <div className="photo-status has-photo">
                          <span>Available</span>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => handlePreviewPhoto(u)}
                          >
                            Preview
                          </button>
                        </div>
                      ) : (
                        <span className="photo-status no-photo">No photo</span>
                      )}
                    </td>
                    <td className="signature-cell">
                      {hasUserSignature(u) ? (
                        <div className="signature-status has-signature">
                          <span>Available</span>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => handlePreviewSignature(u)}
                          >
                            Preview
                          </button>
                        </div>
                      ) : (
                        <span className="signature-status no-signature">No signature</span>
                      )}
                    </td>
                  </tr>
                  {selectedUserId === u.id && (
                    <tr className="actions-row" key={`${u.id}-actions`}>
                      <td colSpan={5}>
                        <div className="actions-panel">
                          <div className="actions-panel-header">
                            <strong>Actions for {u.name}</strong>
                            <button
                              type="button"
                              className="btn-link"
                              onClick={() => setSelectedUserId(null)}
                            >
                              Hide actions
                            </button>
                          </div>
                          <div className="actions-cell">
                            {editingId === u.id ? (
                              <>
                                <button 
                                  type="button"
                                  onClick={() => handleEditRole(u.id)}
                                  disabled={loading}
                                  className="btn btn-sm btn-success"
                                  aria-label={`Save role changes for ${u.name}`}
                                >
                                  Save
                                </button>
                                <button 
                                  type="button"
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
                                  type="button"
                                  onClick={() => startEditRole(u.id, u.role_id)}
                                  disabled={loading}
                                  className="btn btn-sm btn-warning"
                                  aria-label={`Edit role for ${u.name}`}
                                >
                                  Edit Role
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setDeleteConfirm(u.id)}
                                  disabled={loading}
                                  className="btn btn-sm btn-danger"
                                  aria-label={`Delete ${u.name}`}
                                >
                                  Delete
                                </button>
                                <div className="photo-actions">
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/webp"
                                    onChange={(e) => handlePhotoFileChange(u.id, e.target.files?.[0] || null)}
                                    disabled={loading || photoBusyUserId === u.id}
                                    aria-label={`Select profile photo for ${u.name}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUploadPhoto(u.id)}
                                    disabled={loading || photoBusyUserId === u.id || !photoFiles[u.id]}
                                    className="btn btn-sm btn-primary"
                                    aria-label={`Upload profile photo for ${u.name}`}
                                  >
                                    {photoBusyUserId === u.id ? 'Uploading...' : 'Upload Photo'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(u.id)}
                                    disabled={loading || photoBusyUserId === u.id || !hasUserPhoto(u)}
                                    className="btn btn-sm btn-secondary"
                                    aria-label={`Remove profile photo for ${u.name}`}
                                  >
                                    Remove Photo
                                  </button>
                                </div>
                                <div className="signature-actions">
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg"
                                    onChange={(e) => handleSignatureFileChange(u.id, e.target.files?.[0] || null)}
                                    disabled={loading || signatureBusyUserId === u.id}
                                    aria-label={`Select e-signature for ${u.name}`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUploadSignature(u.id)}
                                    disabled={loading || signatureBusyUserId === u.id || !signatureFiles[u.id]}
                                    className="btn btn-sm btn-primary"
                                    aria-label={`Upload e-signature for ${u.name}`}
                                  >
                                    {signatureBusyUserId === u.id ? 'Uploading...' : 'Upload Signature'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSignature(u.id)}
                                    disabled={loading || signatureBusyUserId === u.id || !hasUserSignature(u)}
                                    className="btn btn-sm btn-secondary"
                                    aria-label={`Remove e-signature for ${u.name}`}
                                  >
                                    Remove Signature
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openDrawSignatureModal(u)}
                                    disabled={loading || signatureBusyUserId === u.id}
                                    className="btn btn-sm btn-warning"
                                    aria-label={`Draw e-signature for ${u.name}`}
                                  >
                                    Draw with Mouse
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="button"
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

      {drawSignatureUser && (
        <div className="modal-overlay" onClick={closeDrawSignatureModal}>
          <div className="modal-content signature-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Draw E-Signature</h4>
            <p>
              Drawing signature for <strong>{drawSignatureUser.name}</strong>
            </p>
            <canvas
              ref={canvasRef}
              className="signature-pad-canvas"
              onMouseDown={beginStroke}
              onMouseMove={drawStroke}
              onMouseUp={endStroke}
              onMouseLeave={endStroke}
              onTouchStart={beginStroke}
              onTouchMove={drawStroke}
              onTouchEnd={endStroke}
            />
            <p className="signature-pad-hint">Use your mouse to sign. You can clear and redraw before saving.</p>
            <div className="modal-actions">
              <button type="button" onClick={clearDrawnSignature} className="btn btn-secondary">Clear</button>
              <button type="button" onClick={closeDrawSignatureModal} className="btn btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={saveDrawnSignature}
                disabled={signatureBusyUserId === drawSignatureUser.id}
                className="btn btn-primary"
              >
                {signatureBusyUserId === drawSignatureUser.id ? 'Saving...' : 'Save Signature'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}