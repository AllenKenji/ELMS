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
    END
    $$;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_agenda_items_session ON session_agenda_items(session_id);
    CREATE INDEX IF NOT EXISTS idx_agenda_items_ordinance ON session_agenda_items(ordinance_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agenda_items_session_ordinance_unique
      ON session_agenda_items(session_id, ordinance_id)
      WHERE ordinance_id IS NOT NULL;
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

async function bootstrapSchema() {
  await ensureCoreSchema();
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