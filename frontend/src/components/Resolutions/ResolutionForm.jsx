import { useState } from 'react';
import api from '../../api/api';
import '../../styles/ResolutionForm.css';

export default function ResolutionForm({
  onSuccess,
  onCancel,
  resolutionId = null,
  initialData = null,
  initialStatusOnCreate = 'Draft',
}) {
  const [formData, setFormData] = useState(
    initialData || {
      title: '',
      resolution_number: '',
      description: '',
      content: '',
      remarks: '',
    }
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title cannot exceed 200 characters';
    }

    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.content?.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.trim().length < 20) {
      newErrors.content = 'Content must be at least 20 characters';
    }

    setFormErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear error
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        resolution_number: formData.resolution_number.trim() || null,
        description: formData.description.trim(),
        content: formData.content.trim(),
        remarks: formData.remarks.trim() || null,
        status: initialStatusOnCreate,
      };

      if (resolutionId) {
        await api.put(`/resolutions/${resolutionId}`, payload);
        setSuccess('Resolution updated successfully!');
      } else {
        await api.post('/resolutions', payload);
        setSuccess('Resolution submitted successfully!');
      }

      // Reset form
      setFormData({
        title: '',
        resolution_number: '',
        description: '',
        content: '',
        remarks: '',
      });

      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Error submitting resolution. Please try again.';
      setError(msg);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      resolution_number: '',
      description: '',
      content: '',
      remarks: '',
    });
    setFormErrors({});
    setError('');
    setSuccess('');
  };

  const characterCount = {
    title: formData.title.length,
    description: formData.description.length,
    content: formData.content.length,
  };

  return (
    <div className="resolution-form-overlay">
      <div className="form-modal">
        {/* Header */}
        <div className="form-header">
          <h2>{resolutionId ? 'Edit Resolution' : 'Submit New Resolution'}</h2>
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

          {/* Title Field */}
          <div className="form-group">
            <label htmlFor="title">
              Title <span className="required">*</span>
            </label>
            <input
              id="title"
              type="text"
              name="title"
              placeholder="Enter resolution title"
              value={formData.title}
              onChange={handleChange}
              className={formErrors.title ? 'input-error' : ''}
              maxLength="200"
              required
            />
            <div className="field-hint">
              {formErrors.title ? (
                <span className="error-text">{formErrors.title}</span>
              ) : (
                <span className="char-count">{characterCount.title}/200</span>
              )}
            </div>
          </div>

          {/* Resolution Number Field */}
          <div className="form-group">
            <label htmlFor="resolution_number">Resolution Number (Optional)</label>
            <input
              id="resolution_number"
              type="text"
              name="resolution_number"
              placeholder="e.g., RES-2024-001"
              value={formData.resolution_number}
              onChange={handleChange}
            />
            <p className="field-helper">Automatic if left blank</p>
          </div>

          {/* Description Field */}
          <div className="form-group">
            <label htmlFor="description">
              Description <span className="required">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="Brief description of the resolution"
              value={formData.description}
              onChange={handleChange}
              className={formErrors.description ? 'input-error' : ''}
              rows="3"
              maxLength="500"
              required
            />
            <div className="field-hint">
              {formErrors.description ? (
                <span className="error-text">{formErrors.description}</span>
              ) : (
                <span className="char-count">{characterCount.description}/500</span>
              )}
            </div>
          </div>

          {/* Content Field */}
          <div className="form-group">
            <label htmlFor="content">
              Full Text <span className="required">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              placeholder="Complete resolution text..."
              value={formData.content}
              onChange={handleChange}
              className={formErrors.content ? 'input-error' : ''}
              rows="8"
              required
            />
            <div className="field-hint">
              {formErrors.content ? (
                <span className="error-text">{formErrors.content}</span>
              ) : (
                <span className="char-count">{characterCount.content} characters</span>
              )}
            </div>
          </div>

          {/* Remarks Field */}
          <div className="form-group">
            <label htmlFor="remarks">Additional Notes (Optional)</label>
            <textarea
              id="remarks"
              name="remarks"
              placeholder="Any additional remarks or notes..."
              value={formData.remarks}
              onChange={handleChange}
              rows="3"
            />
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={loading}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Submitting...' : resolutionId ? 'Update' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}