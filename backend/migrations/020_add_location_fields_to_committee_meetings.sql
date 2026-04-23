ALTER TABLE committee_meetings
  ADD COLUMN IF NOT EXISTS meeting_mode VARCHAR(20) DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS meeting_location TEXT;

UPDATE committee_meetings
SET meeting_mode = CASE
  WHEN meeting_link IS NOT NULL AND TRIM(meeting_link) <> '' THEN 'online'
  ELSE 'place'
END
WHERE meeting_mode IS NULL;
