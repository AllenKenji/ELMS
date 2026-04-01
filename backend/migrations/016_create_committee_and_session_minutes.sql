-- Migration: Create committee_minutes table
CREATE TABLE committee_minutes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    meeting_date DATE,
    participants TEXT,
    transcript TEXT,
    status VARCHAR(50) DEFAULT 'Draft',
    created_by INTEGER REFERENCES users(id),
    committee_id INTEGER REFERENCES committees(id),
    generated_minutes TEXT,
    attendees TEXT,
    key_decisions TEXT,
    action_items TEXT,
    next_steps TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration: Create session_minutes table
CREATE TABLE session_minutes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    meeting_date DATE,
    participants TEXT,
    transcript TEXT,
    status VARCHAR(50) DEFAULT 'Draft',
    created_by INTEGER REFERENCES users(id),
    session_id INTEGER REFERENCES sessions(id),
    generated_minutes TEXT,
    attendees TEXT,
    key_decisions TEXT,
    action_items TEXT,
    next_steps TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
