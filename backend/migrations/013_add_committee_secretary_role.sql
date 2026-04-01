-- Migration: Add Committee Secretary role to roles table
INSERT INTO roles (role_name) VALUES ('Committee Secretary') ON CONFLICT DO NOTHING;

-- Optionally, update committee_members table to allow 'Committee Secretary' as a role
ALTER TABLE committee_members
DROP CONSTRAINT committee_members_role_check,
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
