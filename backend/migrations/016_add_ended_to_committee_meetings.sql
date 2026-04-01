-- Migration: Add ended field to committee_meetings
ALTER TABLE committee_meetings
ADD COLUMN ended BOOLEAN DEFAULT FALSE;