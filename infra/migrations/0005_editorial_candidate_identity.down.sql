ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_proposed_slug_format_check,
  DROP CONSTRAINT IF EXISTS submissions_proposed_title_length_check,
  DROP COLUMN IF EXISTS proposed_slug,
  DROP COLUMN IF EXISTS proposed_title;
