const fs = require('fs/promises');
const path = require('path');
const pool = require('./db');

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

async function ensureOrderOfBusinessSchema() {
  const migrationPath = path.join(__dirname, 'migrations', '010_create_order_of_business_table.sql');
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
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

async function bootstrapSchema() {
  await ensureLegislativeAgendaSchema();
  await ensureOrderOfBusinessSchema();
  await ensureOrderOfBusinessItemTypeConstraint();
}

module.exports = {
  bootstrapSchema,
};