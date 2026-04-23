ALTER TABLE session_minutes
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_original_name TEXT,
  ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS recording_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_minutes_recording_uploaded_by
  ON session_minutes(recording_uploaded_by);