// Standing committee purposes and descriptions
const STANDING_COMMITTEE_INFO = {
  'Committee on Appropriations': {
    scope: 'Handles budget, finance, and taxation matters.',
    description: 'Reviews the annual budget, supplemental budgets, taxation measures, and financial accountability. Ensures fiscal discipline and proper allocation of resources.'
  },
  'Committee on Rules': {
    scope: 'Oversees legislative procedures and discipline.',
    description: 'Handles the internal rules of procedure, discipline of members, and order of business. Ensures legislative processes are followed correctly.'
  },
  'Committee on Health and Sanitation': {
    scope: 'Addresses public health programs.',
    description: 'Focuses on public health programs, sanitation ordinances, hospital and clinic operations, and disease prevention initiatives.'
  },
  'Committee on Education': {
    scope: 'Focuses on schools and learning initiatives.',
    description: 'Deals with local educational programs, school support, scholarships, and ordinances affecting learning institutions.'
  },
  'Committee on Peace and Order': {
    scope: 'Works with police and barangays on security.',
    description: 'Coordinates with police and barangays on crime prevention, traffic management, and public safety ordinances.'
  },
  'Committee on Infrastructure/Public Works': {
    scope: 'Supervises roads, buildings, utilities.',
    description: 'Supervises projects related to roads, bridges, drainage, public buildings, and utilities. Reviews contracts and construction ordinances.'
  },
  'Committee on Environment': {
    scope: 'Manages environmental protection and sustainability.',
    description: 'Handles environmental protection, waste management, pollution control, and sustainable development ordinances.'
  },
  'Committee on Women, Family, and Gender Equality': {
    scope: 'Promotes gender-sensitive policies.',
    description: 'Promotes gender-sensitive policies, family welfare programs, and ordinances protecting women and children.'
  },
  'Committee on Youth and Sports Development': {
    scope: 'Supports youth programs and sports.',
    description: 'Supports youth councils, sports programs, and ordinances encouraging youth participation in governance.'
  },
  "Committee on Agriculture / Fisheries": {
    scope: 'Supports local farmers and fisherfolk.',
    description: 'Focuses on farmers’ and fisherfolk’s welfare, agricultural productivity, and ordinances supporting food security.'
  },
  "Committee on Trade, Commerce, and Industry": {
    scope: 'Promotes local business and economic growth.',
    description: 'Reviews measures affecting local businesses, cooperatives, and economic development.'
  },
  "Committee on Barangay Affairs": {
    scope: 'Coordinates with barangays on local governance.',
    description: 'Handles ordinances and resolutions affecting barangay governance and coordination.'
  },
};

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
          vice_chair_id: initialData.vice_chair_id || '',
          member_ids: initialData.member_ids || [],
          status: initialData.status || 'Active',
          type: initialData.type || '',
          scope: initialData.scope || '',
          duration: initialData.duration || '',
        }
      : {
          name: '',
          description: '',
          chair_id: '',
          vice_chair_id: '',
          member_ids: [],
          status: 'Active',
          type: '',
          scope: '',
          duration: '',
        }
  );

  // const [users, setUsers] = useState([]); // removed, not used
  const [councilors, setCouncilors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});
  // Committee secretaries state
  const [secretaries, setSecretaries] = useState([]);


  // Load users for chair selector and committee secretary selector
  useEffect(() => {
    api
      .get('/users')
      .then((res) => {
        const allUsers = res.data || [];
        setCouncilors(allUsers.filter((u) => u.role === 'Councilor'));
        setSecretaries(allUsers.filter((u) => u.role === 'Committee Secretary'));
      })
      .catch(() => {
        setCouncilors([]);
        setSecretaries([]);
      });
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
    if (!formData.type) {
      errors.type = 'Committee type is required';
    }
    if (formData.type === 'Special' && !formData.duration) {
      errors.duration = 'Duration is required for special committees';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, options } = e.target;
    if (name === 'member_ids') {
      // Multi-select for members
      const selected = Array.from(options).filter((o) => o.selected).map((o) => o.value);
      setFormData((prev) => ({ ...prev, member_ids: selected }));
      if (formErrors[name]) {
        setFormErrors((prev) => ({ ...prev, [name]: '' }));
      }
      return;
    }
    // If Standing type and committee name matches, auto-fill scope and description
    if (name === 'name' && formData.type === 'Standing' && STANDING_COMMITTEE_INFO[value]) {
      setFormData((prev) => ({
        ...prev,
        name: value,
        scope: STANDING_COMMITTEE_INFO[value].scope,
        description: STANDING_COMMITTEE_INFO[value].description,
      }));
    } else if (name === 'type' && value === 'Standing' && STANDING_COMMITTEE_INFO[formData.name]) {
      setFormData((prev) => ({
        ...prev,
        type: value,
        scope: STANDING_COMMITTEE_INFO[prev.name]?.scope || prev.scope,
        description: STANDING_COMMITTEE_INFO[prev.name]?.description || prev.description,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
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
        vice_chair_id: formData.vice_chair_id ? Number(formData.vice_chair_id) : null,
        member_ids: formData.member_ids.map((id) => Number(id)),
        status: formData.status,
        type: formData.type,
        scope: formData.scope?.trim() || null,
        duration: formData.type === 'Special' ? formData.duration?.trim() : null,
        committee_secretary_id: formData.committee_secretary_id ? Number(formData.committee_secretary_id) : null,
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
      <div className="committee-form-container">
        <h2 className="form-title">
          {committeeId ? 'Edit Committee' : 'Create Committee'}
        </h2>

        <form className="committee-form" onSubmit={handleSubmit}>
          
          {/* Name */}
          <div className="form-group">
            <label htmlFor="name">
              Name <span className="required">*</span>
            </label>
            {formData.type === 'Standing' ? (
              <select
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={formErrors.name ? 'input-error' : ''}
                required
              >
                <option value="">— Select standing committee —</option>
                {Object.keys(STANDING_COMMITTEE_INFO).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
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
            )}
            <div className="field-hint">
              {formErrors.name ? (
                <span className="error-text">{formErrors.name}</span>
              ) : (
                <span className="char-count">{formData.name.length}/200</span>
              )}
            </div>
          </div>

          {/* Type */}
          <div className="form-group">
            <label htmlFor="type">
              Type <span className="required">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className={formErrors.type ? 'input-error' : ''}
              required
            >
              <option value="">— Select type —</option>
              <option value="Standing">Standing</option>
              <option value="Special">Special</option>
              <option value="Oversight">Oversight</option>
            </select>
            {formErrors.type && <span className="error-text">{formErrors.type}</span>}
          </div>

          {/* Scope / Purpose */}
          <div className="form-group">
            <label htmlFor="scope">Scope or Purpose (Optional)</label>
            <input
              id="scope"
              type="text"
              name="scope"
              placeholder="Describe the committee's scope or purpose"
              value={formData.scope}
              onChange={handleChange}
              maxLength="300"
              readOnly={formData.type === 'Standing' && STANDING_COMMITTEE_INFO[formData.name]}
            />
            <div className="field-hint">
              <span className="char-count">{formData.scope.length}/300</span>
            </div>
            {/* Show standing committee description if available
            {formData.type === 'Standing' && STANDING_COMMITTEE_INFO[formData.name] && (
              <div className="standing-desc">
                <em>{STANDING_COMMITTEE_INFO[formData.name].description}</em>
              </div>
            )} */}
          </div>

          {/* Duration (for Special) */}
          {formData.type === 'Special' && (
            <div className="form-group">
              <label htmlFor="duration">
                Duration <span className="required">*</span>
              </label>
              <input
                id="duration"
                type="text"
                name="duration"
                placeholder="e.g., 3 months, until task complete"
                value={formData.duration}
                onChange={handleChange}
                className={formErrors.duration ? 'input-error' : ''}
                maxLength="100"
                required
              />
              {formErrors.duration && <span className="error-text">{formErrors.duration}</span>}
            </div>
          )}

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

          {/* Chair, Vice Chair, Members, & Status */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="chair_id">Chairperson</label>
              <select
                id="chair_id"
                name="chair_id"
                value={formData.chair_id}
                onChange={handleChange}
              >
                <option value="">— No chair assigned —</option>
                {councilors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="vice_chair_id">Vice Chairperson</label>
              <select
                id="vice_chair_id"
                name="vice_chair_id"
                value={formData.vice_chair_id}
                onChange={handleChange}
              >
                <option value="">— No vice chair assigned —</option>
                {councilors.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Members (add/remove UI) */}
            <div className="form-group">
              <label>Members</label>
              <div className="member-select-list">
                  {/* Add member dropdown */}
                  <select
                    id="add_member"
                    name="add_member"
                    value=""
                    onChange={e => {
                      const id = e.target.value;
                      if (id && !formData.member_ids.includes(id)) {
                        setFormData(prev => ({ ...prev, member_ids: [...prev.member_ids, id] }));
                      }
                    }}
                  >
                    <option value="">— Add councilor as member —</option>
                    {councilors.filter(u => !formData.member_ids.includes(String(u.id))).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  {/* List of selected members with remove button */}
                  <ul className="selected-members-list">
                    {formData.member_ids.map(id => {
                      const member = councilors.find(u => String(u.id) === String(id));
                      return member ? (
                        <li key={id} className="selected-member-item">
                          {member.name}
                          <button
                            type="button"
                            className="remove-member-btn"
                            title="Remove member"
                            onClick={() => setFormData(prev => ({ ...prev, member_ids: prev.member_ids.filter(mid => mid !== id) }))}
                          >
                            ✕
                          </button>
                        </li>
                      ) : null;
                    })}
                  </ul>
                </div>
              </div>
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

          {/* Committee Secretary */}
          <div className="form-group">
            <label htmlFor="committee_secretary_id">Committee Secretary</label>
            <select
              id="committee_secretary_id"
              name="committee_secretary_id"
              value={formData.committee_secretary_id || ''}
              onChange={handleChange}
            >
              <option value="">— No secretary assigned —</option>
              {secretaries.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
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
