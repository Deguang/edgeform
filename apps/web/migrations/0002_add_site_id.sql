-- Add site_id to submissions for multi-site support
ALTER TABLE submissions ADD COLUMN site_id TEXT DEFAULT 'config';

CREATE INDEX IF NOT EXISTS idx_submissions_site
  ON submissions(site_id, created_at);

-- Add site_id to waitlist for multi-site support
ALTER TABLE waitlist ADD COLUMN site_id TEXT DEFAULT 'config';
