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
    resolution_number: source.resolution_number || '',
    description: source.description || '',
    content: source.content || '',
    co_authors: coAuthors,
    attachments_text: attachmentsToText(source.attachments),
    attachments_files: [],
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

function handleFileUpload(e, setFormData) {
  const files = Array.from(e.target.files);
  setFormData((prev) => ({
    ...prev,
    attachments_files: [...prev.attachments_files, ...files],
  }));
}

function handleRemoveFile(idx, setFormData) {
  setFormData((prev) => ({
    ...prev,
    attachments_files: prev.attachments_files.filter((_, i) => i !== idx),
  }));
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
      formPayload.append('resolution_number', formData.resolution_number.trim() || '');
      formPayload.append('description', sanitizeRichText(formData.description || ''));
      formPayload.append('content', sanitizeRichText(formData.content || ''));
      formPayload.append('remarks', formData.remarks.trim() || '');
      formPayload.append('status', initialStatusOnCreate);
      formData.co_authors.forEach((id) => formPayload.append('co_authors[]', id));
      parseAttachments(formData.attachments_text).forEach((att) => formPayload.append('attachments[]', att));
      if (formData.attachments_files && formData.attachments_files.length > 0) {
        formData.attachments_files.forEach((file) => formPayload.append('attachments_files', file));
      }

      if (resolutionId) {
        await api.put(`/resolutions/${resolutionId}`, formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setSuccess('Resolution updated successfully!');
      } else {
        await api.post('/resolutions', formPayload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
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
            <p className="field-helper">Add or remove councilors as co-authors. Leave empty if none.</p>
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
            <label htmlFor="attachments_text">Attachments (Optional)</label>
            <textarea
              id="attachments_text"
              name="attachments_text"
              placeholder="One supporting document/link per line"
              value={formData.attachments_text}
              onChange={handleChange}
              rows="3"
            />
            <div style={{ marginTop: 8 }}>
              <input
                id="attachments_files"
                type="file"
                multiple
                onChange={(e) => handleFileUpload(e, setFormData)}
                className="file-input"
                disabled={loading}
              />
              <p className="field-helper">You may select multiple files to attach. Supported formats: PDF, DOCX, images, etc.</p>
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