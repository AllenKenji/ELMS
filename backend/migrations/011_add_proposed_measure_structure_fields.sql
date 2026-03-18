-- Add structured proposed-measure fields to ordinances and resolutions

ALTER TABLE ordinances
  ADD COLUMN IF NOT EXISTS co_authors TEXT,
  ADD COLUMN IF NOT EXISTS whereas_clauses TEXT,
  ADD COLUMN IF NOT EXISTS effectivity_clause TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS session_id INTEGER;

ALTER TABLE resolutions
  ADD COLUMN IF NOT EXISTS co_authors TEXT,
  ADD COLUMN IF NOT EXISTS whereas_clauses TEXT,
  ADD COLUMN IF NOT EXISTS effectivity_clause TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS session_id INTEGER;
