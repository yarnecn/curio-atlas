ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS origin_type text NOT NULL DEFAULT 'user_submission',
  ADD COLUMN IF NOT EXISTS trigger_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_origin_type_check'
      AND conrelid = 'submissions'::regclass
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_origin_type_check
      CHECK (origin_type IN ('user_submission', 'source_discovery', 'coverage_gap', 'maintenance', 'admin_seed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS submissions_origin_status_idx
  ON submissions(origin_type, status, created_at DESC);
