import { useState, useEffect } from 'react';
import api from '../../api/api';
import '../../styles/CommitteeForm.css';

export default function CommitteeForm({ onSuccess, onCancel, committeeId = null, initialData = null }) {
  const [formData, setFormData] = useState(
    initialData
      ? {
          name: initialData.name || '',
          description: initialData.description || '',
          chair_id: initialData.chair_id || '',
          status: initialData.status || 'Active',
        }
      : {
          name: '',
          description: '',
          chair_id: '',
          status: 'Active',
        }
  );

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Load users for chair selector
  useEffect(() => {
    api
      .get('/users')
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]));
  }, []);

  const validateForm = () => {
    const errors = {};
    if (!formData.name?.trim()) {
      errors.name = 'Committee name is required';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Name must be at least 3 characters';
    } else if (formData.name.trim().length > 200) {
      errors.name = 'Name cannot exceed 200 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        chair_id: formData.chair_id ? Number(formData.chair_id) : null,
        status: formData.status,
      };

      if (committeeId) {
        await api.put(`/committees/${committeeId}`, payload);
        setSuccess('Committee updated successfully!');
      } else {
        await api.post('/committees', payload);
        setSuccess('Committee created successfully!');
      }

      setTimeout(() => onSuccess?.(), 1200);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Error saving committee. Please try again.';
      setError(msg);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="committee-form-overlay">
      <div className="form-modal">
        {/* Header */}
        <div className="form-header">
          <h2>{committeeId ? 'Edit Committee' : 'New Committee'}</h2>
          <button
            className="btn-close"
            onClick={onCancel}
            aria-label="Close form"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="form-body">
          {/* Alerts */}
          {error && (
            <div className="alert alert-error">
              <span>⚠️</span>
              <p>{error}</p>
            </div>
          )}
          {success && (
            <div className="alert alert-success">
              <span>✅</span>
              <p>{success}</p>
            </div>
          )}

          {/* Name */}
          <div className="form-group">
            <label htmlFor="name">
              Name <span className="required">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="Enter committee name"
              value={formData.name}
              onChange={handleChange}
              className={formErrors.name ? 'input-error' : ''}
              maxLength="200"
              required
            />
            <div className="field-hint">
              {formErrors.name ? (
                <span className="error-text">{formErrors.name}</span>
              ) : (
                <span className="char-count">{formData.name.length}/200</span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              placeholder="Brief description of the committee's purpose"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              maxLength="500"
            />
            <div className="field-hint">
              <span className="char-count">{formData.description.length}/500</span>
            </div>
          </div>

          {/* Chair & Status */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="chair_id">Chair (Optional)</label>
              <select
                id="chair_id"
                name="chair_id"
                value={formData.chair_id}
                onChange={handleChange}
              >
                <option value="">— No chair assigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : committeeId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
