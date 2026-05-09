-- Add meta_json to submissions for non-PII metadata (country, region, timezone,
-- parsed UA, referer, accept-language, client tz/viewport). Kept separate from
-- data_json so user-defined form fields stay clean.
ALTER TABLE submissions ADD COLUMN meta_json TEXT;
