import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import api from '../api/api';
import "../styles/OrdinanceForm.css";

export default function OrdinanceForm({ onSuccess, onCancel }) {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    ordinance_number: '',
    description: '',
    content: '',
    remarks: '',
  });

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

    // Clear error for this field
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
        ordinance_number: formData.ordinance_number.trim() || null,
        description: formData.description.trim(),
        content: formData.content.trim(),
        remarks: formData.remarks.trim() || null,
        proposer_id: user?.id,
        proposer_name: user?.name,
        status: 'Draft',
      };

      const res = await api.post('/ordinances', payload);

      setSuccess(res.data?.message || 'Ordinance submitted successfully!');

      // Reset form
      setFormData({
        title: '',
        ordinance_number: '',
        description: '',
        content: '',
        remarks: '',
      });

      // Call success callback after 1.5 seconds
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Error submitting ordinance. Please try again.';
      setError(msg);
      console.error('Error submitting ordinance:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      title: '',
      ordinance_number: '',
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
    <div className="ordinance-form-wrapper">
      <form onSubmit={handleSubmit} className="ordinance-form-container">
        <div className="form-header">
          <div className="form-title-section">
            <h3>📋 Submit New Ordinance</h3>
            <p className="form-subtitle">
              Proposed by: <strong>{user?.name || 'Unknown'}</strong>
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="btn-close-form"
              aria-label="Close form"
            >
              ✕
            </button>
          )}
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success" role="alert">
            <span className="alert-icon">✓</span>
            <div>
              <strong>Success</strong>
              <p>{success}</p>
            </div>
          </div>
        )}

        {/* Title Field */}
        <div className="form-group">
          <label htmlFor="title">Ordinance Title *</label>
          <input
            id="title"
            type="text"
            name="title"
            placeholder="e.g., An Ordinance Regulating..."
            value={formData.title}
            onChange={handleChange}
            disabled={loading}
            maxLength="200"
            aria-invalid={!!formErrors.title}
            aria-describedby={formErrors.title ? 'title-error' : 'title-hint'}
          />
          <div className="form-hint" id="title-hint">
            {characterCount.title}/200 characters
          </div>
          {formErrors.title && (
            <span id="title-error" className="error-text">{formErrors.title}</span>
          )}
        </div>

        {/* Ordinance Number Field */}
        <div className="form-group">
          <label htmlFor="ordinance_number">Ordinance Number (Optional)</label>
          <input
            id="ordinance_number"
            type="text"
            name="ordinance_number"
            placeholder="e.g., ORD-2024-001"
            value={formData.ordinance_number}
            onChange={handleChange}
            disabled={loading}
          />
          <div className="form-hint">
            Leave blank to auto-generate
          </div>
        </div>

        {/* Description Field */}
        <div className="form-group">
          <label htmlFor="description">Description *</label>
          <textarea
            id="description"
            name="description"
            placeholder="Provide a brief description of the ordinance..."
            value={formData.description}
            onChange={handleChange}
            disabled={loading}
            rows="4"
            maxLength="1000"
            aria-invalid={!!formErrors.description}
            aria-describedby={formErrors.description ? 'description-error' : 'description-hint'}
          />
          <div className="form-hint" id="description-hint">
            {characterCount.description}/1000 characters
          </div>
          {formErrors.description && (
            <span id="description-error" className="error-text">{formErrors.description}</span>
          )}
        </div>

        {/* Content Field */}
        <div className="form-group">
          <label htmlFor="content">Full Content *</label>
          <textarea
            id="content"
            name="content"
            placeholder="Enter the complete text of the ordinance. Include sections, subsections, and all relevant details..."
            value={formData.content}
            onChange={handleChange}
            disabled={loading}
            rows="10"
            aria-invalid={!!formErrors.content}
            aria-describedby={formErrors.content ? 'content-error' : 'content-hint'}
          />
          <div className="form-hint" id="content-hint">
            {characterCount.content} characters
          </div>
          {formErrors.content && (
            <span id="content-error" className="error-text">{formErrors.content}</span>
          )}
        </div>

        {/* Remarks Field */}
        <div className="form-group">
          <label htmlFor="remarks">Remarks (Optional)</label>
          <textarea
            id="remarks"
            name="remarks"
            placeholder="Add any additional remarks or notes..."
            value={formData.remarks}
            onChange={handleChange}
            disabled={loading}
            rows="3"
            maxLength="500"
          />
          <div className="form-hint">
            {formData.remarks.length}/500 characters
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="submit"
            disabled={loading}
            className="btn-submit"
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              <>
                📤 Submit Ordinance
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="btn-reset"
          >
            Clear Form
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="btn-cancel"
            >
              Back to List
            </button>
          )}
        </div>

        {/* Helper Text */}
        <div className="form-helper">
          <p>
            <strong>📝 Tips:</strong>
            <ul>
              <li>Be clear and concise in your title</li>
              <li>Provide sufficient detail in the content</li>
              <li>All fields with * are required</li>
              <li>Your submission will be saved as Draft initially</li>
            </ul>
          </p>
        </div>
      </form>
    </div>
  );
}