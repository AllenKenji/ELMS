export default function VotingResults({ results, totalVotes }) {
  if (!results || results.length === 0) {
    return <div className="no-results">No votes have been cast yet.</div>;
  }

  const optionColors = {
    Yes: '#27ae60',
    No: '#e74c3c',
    Abstain: '#95a5a6',
  };

  return (
    <div className="voting-results">
      <h4>Results ({totalVotes} vote{totalVotes !== 1 ? 's' : ''})</h4>
      <div className="results-bars">
        {results.map((r, idx) => (
          <div key={idx} className="result-row">
            <div className="result-label-row">
              <span className="result-option">{r.vote_option}</span>
              <span className="result-stats">
                {r.count} ({r.percentage ?? 0}%)
              </span>
            </div>
            <div className="result-bar-track">
              <div
                className="result-bar-fill"
                style={{
                  width: `${r.percentage ?? 0}%`,
                  backgroundColor: optionColors[r.vote_option] || '#4a90e2',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
