import { useState } from 'react';
import '../../styles/Minutes.css';

export default function MinutesForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    meeting_date: '',
    participants: '',
    transcript: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 3) {
      errors.title = 'Title must be at least 3 characters';
    }
    if (!formData.transcript.trim()) {
      errors.transcript = 'Transcript is required';
    } else if (formData.transcript.trim().length < 20) {
      errors.transcript = 'Transcript must be at least 20 characters';
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFormData((prev) => ({ ...prev, transcript: evt.target.result }));
      if (formErrors.transcript) {
        setFormErrors((prev) => ({ ...prev, transcript: '' }));
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setSubmitError('');
    try {
      const payload = {
        title: formData.title.trim(),
        meeting_date: formData.meeting_date || undefined,
        participants: formData.participants.trim() || undefined,
        transcript: formData.transcript.trim(),
      };
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save transcript');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="minutes-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <h3>🤖 New Meeting Minutes</h3>
        <p className="form-subtitle">
          Upload or paste a meeting transcript to generate AI-powered minutes
        </p>
      </div>

      {submitError && <div className="alert alert-error">⚠️ {submitError}</div>}

      {/* Title */}
      <div className="form-group">
        <label htmlFor="minutes-title">
          Title <span className="required">*</span>
        </label>
        <input
          id="minutes-title"
          type="text"
          name="title"
          placeholder="e.g., City Council Meeting – March 2025"
          value={formData.title}
          onChange={handleChange}
          className={formErrors.title ? 'input-error' : ''}
          maxLength={255}
          disabled={loading}
        />
        {formErrors.title && (
          <span className="field-error">{formErrors.title}</span>
        )}
        <span className="char-count">{formData.title.length}/255</span>
      </div>

      {/* Meeting Date */}
      <div className="form-group">
        <label htmlFor="minutes-date">Meeting Date</label>
        <input
          id="minutes-date"
          type="date"
          name="meeting_date"
          value={formData.meeting_date}
          onChange={handleChange}
          disabled={loading}
        />
      </div>

      {/* Participants */}
      <div className="form-group">
        <label htmlFor="minutes-participants">Participants</label>
        <input
          id="minutes-participants"
          type="text"
          name="participants"
          placeholder="e.g., Mayor Smith, Councilor Reyes, Secretary Cruz…"
          value={formData.participants}
          onChange={handleChange}
          maxLength={500}
          disabled={loading}
        />
        <span className="char-count">{formData.participants.length}/500</span>
      </div>

      {/* Transcript Upload */}
      <div className="form-group">
        <label htmlFor="minutes-file">Upload Transcript File</label>
        <input
          id="minutes-file"
          type="file"
          accept=".txt,.md,.csv"
          onChange={handleFileUpload}
          className="file-input"
          disabled={loading}
        />
        <p className="field-hint">Supported formats: .txt, .md, .csv</p>
      </div>

      {/* Transcript Text Area */}
      <div className="form-group">
        <label htmlFor="minutes-transcript">
          Transcript <span className="required">*</span>
        </label>
        <textarea
          id="minutes-transcript"
          name="transcript"
          placeholder="Paste the meeting transcript here, or upload a file above…"
          value={formData.transcript}
          onChange={handleChange}
          rows={10}
          className={formErrors.transcript ? 'input-error' : ''}
          disabled={loading}
        />
        {formErrors.transcript && (
          <span className="field-error">{formErrors.transcript}</span>
        )}
        <span className="char-count">{formData.transcript.length} characters</span>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Saving…' : '💾 Save Transcript'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
