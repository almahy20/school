ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"attendance": true, "grades": true, "messages": true, "system": true}'::jsonb;
