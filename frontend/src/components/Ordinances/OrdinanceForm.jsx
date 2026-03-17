import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import RichTextEditor from '../common/RichTextEditor';
import { richTextToPlainText, hasMeaningfulRichText, sanitizeRichText } from '../../utils/richText';
import "../../styles/OrdinanceForm.css";

export default function OrdinanceForm({
  onSuccess,
  onCancel,
  ordinanceId,
  initialData,
  autoSubmitAfterCreate = false,
  initialStatusOnCreate = 'Draft',
}) {
  const { user } = useAuth();

  const [formData, setFormData] = useState(
    initialData || {
      title: '',
      ordinance_number: '',
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
    const descriptionText = richTextToPlainText(formData.description || '');
    const contentText = richTextToPlainText(formData.content || '');

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.trim().length > 200) {
      newErrors.title = 'Title cannot exceed 200 characters';
    }

    if (!hasMeaningfulRichText(formData.description)) {
      newErrors.description = 'Description is required';
    } else if (descriptionText.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!hasMeaningfulRichText(formData.content)) {
      newErrors.content = 'Content is required';
    } else if (contentText.length < 20) {
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

  const handleRichTextChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

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
      const basePayload = {
        title: formData.title.trim(),
        ordinance_number: formData.ordinance_number.trim() || null,
        description: sanitizeRichText(formData.description || ''),
        content: sanitizeRichText(formData.content || ''),
        remarks: formData.remarks.trim() || null,
      };

      let successMsg;
      if (ordinanceId) {
        const payload = { ...basePayload };
        await api.put(`/ordinances/${ordinanceId}`, payload);
        successMsg = 'Ordinance updated successfully!';
      } else {
        const payload = {
          ...basePayload,
          status: autoSubmitAfterCreate ? 'Submitted' : initialStatusOnCreate,
        };
        const res = await api.post('/ordinances', payload);

        if (autoSubmitAfterCreate) {
          successMsg = 'Ordinance submitted successfully!';
        } else {
          successMsg = res.data?.message || 'Ordinance saved as draft successfully!';
        }
      }

      setSuccess(successMsg);

      // Only reset form when creating a new ordinance
      if (!ordinanceId) {
        setFormData({
          title: '',
          ordinance_number: '',
          description: '',
          content: '',
          remarks: '',
        });
      }

      // Call success callback after 1.5 seconds
      setTimeout(() => onSuccess?.(), 1500);
    } catch (err) {
      const detailMessage = Array.isArray(err?.details) && err.details.length > 0
        ? err.details.map((d) => d?.message).filter(Boolean).join(' ')
        : '';
      const msg =
        detailMessage ||
        err?.message ||
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
    description: richTextToPlainText(formData.description || '').length,
    content: richTextToPlainText(formData.content || '').length,
  };

  return (
    <div className="ordinance-form-wrapper">
      <form onSubmit={handleSubmit} className="ordinance-form-container">
        <div className="form-header">
          <div className="form-title-section">
            <h3>📋 {ordinanceId ? 'Edit Ordinance' : 'Submit New Ordinance'}</h3>
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
          <RichTextEditor
            id="description"
            placeholder="Provide a brief description of the ordinance..."
            value={formData.description}
            onChange={(value) => handleRichTextChange('description', value)}
            disabled={loading}
            ariaInvalid={!!formErrors.description}
            ariaDescribedBy={formErrors.description ? 'description-error' : 'description-hint'}
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
          <RichTextEditor
            id="content"
            placeholder="Enter the complete text of the ordinance. Include sections, subsections, and all relevant details..."
            value={formData.content}
            onChange={(value) => handleRichTextChange('content', value)}
            disabled={loading}
            ariaInvalid={!!formErrors.content}
            ariaDescribedBy={formErrors.content ? 'content-error' : 'content-hint'}
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
                📤 {ordinanceId ? 'Update Ordinance' : 'Submit Ordinance'}
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
          <div>
            <strong>📝 Tips:</strong>
            <ul>
              <li>Be clear and concise in your title</li>
              <li>Provide sufficient detail in the content</li>
              <li>All fields with * are required</li>
              <li>
                {autoSubmitAfterCreate
                  ? 'Your submission will be sent to Proposed Measures right away'
                  : 'Your submission will be saved as Draft initially'}
              </li>
            </ul>
          </div>
        </div>
      </form>
    </div>
  );
}