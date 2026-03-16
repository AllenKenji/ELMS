-- Create meeting_minutes table
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE,
  participants TEXT,
  transcript TEXT NOT NULL,
  generated_minutes TEXT,
  attendees TEXT,
  key_decisions TEXT,
  action_items TEXT,
  next_steps TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Generated', 'Archived')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_status ON meeting_minutes(status);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_created_by ON meeting_minutes(created_by);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_created_at ON meeting_minutes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_minutes_meeting_date ON meeting_minutes(meeting_date DESC);
