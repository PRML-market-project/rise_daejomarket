-- Run once only when automatic Hibernate schema updates are disabled.
ALTER TABLE kiosk_experience ADD COLUMN translations_json LONGTEXT NULL;
