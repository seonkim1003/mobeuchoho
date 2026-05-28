-- Add nullable demographics columns to sessions.
-- Apply with:
--   wrangler d1 execute englishproject-db --file=migrations/0002_demographics.sql --remote

ALTER TABLE sessions ADD COLUMN age_band TEXT;
ALTER TABLE sessions ADD COLUMN education TEXT;
ALTER TABLE sessions ADD COLUMN native_english TEXT;
ALTER TABLE sessions ADD COLUMN gender TEXT;
ALTER TABLE sessions ADD COLUMN ai_familiarity TEXT;
