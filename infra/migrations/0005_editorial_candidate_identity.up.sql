ALTER TABLE submissions
  ADD COLUMN proposed_title text,
  ADD COLUMN proposed_slug text;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_proposed_title_length_check
    CHECK (proposed_title IS NULL OR char_length(proposed_title) BETWEEN 2 AND 80),
  ADD CONSTRAINT submissions_proposed_slug_format_check
    CHECK (proposed_slug IS NULL OR proposed_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
