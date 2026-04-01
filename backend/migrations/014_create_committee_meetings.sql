-- Migration: Create committee_meetings table
CREATE TABLE IF NOT EXISTS committee_meetings (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    meeting_time TEXT,
    committee_id INTEGER NOT NULL REFERENCES committees(id) ON DELETE CASCADE,
    ordinance_id INTEGER REFERENCES ordinances(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(30) DEFAULT 'Draft',
    meeting_link TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_committee_meetings_committee_id ON committee_meetings(committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_ordinance_id ON committee_meetings(ordinance_id);
CREATE INDEX IF NOT EXISTS idx_committee_meetings_meeting_date ON committee_meetings(meeting_date);
