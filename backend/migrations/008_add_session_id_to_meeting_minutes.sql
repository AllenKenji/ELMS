-- Add session_id foreign key to meeting_minutes table
ALTER TABLE meeting_minutes
  ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL;

-- Index for performance when querying minutes by session
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_session_id ON meeting_minutes(session_id);
