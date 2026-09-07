ALTER TABLE knowledge_domains
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE topics
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

INSERT INTO policy_config (key, value)
VALUES (
  'ai.runtime',
  '{"provider":"rules","model":"deterministic-placeholder","baseUrl":null,"maxInputChars":12000,"maxOutputTokens":800}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
