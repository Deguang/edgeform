-- Ensure 'waitlist' form exists for FK constraint
INSERT OR IGNORE INTO forms (id, title, status) VALUES ('waitlist', 'Waitlist', 'published');

-- Ensure 'default' form exists for general submissions
INSERT OR IGNORE INTO forms (id, title, status) VALUES ('default', 'Default', 'published');

-- Migrate existing waitlist entries into submissions table
INSERT INTO submissions (id, form_id, site_id, data_json, created_at)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
  'waitlist',
  COALESCE(site_id, 'config'),
  '{"email":"' || replace(email, '"', '\"') || '"}',
  created_at
FROM waitlist
WHERE NOT EXISTS (
  SELECT 1 FROM submissions s
  WHERE s.form_id = 'waitlist'
  AND s.data_json LIKE '%"email":"' || waitlist.email || '"%'
);
