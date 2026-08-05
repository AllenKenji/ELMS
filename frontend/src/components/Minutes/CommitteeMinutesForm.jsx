import { useState } from 'react';
import '../../styles/Minutes.css';

function normalizeAttendees(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          return {
            user_id: item.user_id ?? item.id ?? item.member_id ?? null,
            name: item.name || item.full_name || item.user_name || item.label || 'Unknown attendee',
            role: item.role || '',
          };
        }

        return {
          user_id: item,
          name: String(item),
          role: '',
        };
      })
      .filter((item) => item.user_id !== null && item.user_id !== undefined);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function normalizeDateInputValue(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  return raw.slice(0, 10);
}

export default function CommitteeMinutesForm({ onSubmit, onCancel, initialData, committeeMembers = [] }) {
  const initialAttendees = normalizeAttendees(initialData?.attendees_json || initialData?.attendees);
  const totalMembers = Array.isArray(committeeMembers) ? committeeMembers.length : 0;
  const defaultQuorumRequired = totalMembers > 0 ? Math.ceil(totalMembers / 2) : 0;
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    meeting_date: normalizeDateInputValue(initialData?.meeting_date),
    participants: initialData?.participants || '',
    transcript: initialData?.transcript || '',
    attendees: initialAttendees,
    quorum_required: initialData?.quorum_required ?? defaultQuorumRequired,
  });
  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const quorumPresent = formData.attendees.length;
  const quorumRequired = Number(formData.quorum_required || 0);
  const quorumMet = quorumRequired > 0 ? quorumPresent >= quorumRequired : false;

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

  const toggleAttendee = (memberLabel) => {
    setFormData((prev) => {
      const selected = prev.attendees.some((item) => String(item.user_id) === String(memberLabel.user_id))
        ? prev.attendees.filter((item) => String(item.user_id) !== String(memberLabel.user_id))
        : [...prev.attendees, memberLabel];
      return { ...prev, attendees: selected };
    });
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
        attendees: formData.attendees,
        quorum_required: quorumRequired || undefined,
        quorum_present: quorumPresent,
        quorum_met: quorumMet,
      };
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err.message || 'Failed to save minutes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="minutes-form" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <h3>Committee Meeting Minutes</h3>
      </div>
      {submitError && <div className="alert alert-error">⚠️ {submitError}</div>}
      <div className="form-group">
        <label htmlFor="committee-minutes-title">
          Title <span className="required">*</span>
        </label>
        <input
          id="committee-minutes-title"
          type="text"
          name="title"
          placeholder="e.g., Committee Meeting – March 2025"
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
      <div className="form-group">
        <label htmlFor="committee-minutes-date">Meeting Date</label>
        <input
          id="committee-minutes-date"
          type="date"
          name="meeting_date"
          value={formData.meeting_date}
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label htmlFor="committee-minutes-participants">Participants</label>
        <input
          id="committee-minutes-participants"
          type="text"
          name="participants"
          placeholder="e.g., Chair, Secretary, Members…"
          value={formData.participants}
          onChange={handleChange}
          maxLength={500}
          disabled={loading}
        />
        <span className="char-count">{formData.participants.length}/500</span>
      </div>
      <div className="form-group">
        <label>Attendance</label>
        {committeeMembers.length > 0 ? (
          <div className="attendance-picker">
            {committeeMembers.map((member) => {
              const label = member.name || member.full_name || member.user_name || `Member ${member.user_id}`;
              const checked = formData.attendees.some((attendee) => String(attendee.user_id) === String(member.user_id));
              return (
                <label key={`${member.user_id}-${label}`} className="attendance-item">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAttendee({ user_id: member.user_id, name: label, role: member.role || '' })}
                    disabled={loading}
                  />
                  <span>{label}{member.role ? ` (${member.role})` : ''}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="field-hint">Attendance checkboxes are unavailable until the committee roster is loaded. Use the participants field above as a fallback.</p>
        )}
        <div className="quorum-summary">
          <span>Present: {quorumPresent}</span>
          <span>Quorum required: {quorumRequired || '—'}</span>
          <span className={quorumMet ? 'quorum-met' : 'quorum-missing'}>
            {quorumRequired > 0 ? (quorumMet ? 'Quorum met' : 'Quorum not met') : 'Quorum unavailable'}
          </span>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="committee-minutes-file">Upload Transcript File</label>
        <input
          id="committee-minutes-file"
          type="file"
          accept=".txt,.md,.csv"
          onChange={handleFileUpload}
          className="file-input"
          disabled={loading}
        />
        <p className="field-hint">Supported formats: .txt, .md, .csv</p>
      </div>
      <div className="form-group">
        <label htmlFor="committee-minutes-transcript">
          Transcript <span className="required">*</span>
        </label>
        <textarea
          id="committee-minutes-transcript"
          name="transcript"
          value={formData.transcript}
          onChange={handleChange}
          rows={6}
          className={formErrors.transcript ? 'input-error' : ''}
          maxLength={5000}
          disabled={loading}
        />
        {formErrors.transcript && (
          <span className="field-error">{formErrors.transcript}</span>
        )}
        <span className="char-count">{formData.transcript.length}/5000</span>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving…' : 'Save Minutes'}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </form>
  );
}
