-- Ordinance Workflow Table (stores all actions/status changes)
CREATE TABLE IF NOT EXISTS ordinance_workflow (
  id SERIAL PRIMARY KEY,
  ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- SUBMIT, APPROVE, REJECT, REQUEST_CHANGES, PUBLISH, ARCHIVE, STATUS_CHANGE
  status VARCHAR(50), -- Current status after this action
  performed_by_id INTEGER REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordinance_workflow_ordinance_id ON ordinance_workflow(ordinance_id);
CREATE INDEX IF NOT EXISTS idx_ordinance_workflow_created_at ON ordinance_workflow(created_at);

-- Ordinance Approvals Table (tracks who needs to approve)
CREATE TABLE IF NOT EXISTS ordinance_approvals (
  id SERIAL PRIMARY KEY,
  ordinance_id INTEGER NOT NULL REFERENCES ordinances(id) ON DELETE CASCADE,
  approver_role VARCHAR(50) NOT NULL, -- Secretary, Committee, Council, Admin
  approver_id INTEGER REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'Pending', -- Pending, Approved, Rejected
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordinance_approvals_ordinance_id ON ordinance_approvals(ordinance_id);
CREATE INDEX IF NOT EXISTS idx_ordinance_approvals_status ON ordinance_approvals(status);