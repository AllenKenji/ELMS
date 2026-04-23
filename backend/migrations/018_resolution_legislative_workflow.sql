-- Resolution Legislative Workflow Migration
-- Adds Three-Readings system fields to resolutions and supporting tables (mirrors ordinance workflow).

-- ─────────────────────────────────────────────────────────────
-- 1. New columns on the resolutions table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE resolutions
  ADD COLUMN IF NOT EXISTS reading_stage VARCHAR(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_id_first_reading  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id_second_reading INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id_third_reading  INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_id              INTEGER REFERENCES committees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_assignment_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS assigned_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_report_id       INTEGER,
  ADD COLUMN IF NOT EXISTS voting_results            JSONB,
  ADD COLUMN IF NOT EXISTS voted_at                  TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at               TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approval_remarks          TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason          TEXT,
  ADD COLUMN IF NOT EXISTS posted_at                 TIMESTAMP,
  ADD COLUMN IF NOT EXISTS posting_end_date          DATE,
  ADD COLUMN IF NOT EXISTS effective_date            DATE,
  ADD COLUMN IF NOT EXISTS approved_date             TIMESTAMP,
  ADD COLUMN IF NOT EXISTS published_date            TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_resolutions_reading_stage ON resolutions(reading_stage);

-- ─────────────────────────────────────────────────────────────
-- 2. resolution_workflow (stores all actions/status changes)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_workflow (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(50),
  performed_by_id INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_workflow_resolution_id ON resolution_workflow(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_workflow_created_at ON resolution_workflow(created_at);

-- ─────────────────────────────────────────────────────────────
-- 3. resolution_approvals
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_approvals (
  id SERIAL PRIMARY KEY,
  resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  approver_role VARCHAR(50) NOT NULL,
  approver_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'Pending',
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resolution_approvals_resolution_id ON resolution_approvals(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_approvals_status ON resolution_approvals(status);

-- ─────────────────────────────────────────────────────────────
-- 4. resolution_committee_reports
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_committee_reports (
  id             SERIAL PRIMARY KEY,
  resolution_id  INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  committee_id   INTEGER REFERENCES committees(id) ON DELETE SET NULL,
  submitted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitted_at   TIMESTAMP DEFAULT NOW(),
  recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('APPROVE', 'REVISION', 'REJECTION')),
  report_content TEXT,
  meeting_date   DATE,
  meeting_minutes TEXT,
  attendees      JSONB
);

CREATE INDEX IF NOT EXISTS idx_resolution_committee_reports_resolution ON resolution_committee_reports(resolution_id);

-- FK from resolutions to resolution_committee_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_resolutions_committee_report'
  ) THEN
    ALTER TABLE resolutions
      ADD CONSTRAINT fk_resolutions_committee_report
      FOREIGN KEY (committee_report_id) REFERENCES resolution_committee_reports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. resolution_reading_sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_reading_sessions (
  id                    SERIAL PRIMARY KEY,
  resolution_id         INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  session_id            INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  reading_number        INTEGER NOT NULL CHECK (reading_number IN (1, 2, 3)),
  conducted_at          TIMESTAMP DEFAULT NOW(),
  discussion_notes      TEXT,
  amendments_introduced JSONB,
  presiding_officer     INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resolution_reading_sessions_resolution ON resolution_reading_sessions(resolution_id);
CREATE INDEX IF NOT EXISTS idx_resolution_reading_sessions_session ON resolution_reading_sessions(session_id);

-- ─────────────────────────────────────────────────────────────
-- 6. resolution_posting_records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resolution_posting_records (
  id                   SERIAL PRIMARY KEY,
  resolution_id        INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
  posted_at            TIMESTAMP DEFAULT NOW(),
  posted_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  posting_duration_days INTEGER DEFAULT 3,
  posting_location     TEXT,
  effective_date       DATE,
  notes                TEXT
);

CREATE INDEX IF NOT EXISTS idx_resolution_posting_records_resolution ON resolution_posting_records(resolution_id);
