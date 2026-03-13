import { useState } from 'react';
import '../../styles/Reports.css';

const REPORT_TYPES = [
  { value: 'all', label: 'All Legislative (Ordinances + Resolutions + Sessions)' },
  { value: 'ordinances', label: 'Ordinances Only' },
  { value: 'resolutions', label: 'Resolutions Only' },
  { value: 'sessions', label: 'Sessions Only' },
];

export default function ReportForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    report_type: 'all',
    date_range_start: '',
    date_range_end: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      errors.title = 'Title must be at least 5 characters';
    }
    if (
      formData.date_range_start &&
      formData.date_range_end &&
      formData.date_range_end < formData.date_range_start
    ) {
      errors.date_range_end = 'End date must be after start date';
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
    if (!validate()) return;

    setLoading(true);
    setSubmitError('');
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        report_type: formData.report_type,
        date_range_start: formData.date_range_start || undefined,
        date_range_end: formData.date_range_end || undefined,
      };
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <h3>📊 Generate New Report</h3>
        <p className="form-subtitle">
          Aggregate legislative data into a downloadable report
        </p>
      </div>

      {submitError && <div className="alert alert-error">⚠️ {submitError}</div>}

      {/* Title */}
      <div className="form-group">
        <label htmlFor="report-title">
          Report Title <span className="required">*</span>
        </label>
        <input
          id="report-title"
          type="text"
          name="title"
          placeholder="e.g., Q1 2025 Legislative Report"
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

      {/* Description */}
      <div className="form-group">
        <label htmlFor="report-description">Description</label>
        <textarea
          id="report-description"
          name="description"
          placeholder="Optional description of this report…"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          maxLength={1000}
          disabled={loading}
        />
        <span className="char-count">{formData.description.length}/1000</span>
      </div>

      {/* Report Type */}
      <div className="form-group">
        <label htmlFor="report-type">Report Type</label>
        <select
          id="report-type"
          name="report_type"
          value={formData.report_type}
          onChange={handleChange}
          disabled={loading}
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Date Range */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date-start">Date Range Start</label>
          <input
            id="date-start"
            type="date"
            name="date_range_start"
            value={formData.date_range_start}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label htmlFor="date-end">Date Range End</label>
          <input
            id="date-end"
            type="date"
            name="date_range_end"
            value={formData.date_range_end}
            onChange={handleChange}
            className={formErrors.date_range_end ? 'input-error' : ''}
            disabled={loading}
          />
          {formErrors.date_range_end && (
            <span className="field-error">{formErrors.date_range_end}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="form-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Generating…' : '📊 Generate Report'}
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
