DROP INDEX IF EXISTS submissions_origin_status_idx;

ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_origin_type_check,
  DROP COLUMN IF EXISTS trigger_reason,
  DROP COLUMN IF EXISTS origin_type;
