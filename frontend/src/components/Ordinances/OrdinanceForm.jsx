import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import api from '../../api/api';
import RichTextEditor from '../common/RichTextEditor';
import { richTextToPlainText, hasMeaningfulRichText, sanitizeRichText } from '../../utils/richText';
import "../../styles/OrdinanceForm.css";

function attachmentsToText(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'string') return value;
  return '';
}

function normalizeCoAuthors(value) {
  if (Array.isArray(value)) {
    return value
      .map((author) => {
        if (author && typeof author === 'object') {
          return author.id != null ? String(author.id) : '';
        }
        return String(author);
      })
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((id) => id.trim()).filter(Boolean);
  }

  return [];
}

function normalizeFormData(data) {
  const source = data || {};
  const coAuthors = normalizeCoAuthors(source.co_authors);

  return {
    title: source.title || '',
    ordinance_number: source.ordinance_number || '',
    description: source.description || '',
    content: source.content || '',
    co_authors: coAuthors,
    attachments_text: attachmentsToText(source.attachments),
    attachments_files: [],
    remarks: source.remarks || '',
  };
}
// Handle file uploads for attachments
function handleFileUpload(e, setFormData, setFormErrors) {
  const files = Array.from(e.target.files);
  setFormData((prev) => ({
    ...prev,
    attachments_files: [...prev.attachments_files, ...files],
  }));
  if (setFormErrors) {
    setFormErrors((prev) => ({ ...prev, attachments_files: '' }));
  }
}

// Remove a selected file before submit
function handleRemoveFile(idx, setFormData) {
  setFormData((prev) => ({
    ...prev,
    attachments_files: prev.attachments_files.filter((_, i) => i !== idx),
  }));
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

    // Removed whereas_clauses and effectivity_clause validation

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

  // Dual-list add/remove co-authors
  const availableCouncilors = councilorUsers.filter(
    (u) => !formData.co_authors.includes(String(u.id))
  );
  const selectedAuthors = councilorUsers.filter((u) => formData.co_authors.includes(String(u.id)));

  const handleAddAuthor = (id) => {
    setFormData((prev) => ({
      ...prev,
      co_authors: [...prev.co_authors, String(id)],
    }));
    if (formErrors.co_authors) {
      setFormErrors((prev) => ({ ...prev, co_authors: '' }));
    }
  };

  const handleRemoveAuthor = (id) => {
    setFormData((prev) => ({
      ...prev,
      co_authors: prev.co_authors.filter((aid) => aid !== String(id)),
    }));
    if (formErrors.co_authors) {
      setFormErrors((prev) => ({ ...prev, co_authors: '' }));
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
      const formPayload = new FormData();
      formPayload.append('title', formData.title.trim());
      formPayload.append('ordinance_number', formData.ordinance_number.trim() || '');
      formPayload.append('description', sanitizeRichText(formData.description || ''));
      formPayload.append('content', sanitizeRichText(formData.content || ''));
      formPayload.append('remarks', formData.remarks.trim() || '');
      formData.co_authors.forEach((id) => formPayload.append('co_authors[]', id));
      parseAttachments(formData.attachments_text).forEach((att) => formPayload.append('attachments[]', att));
      if (formData.attachments_files && formData.attachments_files.length > 0) {
        formData.attachments_files.forEach((file) => formPayload.append('attachments_files', file));
      }

      let successMsg;
      if (ordinanceId) {
        await api.put(`/ordinances/${ordinanceId}`, formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        successMsg = 'Ordinance updated successfully!';
      } else {
        formPayload.append('status', autoSubmitAfterCreate ? 'Submitted' : initialStatusOnCreate);
        const res = await api.post('/ordinances', formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (autoSubmitAfterCreate) {
          successMsg = 'Ordinance submitted successfully!';
        } else {
          successMsg = res.data?.message || 'Ordinance saved as draft successfully!';
        }
      }

      setSuccess(successMsg);
      if (!ordinanceId) {
        setFormData({ ...normalizeFormData() });
      }
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
    setFormData(normalizeFormData());
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

        <div className="form-group">
          <label>Co-authors / Sponsors (Optional)</label>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Available Councilors</div>
              <ul style={{ minHeight: 80, border: '1px solid #eee', borderRadius: 4, padding: 8, margin: 0, listStyle: 'none', background: '#fafbfc' }}>
                {availableCouncilors.length === 0 && <li style={{ color: '#aaa' }}>No more to add</li>}
                {availableCouncilors.map((c) => (
                  <li key={c.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <button type="button" className="btn-mini" style={{ marginLeft: 8 }} onClick={() => handleAddAuthor(c.id)} disabled={loading}>Add</button>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>Selected Authors</div>
              <ul style={{ minHeight: 80, border: '1px solid #eee', borderRadius: 4, padding: 8, margin: 0, listStyle: 'none', background: '#f6f8fa' }}>
                {selectedAuthors.length === 0 && <li style={{ color: '#aaa' }}>None selected</li>}
                {selectedAuthors.map((c) => (
                  <li key={c.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <button type="button" className="btn-mini btn-danger" style={{ marginLeft: 8 }} onClick={() => handleRemoveAuthor(c.id)} disabled={loading}>Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="form-hint">Add or remove councilors as co-authors. Leave empty if none.</div>
          {formErrors.co_authors && (
            <span className="error-text">{formErrors.co_authors}</span>
          )}
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

        {/* Removed whereas_clauses and effectivity_clause fields */}

        <div className="form-group">
          <label htmlFor="attachments_text">Attachments (Optional)</label>
          <textarea
            id="attachments_text"
            name="attachments_text"
            placeholder="One supporting document/link per line"
            value={formData.attachments_text}
            onChange={handleChange}
            disabled={loading}
            rows="3"
          />
          <div style={{ marginTop: 8 }}>
            <input
              id="attachments_files"
              type="file"
              multiple
              onChange={(e) => handleFileUpload(e, setFormData, setFormErrors)}
              className="file-input"
              disabled={loading}
            />
            <div className="form-hint">You may select multiple files to attach. Supported formats: PDF, DOCX, images, etc.</div>
            {formData.attachments_files && formData.attachments_files.length > 0 && (
              <ul style={{ margin: '8px 0 0 0', padding: 0, listStyle: 'none', fontSize: '0.95em' }}>
                {formData.attachments_files.map((file, idx) => (
                  <li key={idx} style={{ color: '#333', display: 'flex', alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>{file.name}</span>
                    <button
                      type="button"
                      className="btn-mini btn-danger"
                      style={{ marginLeft: 8 }}
                      onClick={() => handleRemoveFile(idx, setFormData)}
                      aria-label={`Remove ${file.name}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {formErrors.attachments_files && (
              <span className="error-text">{formErrors.attachments_files}</span>
            )}
          </div>
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