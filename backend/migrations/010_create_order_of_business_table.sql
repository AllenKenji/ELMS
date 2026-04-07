-- Order of Business Migration
-- Creates the order_of_business table for tracking session agenda items.

CREATE TABLE IF NOT EXISTS order_of_business (
  id                    SERIAL PRIMARY KEY,
  session_id            INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  item_number           INTEGER NOT NULL DEFAULT 1,
  title                 VARCHAR(255) NOT NULL,
  item_type             VARCHAR(50) NOT NULL DEFAULT 'Other'
                          CHECK (item_type IN (
                            'Call to Order', 'Roll Call', 'Prayer',
                            'Unfinished Business', 'New Business', 'Committee Reports',
                            'Approval of Minutes', 'Ordinance', 'Resolution',
                            'Announcement', 'Question Hour', 'Adjournment', 'Other', 'Other Matters'
                          )),
  related_document_id   INTEGER,
  related_document_type VARCHAR(20) CHECK (related_document_type IN ('ordinance', 'resolution')),
  duration_minutes      INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  priority              INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
                          CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Postponed', 'Skipped')),
  notes                 TEXT,
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW()
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS idx_oob_session_id   ON order_of_business(session_id);
CREATE INDEX IF NOT EXISTS idx_oob_item_number  ON order_of_business(session_id, item_number);
CREATE INDEX IF NOT EXISTS idx_oob_status       ON order_of_business(status);
