const fs = require('fs/promises');
const path = require('path');
const pool = require('./db');

async function ensureCoreSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(100) NOT NULL UNIQUE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      location TEXT,
      agenda TEXT,
      notes TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordinances (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      ordinance_number VARCHAR(100),
      description TEXT,
      content TEXT,
      remarks TEXT,
      proposer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      proposer_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'Draft',
      approved_date TIMESTAMP,
      published_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolutions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      resolution_number VARCHAR(100),
      description TEXT,
      content TEXT,
      remarks TEXT,
      proposer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      proposer_name VARCHAR(255),
      status VARCHAR(50) DEFAULT 'Draft',
      approved_date TIMESTAMP,
      published_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_participants (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attendance_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      added_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (session_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO roles (id, role_name) VALUES
      (1, 'Admin'),
      (2, 'Secretary'),
      (3, 'Councilor'),
      (4, 'Vice Mayor'),
      (5, 'Resident'),
      (6, 'Committee Secretary')
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function ensureLegislativeAgendaSchema() {
  await pool.query(`
    ALTER TABLE ordinances
    ADD COLUMN IF NOT EXISTS reading_stage VARCHAR(50) DEFAULT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_agenda_items (
      id SERIAL PRIMARY KEY
    );
  `);

  await pool.query(`
    ALTER TABLE session_agenda_items
    ADD COLUMN IF NOT EXISTS session_id INTEGER,
    ADD COLUMN IF NOT EXISTS ordinance_id INTEGER,
    ADD COLUMN IF NOT EXISTS resolution_id INTEGER,
    ADD COLUMN IF NOT EXISTS agenda_order INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS reading_number INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'session_agenda_items'
          AND constraint_name = 'session_agenda_items_session_id_fkey'
      ) THEN
        ALTER TABLE session_agenda_items
        ADD CONSTRAINT session_agenda_items_session_id_fkey
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'session_agenda_items'
          AND constraint_name = 'session_agenda_items_ordinance_id_fkey'
      ) THEN
        ALTER TABLE session_agenda_items
        ADD CONSTRAINT session_agenda_items_ordinance_id_fkey
        FOREIGN KEY (ordinance_id) REFERENCES ordinances(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'session_agenda_items'
          AND constraint_name = 'session_agenda_items_resolution_id_fkey'
      ) THEN
        ALTER TABLE session_agenda_items
        ADD CONSTRAINT session_agenda_items_resolution_id_fkey
        FOREIGN KEY (resolution_id) REFERENCES resolutions(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agenda_items_session ON session_agenda_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_ordinance ON session_agenda_items(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_resolution ON session_agenda_items(resolution_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_items_session_ordinance_unique
      ON session_agenda_items(session_id, ordinance_id)
      WHERE ordinance_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_items_session_resolution_unique
      ON session_agenda_items(session_id, resolution_id)
      WHERE resolution_id IS NOT NULL;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'session_agenda_items'
          AND constraint_name = 'session_agenda_items_exactly_one_measure_check'
      ) THEN
        ALTER TABLE session_agenda_items
        ADD CONSTRAINT session_agenda_items_exactly_one_measure_check
        CHECK (
          (ordinance_id IS NOT NULL AND resolution_id IS NULL) OR
          (ordinance_id IS NULL AND resolution_id IS NOT NULL)
        );
      END IF;
    END
    $$;
  `);
}

async function ensureProposedMeasureStructureSchema() {
  await pool.query(`
    ALTER TABLE ordinances
    ADD COLUMN IF NOT EXISTS co_authors TEXT,
    ADD COLUMN IF NOT EXISTS whereas_clauses TEXT,
    ADD COLUMN IF NOT EXISTS effectivity_clause TEXT,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS session_id INTEGER;
  `);

  await pool.query(`
    ALTER TABLE resolutions
    ADD COLUMN IF NOT EXISTS co_authors TEXT,
    ADD COLUMN IF NOT EXISTS whereas_clauses TEXT,
    ADD COLUMN IF NOT EXISTS effectivity_clause TEXT,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS session_id INTEGER;
  `);
}

async function ensureOrderOfBusinessSchema() {
  const migrationPath = path.join(__dirname, 'migrations', '010_create_order_of_business_table.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);

  // Ensure session_id is nullable (workflow: OOB created before session)
  await pool.query(`
    ALTER TABLE order_of_business
    ALTER COLUMN session_id DROP NOT NULL;
  `).catch(() => {});
}

async function ensureOrderOfBusinessItemTypeConstraint() {
  await pool.query(`
    ALTER TABLE order_of_business
    DROP CONSTRAINT IF EXISTS order_of_business_item_type_check;

    ALTER TABLE order_of_business
    ADD CONSTRAINT order_of_business_item_type_check
    CHECK (item_type IN (
      'Call to Order', 'Roll Call', 'Prayer',
      'Unfinished Business', 'New Business', 'Committee Reports',
      'Approval of Minutes', 'Ordinance', 'Resolution',
      'Announcement', 'Question Hour', 'Adjournment', 'Other', 'Other Matters'
    ));
  `);
}

async function ensureOrderOfBusinessDocumentsSchema() {
  const migrationPath = path.join(__dirname, 'migrations', '017_create_order_of_business_documents.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
}

async function ensureCommitteeMeetingRecordingSchema() {
  await pool.query(`
    ALTER TABLE committee_meetings
    ADD COLUMN IF NOT EXISTS meeting_mode VARCHAR(20) DEFAULT 'online',
    ADD COLUMN IF NOT EXISTS meeting_location TEXT,
    ADD COLUMN IF NOT EXISTS recording_url TEXT,
    ADD COLUMN IF NOT EXISTS recording_original_name TEXT,
    ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS recording_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `).catch(() => {});

  await pool.query(`
    UPDATE committee_meetings
    SET meeting_mode = CASE
      WHEN COALESCE(NULLIF(TRIM(meeting_location), ''), '') <> '' AND COALESCE(NULLIF(TRIM(meeting_link), ''), '') <> '' THEN 'both'
      WHEN COALESCE(NULLIF(TRIM(meeting_location), ''), '') <> '' THEN 'place'
      ELSE 'online'
    END
    WHERE meeting_mode IS NULL;
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_committee_meetings_recording_uploaded_by
      ON committee_meetings(recording_uploaded_by);
  `).catch(() => {});
}

async function ensureSessionMinutesRecordingSchema() {
  await pool.query(`
    ALTER TABLE session_minutes
    ADD COLUMN IF NOT EXISTS recording_url TEXT,
    ADD COLUMN IF NOT EXISTS recording_original_name TEXT,
    ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS recording_uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_session_minutes_recording_uploaded_by
      ON session_minutes(recording_uploaded_by);
  `).catch(() => {});
}

async function ensureSessionRecordingsSchema() {
  await pool.query(`
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
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id ON session_recordings(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_recordings_minutes_id ON session_recordings(minutes_id);
    CREATE INDEX IF NOT EXISTS idx_session_recordings_uploaded_by ON session_recordings(recording_uploaded_by);
  `).catch(() => {});
}

async function ensureCommitteeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS committees (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      chair_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS committee_members (
      id SERIAL PRIMARY KEY,
      committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(32) NOT NULL DEFAULT 'Member',
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (committee_id, user_id)
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'committee_members'
          AND constraint_name = 'committee_members_role_check'
      ) THEN
        ALTER TABLE committee_members DROP CONSTRAINT committee_members_role_check;
      END IF;

      ALTER TABLE committee_members
      ADD CONSTRAINT committee_members_role_check
      CHECK (
        role::text = ANY (
          ARRAY[
            'Chair',
            'Vice Chair',
            'Member',
            'Secretary',
            'Committee Secretary'
          ]::text[]
        )
      );
    END
    $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_committees_status ON committees(status);
    CREATE INDEX IF NOT EXISTS idx_committees_chair ON committees(chair_id);
    CREATE INDEX IF NOT EXISTS idx_committee_members_committee ON committee_members(committee_id);
    CREATE INDEX IF NOT EXISTS idx_committee_members_user ON committee_members(user_id);
  `);
}

async function ensureNotificationsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      related_type VARCHAR(50),
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
  `);
}

async function ensureLegislativeWorkflowSchema() {
  await pool.query(`
    ALTER TABLE ordinances
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
      ADD COLUMN IF NOT EXISTS effective_date            DATE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordinance_workflow (
      id SERIAL PRIMARY KEY,
      ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      status VARCHAR(50),
      performed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ordinance_approvals (
      id SERIAL PRIMARY KEY,
      ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
      approver_role VARCHAR(50) NOT NULL,
      approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      approved_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS committee_reports (
      id SERIAL PRIMARY KEY,
      ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
      committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
      submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      submitted_at TIMESTAMP DEFAULT NOW(),
      recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('APPROVE', 'REVISION', 'REJECTION')),
      report_content TEXT,
      meeting_date DATE,
      meeting_minutes TEXT,
      attendees JSONB
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id SERIAL PRIMARY KEY,
      ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      reading_number INTEGER NOT NULL CHECK (reading_number IN (1, 2, 3)),
      conducted_at TIMESTAMP DEFAULT NOW(),
      discussion_notes TEXT,
      amendments_introduced JSONB,
      presiding_officer INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posting_records (
      id SERIAL PRIMARY KEY,
      ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
      posted_at TIMESTAMP DEFAULT NOW(),
      posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      posting_duration_days INTEGER DEFAULT 3,
      posting_location TEXT,
      effective_date DATE,
      notes TEXT
    );
  `);

  await pool.query(`
    ALTER TABLE resolutions
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
      ADD COLUMN IF NOT EXISTS effective_date            DATE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolution_workflow (
      id SERIAL PRIMARY KEY,
      resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
      action_type VARCHAR(50) NOT NULL,
      status VARCHAR(50),
      performed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      comment TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolution_approvals (
      id SERIAL PRIMARY KEY,
      resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
      approver_role VARCHAR(50) NOT NULL,
      approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(50) DEFAULT 'Pending',
      approved_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolution_committee_reports (
      id SERIAL PRIMARY KEY,
      resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
      committee_id INTEGER REFERENCES committees(id) ON DELETE SET NULL,
      submitted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      submitted_at TIMESTAMP DEFAULT NOW(),
      recommendation VARCHAR(20) NOT NULL CHECK (recommendation IN ('APPROVE', 'REVISION', 'REJECTION')),
      report_content TEXT,
      meeting_date DATE,
      meeting_minutes TEXT,
      attendees JSONB
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolution_reading_sessions (
      id SERIAL PRIMARY KEY,
      resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
      reading_number INTEGER NOT NULL CHECK (reading_number IN (1, 2, 3)),
      conducted_at TIMESTAMP DEFAULT NOW(),
      discussion_notes TEXT,
      amendments_introduced JSONB,
      presiding_officer INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resolution_posting_records (
      id SERIAL PRIMARY KEY,
      resolution_id INTEGER NOT NULL REFERENCES resolutions(id) ON DELETE CASCADE,
      posted_at TIMESTAMP DEFAULT NOW(),
      posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      posting_duration_days INTEGER DEFAULT 3,
      posting_location TEXT,
      effective_date DATE,
      notes TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_ordinance_workflow_ordinance_id ON ordinance_workflow(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_ordinance_workflow_created_at ON ordinance_workflow(created_at);
    CREATE INDEX IF NOT EXISTS idx_ordinance_approvals_ordinance_id ON ordinance_approvals(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_ordinance_approvals_status ON ordinance_approvals(status);
    CREATE INDEX IF NOT EXISTS idx_committee_reports_ordinance ON committee_reports(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_ordinance ON reading_sessions(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_reading_sessions_session ON reading_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_posting_records_ordinance ON posting_records(ordinance_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_workflow_resolution_id ON resolution_workflow(resolution_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_workflow_created_at ON resolution_workflow(created_at);
    CREATE INDEX IF NOT EXISTS idx_resolution_approvals_resolution_id ON resolution_approvals(resolution_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_approvals_status ON resolution_approvals(status);
    CREATE INDEX IF NOT EXISTS idx_resolution_committee_reports_resolution ON resolution_committee_reports(resolution_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_reading_sessions_resolution ON resolution_reading_sessions(resolution_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_reading_sessions_session ON resolution_reading_sessions(session_id);
    CREATE INDEX IF NOT EXISTS idx_resolution_posting_records_resolution ON resolution_posting_records(resolution_id);
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'ordinances'
          AND constraint_name = 'fk_ordinances_committee_report'
      ) THEN
        ALTER TABLE ordinances
          ADD CONSTRAINT fk_ordinances_committee_report
          FOREIGN KEY (committee_report_id) REFERENCES committee_reports(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'resolutions'
          AND constraint_name = 'fk_resolutions_committee_report'
      ) THEN
        ALTER TABLE resolutions
          ADD CONSTRAINT fk_resolutions_committee_report
          FOREIGN KEY (committee_report_id) REFERENCES resolution_committee_reports(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);
}

async function bootstrapSchema() {
  await ensureCoreSchema();
  await ensureCommitteeSchema();
  await ensureNotificationsSchema();
  await ensureLegislativeWorkflowSchema();
  await ensureProposedMeasureStructureSchema();
  await ensureLegislativeAgendaSchema();
  await ensureOrderOfBusinessSchema();
  await ensureOrderOfBusinessItemTypeConstraint();
  await ensureOrderOfBusinessDocumentsSchema();
  await ensureCommitteeMeetingRecordingSchema();
  await ensureSessionMinutesRecordingSchema();
  await ensureSessionRecordingsSchema();
}

module.exports = {
  bootstrapSchema,
};