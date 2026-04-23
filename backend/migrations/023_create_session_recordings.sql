CREATE TABLE IF NOT EXISTS session_recordings (
  id SERIAL PRIMARY KEY,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  minutes_id INTEGER REFERENCES session_minutes(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  recording_original_name TEXT,
  recording_uploaded_at TIMESTAMP DEFAULT NOW(),
  recording_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  transcript TEXT,
  transcript_status VARCHAR(20) DEFAULT 'pending',
  transcript_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_minutes_id ON session_recordings(minutes_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_uploaded_by ON session_recordings(recording_uploaded_by);