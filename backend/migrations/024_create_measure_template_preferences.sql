CREATE TABLE IF NOT EXISTS measure_template_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measure_type VARCHAR(20) NOT NULL CHECK (measure_type IN ('ordinance', 'resolution')),
  measure_id INTEGER NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  last_used_at TIMESTAMP,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, measure_type, measure_id)
);

CREATE INDEX IF NOT EXISTS idx_template_pref_user_type ON measure_template_preferences(user_id, measure_type);
CREATE INDEX IF NOT EXISTS idx_template_pref_favorite ON measure_template_preferences(is_favorite);
CREATE INDEX IF NOT EXISTS idx_template_pref_last_used ON measure_template_preferences(last_used_at);
