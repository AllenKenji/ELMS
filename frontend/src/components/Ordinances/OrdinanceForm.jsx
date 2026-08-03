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
    proposer_id: source.proposer_id != null ? String(source.proposer_id) : '',
    title: source.title || '',
    ordinance_number: source.ordinance_number || '',
    description: source.description || '',
    content: source.content || '',
    co_authors: coAuthors,
    attachments_text: attachmentsToText(source.attachments),
    attachments_files: [],
    remarks: source.remarks || '',
    is_legacy_import: false,
    auto_post_publicly: false,
    posting_duration_days: '3',
    posting_location: '',
    posting_notes: '',
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

function hasSameFileIdentity(a, b) {
  if (!a || !b) return false;
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function isCouncilorUser(user) {
  const roleName = String(user?.role_name || user?.role || '').toLowerCase();
  if (roleName) return roleName === 'councilor';
  return Number(user?.role_id) === 3;
}

function canAssignPrimaryAuthor(user) {
  const roleName = String(user?.role_name || user?.role || '').trim().toLowerCase();
  return roleName === 'admin' || roleName === 'secretary' || roleName === 'committee secretary';
}

function canBypassWorkflowForLegacy(user) {
  const roleName = String(user?.role_name || user?.role || '').trim().toLowerCase();
  return roleName === 'admin' || roleName === 'secretary' || roleName === 'committee secretary';
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
  const userCanAssignPrimaryAuthor = canAssignPrimaryAuthor(user);
  const canBypassLegacyWorkflow = canBypassWorkflowForLegacy(user);
  const effectivePrimaryAuthorId = String(
    userCanAssignPrimaryAuthor ? formData.proposer_id : user?.id || ''
  );

  const [formData, setFormData] = useState(
    normalizeFormData(initialData)
  );

  const [loading, setLoading] = useState(false);
  const [councilorUsers, setCouncilorUsers] = useState([]);
  const [templateOptions, setTemplateOptions] = useState([]);
  const [recentTemplates, setRecentTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [templateSort, setTemplateSort] = useState('favorites');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [scanFile, setScanFile] = useState(null);
  const [scanningDocument, setScanningDocument] = useState(false);
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

  useEffect(() => {
    setFormData(normalizeFormData(initialData));
  }, [initialData]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        setLoadingTemplates(true);
        const res = await api.get('/templates/ordinance', {
          params: {
            favoritesOnly,
            limit: 100,
          },
        });
        const items = (res.data || [])
          .filter((item) => Number(item.id) !== Number(ordinanceId))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setTemplateOptions(items);
      } catch {
        setTemplateOptions([]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, [ordinanceId, favoritesOnly]);

  useEffect(() => {
    const fetchRecentTemplates = async () => {
      try {
        const res = await api.get('/templates/ordinance/history', {
          params: {
            limit: 6,
          },
        });
        const items = (res.data || []).filter((item) => Number(item.id) !== Number(ordinanceId));
        setRecentTemplates(items);
      } catch {
        setRecentTemplates([]);
      }
    };

    fetchRecentTemplates();
  }, [ordinanceId]);

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;

    const hasCurrentContent =
      formData.title.trim() ||
      hasMeaningfulRichText(formData.description) ||
      hasMeaningfulRichText(formData.content) ||
      formData.co_authors.length > 0 ||
      formData.attachments_text.trim() ||
      formData.remarks.trim();

    if (hasCurrentContent && !window.confirm('Replace current form data with the selected template?')) {
      return;
    }

    try {
      setApplyingTemplate(true);
      setError('');
      setSuccess('');
      const res = await api.get(`/ordinances/${selectedTemplateId}`);
      const templateData = normalizeFormData(res.data);

      setFormData({
        ...templateData,
        ordinance_number: '',
        attachments_files: [],
      });
      await api.post(`/templates/ordinance/${selectedTemplateId}/use`);
      setFormErrors({});
      setSuccess('Template loaded. Update any details, then submit as a new ordinance.');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to load selected template.';
      setError(msg);
    } finally {
      setApplyingTemplate(false);
    }
  };

  const selectedTemplate = templateOptions.find((item) => String(item.id) === String(selectedTemplateId));
  const recentTemplateIds = new Set(recentTemplates.map((item) => String(item.id)));

  const sortedTemplateOptions = [...templateOptions].sort((a, b) => {
    if (templateSort === 'used') {
      const usedDiff = Number(b.used_count || 0) - Number(a.used_count || 0);
      if (usedDiff !== 0) return usedDiff;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }

    if (templateSort === 'recent') {
      const recentA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const recentB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      if (recentB !== recentA) return recentB - recentA;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }

    const favDiff = Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite));
    if (favDiff !== 0) return favDiff;
    const recentA = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
    const recentB = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
    if (recentB !== recentA) return recentB - recentA;
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  const handleToggleFavorite = async () => {
    if (!selectedTemplateId) return;

    try {
      setSavingFavorite(true);
      const nextValue = !(selectedTemplate?.is_favorite);
      await api.post(`/templates/ordinance/${selectedTemplateId}/favorite`, {
        is_favorite: nextValue,
      });

      setTemplateOptions((prev) => prev.map((item) => (
        String(item.id) === String(selectedTemplateId)
          ? { ...item, is_favorite: nextValue }
          : item
      )));

      setRecentTemplates((prev) => prev.map((item) => (
        String(item.id) === String(selectedTemplateId)
          ? { ...item, is_favorite: nextValue }
          : item
      )));
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to update favorite template.';
      setError(msg);
    } finally {
      setSavingFavorite(false);
    }
  };

  const handleScanDocument = async () => {
    if (!scanFile) return;

    try {
      setScanningDocument(true);
      setError('');
      setSuccess('');

      const payload = new FormData();
      payload.append('document', scanFile);

      const res = await api.post('/templates/ordinance/scan', payload, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const suggestion = res?.data?.suggestion || {};
      const rawText = String(res?.data?.raw_text || '').trim();

      const fallbackLines = rawText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const fallbackTitle = fallbackLines[0] || '';
      const fallbackDescription = fallbackLines.slice(1, 6).join(' ').slice(0, 700);
      const nextContent = suggestion.content || rawText;

      if (!nextContent) {
        setError('No readable text found. Try a clearer image or export the PDF as text-based PDF.');
        return;
      }

      setFormData((prev) => {
        const hasScanAlreadyAttached = Array.isArray(prev.attachments_files)
          && prev.attachments_files.some((file) => hasSameFileIdentity(file, scanFile));

        return {
          ...prev,
          title: suggestion.title || fallbackTitle || prev.title,
          ordinance_number: '',
          description: suggestion.description || fallbackDescription || prev.description,
          content: nextContent || prev.content,
          remarks: suggestion.remarks || prev.remarks,
          attachments_files: hasScanAlreadyAttached
            ? prev.attachments_files
            : [...prev.attachments_files, scanFile],
        };
      });
      setFormErrors({});
      setSuccess('Document scanned and attached as reference. Review and edit the extracted text before submitting.');
    } catch (err) {
      const msg = err?.message || err?.response?.data?.error || 'Failed to scan document.';
      setError(msg);
    } finally {
      setScanningDocument(false);
    }
  };

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

    if (userCanAssignPrimaryAuthor && !String(formData.proposer_id || '').trim()) {
      newErrors.proposer_id = 'Primary author is required';
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
  const normalizedCoAuthorIds = formData.co_authors.filter((id) => id !== effectivePrimaryAuthorId);

  const availableCouncilors = councilorUsers.filter(
    (u) => !normalizedCoAuthorIds.includes(String(u.id)) && String(u.id) !== effectivePrimaryAuthorId
  );
  const selectedAuthors = councilorUsers.filter(
    (u) => normalizedCoAuthorIds.includes(String(u.id)) && String(u.id) !== effectivePrimaryAuthorId
  );

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
      if (userCanAssignPrimaryAuthor && formData.proposer_id) {
        formPayload.append('proposer_id', formData.proposer_id);
      }

      if (!ordinanceId && canBypassLegacyWorkflow && formData.is_legacy_import) {
        formPayload.append('is_legacy_import', 'true');
        formPayload.append('auto_post_publicly', formData.auto_post_publicly ? 'true' : 'false');
        formPayload.append('posting_duration_days', String(formData.posting_duration_days || '3'));
        formPayload.append('posting_location', String(formData.posting_location || '').trim());
        formPayload.append('posting_notes', String(formData.posting_notes || '').trim());
      }

      normalizedCoAuthorIds.forEach((id) => formPayload.append('co_authors[]', id));
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
  const selectedPrimaryAuthor = councilorUsers.find((u) => String(u.id) === effectivePrimaryAuthorId);

  return (
    <div className="ordinance-form-wrapper">
      <form onSubmit={handleSubmit} className="ordinance-form-container">
        <div className="form-header">
          <div className="form-title-section">
            <h3>📋 {ordinanceId ? 'Edit Ordinance' : 'Submit New Ordinance'}</h3>
            <p className="form-subtitle">
              Proposed by: <strong>{selectedPrimaryAuthor?.name || user?.name || 'Unknown'}</strong>
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

        {!ordinanceId && (
          <div className="form-group">
            <label htmlFor="ordinance_template">Use Existing Ordinance as Pattern (Optional)</label>
            <div className="template-toolbar">
              <label className="template-toolbar-item">
                <input
                  type="checkbox"
                  checked={favoritesOnly}
                  onChange={(e) => setFavoritesOnly(e.target.checked)}
                  disabled={loading || loadingTemplates || applyingTemplate}
                />
                Favorites only
              </label>
              <label className="template-toolbar-item">
                Sort by
                <select
                  value={templateSort}
                  onChange={(e) => setTemplateSort(e.target.value)}
                  disabled={loading || loadingTemplates || applyingTemplate}
                >
                  <option value="favorites">Favorites First</option>
                  <option value="used">Most Used</option>
                  <option value="recent">Recently Used</option>
                </select>
              </label>
            </div>
            <select
              id="ordinance_template"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={loading || loadingTemplates || applyingTemplate}
            >
              <option value="">
                {loadingTemplates ? 'Loading old ordinances...' : 'Select an existing ordinance'}
              </option>
              {sortedTemplateOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.is_favorite ? '★ ' : ''}${item.measure_number || 'No Number'} - ${item.title} (${item.used_count || 0}x)`}
                </option>
              ))}
            </select>
            <div className="template-legend" aria-label="Template legend">
              <span className="template-legend-item">★ Favorites</span>
              <span className="template-legend-item">📊 Usage</span>
              <span className="template-legend-item">🕒 Recent</span>
            </div>
            {selectedTemplate && (
              <div className="template-summary-row">
                <span className="template-summary-item">
                  <span className="template-summary-icon">📄</span>
                  <strong>{selectedTemplate.measure_number || 'No Number'}</strong>
                </span>
                {selectedTemplate.is_favorite && <span className="template-pill template-pill-favorite">★ Favorite</span>}
                {Number(selectedTemplate.used_count || 0) > 0 && (
                  <span className="template-pill template-pill-used">📊 Used {selectedTemplate.used_count} times</span>
                )}
                {recentTemplateIds.has(String(selectedTemplate.id)) && (
                  <span className="template-pill template-pill-recent">🕒 Recently used</span>
                )}
              </div>
            )}
            {recentTemplates.length > 0 && (
              <div className="template-recent-wrap">
                <div className="form-hint">Recent patterns:</div>
                <div className="template-recent-list">
                  {recentTemplates.map((item) => (
                    <button
                      key={`recent-${item.id}`}
                      type="button"
                      className="template-recent-chip"
                      onClick={() => setSelectedTemplateId(String(item.id))}
                      disabled={loading || loadingTemplates || applyingTemplate}
                    >
                      <span>{item.is_favorite ? '★' : '🧩'}</span>
                      <span>{item.measure_number || 'No Number'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="form-hint">Copies title, description, content, co-authors, and attachment links from an old ordinance.</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-reset"
                onClick={handleApplyTemplate}
                disabled={!selectedTemplateId || loading || loadingTemplates || applyingTemplate}
              >
                {applyingTemplate ? 'Loading Template...' : 'Apply Pattern'}
              </button>
              <button
                type="button"
                className="btn-reset"
                onClick={handleToggleFavorite}
                disabled={!selectedTemplateId || savingFavorite || loadingTemplates}
              >
                {savingFavorite
                  ? 'Saving...'
                  : (selectedTemplate?.is_favorite ? 'Unfavorite Pattern' : 'Favorite Pattern')}
              </button>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="ocr_document">Scan Old PDF/Image (OCR Import)</label>
          <input
            id="ocr_document"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
            onChange={(e) => setScanFile(e.target.files?.[0] || null)}
            disabled={loading || scanningDocument}
          />
          <div className="form-hint">Upload an old ordinance document to auto-fill title, description, and content.</div>
          <button
            type="button"
            className="btn-reset"
            onClick={handleScanDocument}
            disabled={!scanFile || loading || scanningDocument}
            style={{ marginTop: 8 }}
          >
            {scanningDocument ? 'Scanning...' : 'Scan and Fill Form'}
          </button>
        </div>

        {userCanAssignPrimaryAuthor && (
          <div className="form-group">
            <label htmlFor="proposer_id">Primary Author / Proponent *</label>
            <select
              id="proposer_id"
              name="proposer_id"
              value={formData.proposer_id}
              onChange={handleChange}
              disabled={loading}
            >
              <option value="">Select a councilor author</option>
              {councilorUsers.map((councilor) => (
                <option key={councilor.id} value={String(councilor.id)}>
                  {councilor.name}
                </option>
              ))}
            </select>
            <div className="form-hint">Use this when encoding/scanning on behalf of the actual councilor author.</div>
            {formErrors.proposer_id && (
              <span className="error-text">{formErrors.proposer_id}</span>
            )}
          </div>
        )}

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

        {!ordinanceId && canBypassLegacyWorkflow && (
          <div className="form-group">
            <label>Legacy Publication (Skip Workflow)</label>
            <label className="template-toolbar-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={Boolean(formData.is_legacy_import)}
                disabled={loading}
                onChange={(e) => {
                  const { checked } = e.target;
                  setFormData((prev) => ({
                    ...prev,
                    is_legacy_import: checked,
                    auto_post_publicly: checked ? prev.auto_post_publicly : false,
                  }));
                }}
              />
              This is a legacy ordinance already implemented (digitization upload)
            </label>

            {formData.is_legacy_import && (
              <>
                <label className="template-toolbar-item" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(formData.auto_post_publicly)}
                    disabled={loading}
                    onChange={(e) => {
                      const { checked } = e.target;
                      setFormData((prev) => ({
                        ...prev,
                        auto_post_publicly: checked,
                      }));
                    }}
                  />
                  Auto post publicly after submit
                </label>

                {formData.auto_post_publicly && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      placeholder="Posting duration (days)"
                      value={formData.posting_duration_days}
                      disabled={loading}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        posting_duration_days: e.target.value,
                      }))}
                    />
                    <input
                      type="text"
                      placeholder="Posting location (optional)"
                      value={formData.posting_location}
                      disabled={loading}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        posting_location: e.target.value,
                      }))}
                    />
                    <textarea
                      rows="2"
                      placeholder="Posting notes (optional)"
                      value={formData.posting_notes}
                      disabled={loading}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        posting_notes: e.target.value,
                      }))}
                    />
                  </div>
                )}
              </>
            )}

            <div className="form-hint">Use only for old ordinances that are already approved/implemented and need public online visibility.</div>
          </div>
        )}

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