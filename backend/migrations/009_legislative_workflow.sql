-- Legislative Workflow Migration
-- Adds Three-Readings system fields to ordinances and supporting tables.

-- ─────────────────────────────────────────────────────────────
-- 1. New columns on the ordinances table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE ordinances
  ADD COLUMN IF NOT EXISTS reading_stage VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_id_first_reading  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id_second_reading INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id_third_reading  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_id              INTEGER REFERENCES committees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_assignment_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS assigned_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_report_id       INTEGER,            -- FK added after table exists
  ADD COLUMN IF NOT EXISTS voting_results            JSONB,
  ADD COLUMN IF NOT EXISTS voted_at                  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at               TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approval_remarks          TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason          TEXT,
  ADD COLUMN IF NOT EXISTS posted_at                 TIMESTAMP,
  ADD COLUMN IF NOT EXISTS posting_end_date          DATE,
  ADD COLUMN IF NOT EXISTS effective_date            DATE;

-- Index for fast filtering by reading stage
CREATE INDEX IF NOT EXISTS idx_ordinances_reading_stage ON ordinances(reading_stage);

-- ─────────────────────────────────────────────────────────────
-- 2. committee_reports
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS committee_reports (
  id             SERIAL PRIMARY KEY,
  ordinance_id   INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
  committee_id   INTEGER REFERENCES committees(id) ON DELETE SET NULL,
  submitted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMP DEFAULT NOW(),
  recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('APPROVE', 'REVISION', 'REJECTION')),
  report_content TEXT,
  meeting_date   DATE,
  meeting_minutes TEXT,
  attendees      JSONB
);

CREATE INDEX IF NOT EXISTS idx_committee_reports_ordinance ON committee_reports(ordinance_id);

-- Now add the FK from ordinances to committee_reports
ALTER TABLE ordinances
  ADD CONSTRAINT IF NOT EXISTS fk_ordinances_committee_report
  FOREIGN KEY (committee_report_id) REFERENCES committee_reports(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. reading_sessions  (links an ordinance reading to a session)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id                    SERIAL PRIMARY KEY,
  ordinance_id          INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
  session_id            INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  reading_number        INTEGER NOT NULL CHECK (reading_number IN (1, 2, 3)),
  conducted_at          TIMESTAMP DEFAULT NOW(),
  discussion_notes      TEXT,
  -- Reserved for future amendments tracking feature
  amendments_introduced JSONB,
  presiding_officer     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_ordinance ON reading_sessions(ordinance_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_session   ON reading_sessions(session_id);

-- ─────────────────────────────────────────────────────────────
-- 4. posting_records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posting_records (
  id                   SERIAL PRIMARY KEY,
  ordinance_id         INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
  posted_at            TIMESTAMP DEFAULT NOW(),
  posted_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  posting_duration_days INTEGER DEFAULT 3,
  posting_location     TEXT,
  effective_date       DATE,
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_posting_records_ordinance ON posting_records(ordinance_id);

-- ─────────────────────────────────────────────────────────────
-- 5. session_agenda_items
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_agenda_items (
  id             SERIAL PRIMARY KEY,
  session_id     INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ordinance_id   INTEGER REFERENCES ordinances(id) ON DELETE SET NULL,
  agenda_order   INTEGER NOT NULL DEFAULT 1,
  reading_number INTEGER CHECK (reading_number IN (1, 2, 3)),
  created_at     TIMESTAMP DEFAULT NOW(),
  UNIQUE (session_id, ordinance_id)
);

CREATE INDEX IF NOT EXISTS idx_agenda_items_session   ON session_agenda_items(session_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_ordinance ON session_agenda_items(ordinance_id);
