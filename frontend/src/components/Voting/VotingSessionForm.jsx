import { useState } from 'react';
import api from '../../api/api';

export default function VotingSessionForm({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    question: '',
    voting_type: 'yes_no_abstain',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim() || !formData.question.trim()) {
      setError('Title and question are required.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/votes/sessions', {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        question: formData.question.trim(),
        voting_type: formData.voting_type,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create voting session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voting-form-container">
      <h4>Create New Voting Session</h4>

      {error && <div className="form-error">{error}</div>}

      <form className="voting-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="vote-title">Session Title *</label>
          <input
            id="vote-title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Vote on Ordinance No. 2026-001"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="vote-description">Description</label>
          <textarea
            id="vote-description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Optional context or details about this vote"
            rows="2"
          />
        </div>

        <div className="form-group">
          <label htmlFor="vote-question">Voting Question *</label>
          <input
            id="vote-question"
            type="text"
            name="question"
            value={formData.question}
            onChange={handleChange}
            placeholder="e.g., Do you approve this ordinance?"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="vote-type">Voting Options *</label>
          <select
            id="vote-type"
            name="voting_type"
            value={formData.voting_type}
            onChange={handleChange}
          >
            <option value="yes_no_abstain">Yes / No / Abstain</option>
            <option value="yes_no">Yes / No</option>
          </select>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-submit-vote" disabled={loading}>
            {loading ? 'Creating...' : 'Create Voting Session'}
          </button>
          <button type="button" className="btn-cancel-vote" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
