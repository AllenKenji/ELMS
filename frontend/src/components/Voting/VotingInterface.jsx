import { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import { useAuth } from '../../context/useAuth';
import VotingResults from './VotingResults';
import '../../styles/VotingInterface.css';

export default function VotingInterface({ session, onClose, onUpdate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVote, setSelectedVote] = useState('');
  const [voting, setVoting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  const canManage = ['Admin', 'Secretary', 'Councilor'].includes(user?.role);

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const response = await api.get(`/votes/sessions/${session.id}`);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching session data:', err);
      setError('Failed to load voting data.');
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleVote = async (e) => {
    e.preventDefault();
    if (!selectedVote) return;

    setVoting(true);
    setError('');
    try {
      await api.post('/votes/cast', {
        session_id: session.id,
        vote_option: selectedVote,
      });
      setSelectedVote('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Error casting vote.');
    } finally {
      setVoting(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Close this voting session? This action cannot be undone.')) return;
    setClosing(true);
    try {
      await api.put(`/votes/sessions/${session.id}/close`);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Error closing session.');
      setClosing(false);
    }
  };

  const voteOptions =
    data?.session?.voting_type === 'yes_no_abstain'
      ? ['Yes', 'No', 'Abstain']
      : ['Yes', 'No'];

  const hasVoted = Boolean(data?.userVote);
  const isActive = data?.session?.status === 'active';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="voting-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{session.title}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-loading">Loading...</div>
          ) : (
            <>
              {error && <div className="modal-error">{error}</div>}

              <p className="session-question-text">{data?.session?.question}</p>

              <div className="session-meta">
                <span className={`status-pill ${data?.session?.status}`}>
                  {data?.session?.status === 'active' ? '● Active' : '● Closed'}
                </span>
                {data?.session?.created_by_name && (
                  <span className="meta-item">Created by: {data.session.created_by_name}</span>
                )}
              </div>

              {/* Results visualization */}
              <VotingResults
                results={data?.results || []}
                totalVotes={data?.totalVotes || 0}
              />

              {/* Cast vote form */}
              {isActive && canManage && !hasVoted && (
                <form className="cast-vote-form" onSubmit={handleVote}>
                  <h4>Cast Your Vote</h4>
                  <div className="vote-options-grid">
                    {voteOptions.map(option => (
                      <label
                        key={option}
                        className={`vote-option-label ${selectedVote === option ? 'selected' : ''} ${option.toLowerCase()}`}
                      >
                        <input
                          type="radio"
                          name="vote_option"
                          value={option}
                          checked={selectedVote === option}
                          onChange={e => setSelectedVote(e.target.value)}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="btn-cast-vote"
                    disabled={!selectedVote || voting}
                  >
                    {voting ? 'Submitting...' : 'Submit Vote'}
                  </button>
                </form>
              )}

              {/* Already voted message */}
              {isActive && canManage && hasVoted && (
                <div className="already-voted">
                  ✅ You voted: <strong>{data.userVote}</strong>
                </div>
              )}

              {/* Not eligible message */}
              {isActive && !canManage && (
                <div className="not-eligible">
                  ℹ️ Only Councilors, Secretaries, and Admins may cast votes.
                </div>
              )}

              {/* Participants */}
              {data?.participants?.length > 0 && (
                <div className="participants-section">
                  <h4>Participants ({data.participants.length})</h4>
                  <div className="participants-list">
                    {data.participants.map((p, idx) => (
                      <div key={idx} className="participant-row">
                        <span className="participant-name">{p.name}</span>
                        <span className={`vote-pill ${p.vote_option?.toLowerCase()}`}>
                          {p.vote_option}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close session button */}
              {isActive && canManage && (
                <div className="close-session-section">
                  <button
                    className="btn-close-session"
                    onClick={handleClose}
                    disabled={closing}
                  >
                    {closing ? 'Closing...' : '🔒 Close Voting Session'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
