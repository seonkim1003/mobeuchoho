-- Add nullable post-survey columns to sessions.
-- Apply with:
--   wrangler d1 execute englishproject-db --file=migrations/0003_post_survey.sql --remote

ALTER TABLE sessions ADD COLUMN learned TEXT;
ALTER TABLE sessions ADD COLUMN useful TEXT;
ALTER TABLE sessions ADD COLUMN rating INTEGER;
ALTER TABLE sessions ADD COLUMN confidence TEXT;
ALTER TABLE sessions ADD COLUMN ai_changed TEXT;
ALTER TABLE sessions ADD COLUMN learned_ai TEXT;
ALTER TABLE sessions ADD COLUMN course_effectiveness TEXT;
