-- Add structured attendance and quorum tracking to committee_minutes.

ALTER TABLE committee_minutes
  ADD COLUMN IF NOT EXISTS attendees_json JSONB,
  ADD COLUMN IF NOT EXISTS quorum_required INTEGER,
  ADD COLUMN IF NOT EXISTS quorum_present INTEGER,
  ADD COLUMN IF NOT EXISTS quorum_met BOOLEAN DEFAULT FALSE;