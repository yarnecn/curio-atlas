DELETE FROM policy_config WHERE key = 'ai.runtime';

ALTER TABLE topics
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS sort_order;

ALTER TABLE knowledge_domains
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS is_active;
