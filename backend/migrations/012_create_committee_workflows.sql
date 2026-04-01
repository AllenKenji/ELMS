-- Migration for committee_workflows table
CREATE TABLE IF NOT EXISTS committee_workflows (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(20) NOT NULL, -- 'ordinance' or 'resolution'
    item_id INTEGER NOT NULL,
    committee_id INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    remarks TEXT,
    last_action_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
