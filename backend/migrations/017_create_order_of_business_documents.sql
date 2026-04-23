-- Order of Business Documents Migration
-- Creates a single document record for each Order of Business, storing header metadata.
-- Individual agenda items in order_of_business link back via document_id.

CREATE TABLE IF NOT EXISTS order_of_business_documents (
  id                SERIAL PRIMARY KEY,
  session_id        INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  title             VARCHAR(255) NOT NULL,
  date              DATE,
  time              TIME,
  venue             VARCHAR(255),
  presiding_officer VARCHAR(255),
  secretary         VARCHAR(255),
  status            VARCHAR(20) NOT NULL DEFAULT 'Draft'
                      CHECK (status IN ('Draft', 'Final', 'Approved', 'Archived')),
  created_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- Add document_id foreign key to order_of_business items
ALTER TABLE order_of_business
ADD COLUMN IF NOT EXISTS document_id INTEGER REFERENCES order_of_business_documents(id) ON DELETE CASCADE;

-- Indices
CREATE INDEX IF NOT EXISTS idx_oob_document_id ON order_of_business(document_id);
CREATE INDEX IF NOT EXISTS idx_oob_docs_session ON order_of_business_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_oob_docs_date ON order_of_business_documents(date DESC);
