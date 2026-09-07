ALTER TABLE topics
  ADD COLUMN v1_target_count integer NOT NULL DEFAULT 0
  CHECK (v1_target_count >= 0);

UPDATE topics
SET v1_target_count = CASE slug
  WHEN 'world-geography' THEN 35
  WHEN 'china-geography' THEN 35
  WHEN 'china-history' THEN 60
  WHEN 'economy-basics' THEN 20
  WHEN 'social-systems' THEN 15
  ELSE 0
END;
