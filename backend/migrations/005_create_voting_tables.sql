-- Voting Sessions Table
CREATE TABLE IF NOT EXISTS voting_sessions (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  ordinance_id INT REFERENCES ordinances(id) ON DELETE SET NULL,
  resolution_id INT REFERENCES resolutions(id) ON DELETE SET NULL,
  question VARCHAR(500) NOT NULL,
  voting_type VARCHAR(50) DEFAULT 'yes_no', -- 'yes_no', 'yes_no_abstain'
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'closed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

-- Votes Table
CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES voting_sessions(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_option VARCHAR(100) NOT NULL, -- 'Yes', 'No', 'Abstain'
  voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_votes_session ON votes(session_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_status ON voting_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voting_sessions_created_by ON voting_sessions(created_by);
