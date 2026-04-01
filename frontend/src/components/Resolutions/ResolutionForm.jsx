import { useEffect, useState } from 'react';
import api from '../../api/api';
import RichTextEditor from '../common/RichTextEditor';
import { richTextToPlainText, hasMeaningfulRichText, sanitizeRichText } from '../../utils/richText';
import '../../styles/ResolutionForm.css';

function attachmentsToText(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'string') return value;
  return '';
}

function normalizeFormData(data) {
  const source = data || {};
  const coAuthors = Array.isArray(source.co_authors)
    ? source.co_authors.map((id) => String(id))
    : typeof source.co_authors === 'string' && source.co_authors.trim()
      ? source.co_authors.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

  return {
    title: source.title || '',
    resolution_number: source.resolution_number || '',
    description: source.description || '',
    content: source.content || '',
    co_authors: coAuthors,
    whereas_clauses: source.whereas_clauses || '',
    effectivity_clause: source.effectivity_clause || '',
    attachments_text: attachmentsToText(source.attachments),
    remarks: source.remarks || '',
  };
}

function parseAttachments(textValue) {
  return String(textValue || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isCouncilorUser(user) {
  const roleName = String(user?.role_name || user?.role || '').toLowerCase();
  if (roleName) return roleName === 'councilor';
  return Number(user?.role_id) === 3;
}

export default function ResolutionForm({
  onSuccess,
  onCancel,
  resolutionId = null,
  initialData = null,
  initialStatusOnCreate = 'Draft',
}) {
  const [formData, setFormData] = useState(
    normalizeFormData(initialData)
  );

  const [loading, setLoading] = useState(false);
  const [councilorUsers, setCouncilorUsers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    const fetchCouncilors = async () => {
      try {
        const res = await api.get('/users');
        const allUsers = res.data || [];
        setCouncilorUsers(allUsers.filter(isCouncilorUser));
      } catch {
        setCouncilorUsers([]);
      }
    };

    fetchCouncilors();
  }, []);

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

    if (!Array.isArray(formData.co_authors) || formData.co_authors.length === 0) {
      newErrors.co_authors = 'Co-authors / sponsors are required';
    }

    if (!hasMeaningfulRichText(formData.whereas_clauses)) {
      newErrors.whereas_clauses = 'Whereas clauses are required';
    }

    if (!hasMeaningfulRichText(formData.effectivity_clause)) {
      newErrors.effectivity_clause = 'Effectivity clause is required';
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

  const handleCoAuthorsChange = (e) => {
    const selectedIds = Array.from(e.target.selectedOptions).map((option) => option.value);
    setFormData((prev) => ({
      ...prev,
      co_authors: selectedIds,
    }));

    if (formErrors.co_authors) {
      setFormErrors((prev) => ({
        ...prev,
        co_authors: '',
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
        description: sanitizeRichText(formData.description || ''),
        content: sanitizeRichText(formData.content || ''),
        co_authors: formData.co_authors.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0),
        whereas_clauses: sanitizeRichText(formData.whereas_clauses || ''),
        effectivity_clause: sanitizeRichText(formData.effectivity_clause || ''),
        attachments: parseAttachments(formData.attachments_text),
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
        ...normalizeFormData(),
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
    setFormData(normalizeFormData());
    setFormErrors({});
    setError('');
    setSuccess('');
  };

  const characterCount = {
    title: formData.title.length,
    description: richTextToPlainText(formData.description || '').length,
    content: richTextToPlainText(formData.content || '').length,
    whereas: richTextToPlainText(formData.whereas_clauses || '').length,
    effectivity: richTextToPlainText(formData.effectivity_clause || '').length,
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

          <div className="form-group">
            <label htmlFor="co_authors">
              Co-authors / Sponsors <span className="required">*</span>
            </label>
            <select
              id="co_authors"
              name="co_authors"
              multiple
              value={formData.co_authors}
              onChange={handleCoAuthorsChange}
              className={formErrors.co_authors ? 'input-error' : ''}
              size={Math.min(Math.max(councilorUsers.length, 4), 8)}
              required
            >
              {councilorUsers.map((councilor) => (
                <option key={councilor.id} value={String(councilor.id)}>
                  {councilor.name}
                </option>
              ))}
            </select>
            <p className="field-helper">Hold Ctrl (or Cmd) to select multiple councilors.</p>
            {formErrors.co_authors && (
              <div className="field-hint">
                <span className="error-text">{formErrors.co_authors}</span>
              </div>
            )}
          </div>

          {/* Description Field */}
          <div className="form-group">
            <label htmlFor="description">
              Description <span className="required">*</span>
            </label>
            <RichTextEditor
              id="description"
              placeholder="Brief description of the resolution"
              value={formData.description}
              onChange={(value) => handleRichTextChange('description', value)}
              disabled={loading}
              ariaInvalid={!!formErrors.description}
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
            <RichTextEditor
              id="content"
              placeholder="Complete resolution text..."
              value={formData.content}
              onChange={(value) => handleRichTextChange('content', value)}
              disabled={loading}
              ariaInvalid={!!formErrors.content}
            />
            <div className="field-hint">
              {formErrors.content ? (
                <span className="error-text">{formErrors.content}</span>
              ) : (
                <span className="char-count">{characterCount.content} characters</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="whereas_clauses">
              Whereas Clauses <span className="required">*</span>
            </label>
            <RichTextEditor
              id="whereas_clauses"
              placeholder="Background, rationale, and legal basis..."
              value={formData.whereas_clauses}
              onChange={(value) => handleRichTextChange('whereas_clauses', value)}
              disabled={loading}
              ariaInvalid={!!formErrors.whereas_clauses}
            />
            <div className="field-hint">
              {formErrors.whereas_clauses ? (
                <span className="error-text">{formErrors.whereas_clauses}</span>
              ) : (
                <span className="char-count">{characterCount.whereas} characters</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="effectivity_clause">
              Effectivity Clause <span className="required">*</span>
            </label>
            <RichTextEditor
              id="effectivity_clause"
              placeholder="State when this measure takes effect..."
              value={formData.effectivity_clause}
              onChange={(value) => handleRichTextChange('effectivity_clause', value)}
              disabled={loading}
              ariaInvalid={!!formErrors.effectivity_clause}
            />
            <div className="field-hint">
              {formErrors.effectivity_clause ? (
                <span className="error-text">{formErrors.effectivity_clause}</span>
              ) : (
                <span className="char-count">{characterCount.effectivity} characters</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="attachments_text">Attachments (Optional)</label>
            <textarea
              id="attachments_text"
              name="attachments_text"
              placeholder="One supporting document/link per line"
              value={formData.attachments_text}
              onChange={handleChange}
              rows="3"
            />
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