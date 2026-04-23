-- Add resolution_id to session_agenda_items so both ordinances and resolutions
-- can be scheduled on a session agenda.

ALTER TABLE session_agenda_items
  ADD COLUMN IF NOT EXISTS resolution_id INTEGER REFERENCES resolutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agenda_items_resolution ON session_agenda_items(resolution_id);

-- Drop the old unique constraint (session_id, ordinance_id) and replace with a
-- check that prevents duplicate ordinance OR resolution per session.
ALTER TABLE session_agenda_items
  DROP CONSTRAINT IF EXISTS session_agenda_items_session_id_ordinance_id_key;

-- Unique ordinance per session (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_session_ordinance
  ON session_agenda_items (session_id, ordinance_id) WHERE ordinance_id IS NOT NULL;

-- Unique resolution per session (ignoring nulls)
CREATE UNIQUE INDEX IF NOT EXISTS uq_agenda_session_resolution
  ON session_agenda_items (session_id, resolution_id) WHERE resolution_id IS NOT NULL;

-- Ensure each row references exactly one of ordinance or resolution
ALTER TABLE session_agenda_items
  ADD CONSTRAINT chk_agenda_item_type
  CHECK (
    (ordinance_id IS NOT NULL AND resolution_id IS NULL) OR
    (ordinance_id IS NULL AND resolution_id IS NOT NULL)
  ) NOT VALID;
