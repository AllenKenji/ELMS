-- Add resolution_id to committee_meetings
ALTER TABLE committee_meetings
  ADD COLUMN IF NOT EXISTS resolution_id INTEGER REFERENCES resolutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_committee_meetings_resolution_id ON committee_meetings(resolution_id);
