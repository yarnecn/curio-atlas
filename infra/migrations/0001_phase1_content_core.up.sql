CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_handle text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'reviewer', 'owner')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES knowledge_domains(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX topics_domain_id_idx ON topics(domain_id);

CREATE TABLE interest_topics (
  interest_id uuid NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  PRIMARY KEY (interest_id, topic_id)
);

CREATE TABLE sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher text NOT NULL,
  title text NOT NULL,
  url text,
  source_type text NOT NULL CHECK (source_type IN ('official', 'research', 'open_education', 'licensed_media', 'community', 'internal')),
  license text NOT NULL DEFAULT 'unknown',
  published_at timestamptz,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (url, checksum)
);

CREATE TABLE realtime_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES topics(id) ON DELETE SET NULL,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'discovered'
    CHECK (status IN ('discovered', 'fetched', 'normalized', 'screened', 'visible_realtime', 'held', 'expired')),
  occurred_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX realtime_items_status_created_idx ON realtime_items(status, created_at DESC);

CREATE TABLE hot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'tracking' CHECK (status IN ('tracking', 'stable', 'archived')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hot_event_items (
  hot_event_id uuid NOT NULL REFERENCES hot_events(id) ON DELETE CASCADE,
  realtime_item_id uuid NOT NULL REFERENCES realtime_items(id) ON DELETE CASCADE,
  PRIMARY KEY (hot_event_id, realtime_item_id)
);

CREATE TABLE submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'automated_screening', 'trial', 'expanded_trial', 'queued_for_review', 'merged', 'rejected', 'withdrawn', 'held')),
  current_revision_id uuid,
  useful_count integer NOT NULL DEFAULT 0 CHECK (useful_count >= 0),
  not_useful_count integer NOT NULL DEFAULT 0 CHECK (not_useful_count >= 0),
  valid_vote_count integer NOT NULL DEFAULT 0 CHECK (valid_vote_count >= 0),
  usefulness_rate numeric(6, 5) NOT NULL DEFAULT 0 CHECK (usefulness_rate >= 0 AND usefulness_rate <= 1),
  trial_started_at timestamptz,
  review_queued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX submissions_status_created_idx ON submissions(status, created_at DESC);
CREATE INDEX submissions_topic_status_idx ON submissions(topic_id, status);

CREATE TABLE submission_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  statement text NOT NULL,
  why_useful text NOT NULL,
  applicability text NOT NULL,
  source_url text,
  experience_based boolean NOT NULL DEFAULT false,
  ai_disclosure boolean NOT NULL DEFAULT false,
  ai_refined_statement text,
  ai_risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_model text,
  ai_prompt_version text,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, version)
);

ALTER TABLE submissions
  ADD CONSTRAINT submissions_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES submission_revisions(id) ON DELETE RESTRICT;

CREATE TABLE submission_votes (
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  value text NOT NULL CHECK (value IN ('useful', 'not_useful')),
  is_valid boolean NOT NULL DEFAULT true,
  invalid_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (submission_id, user_id)
);

CREATE INDEX submission_votes_submission_valid_idx ON submission_votes(submission_id, is_valid);

CREATE TABLE knowledge_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  stability_level text NOT NULL DEFAULT 'stable' CHECK (stability_level IN ('stable', 'periodic', 'volatile')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  current_revision_id uuid,
  created_from_submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  next_review_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_nodes_topic_status_idx ON knowledge_nodes(topic_id, status);

CREATE TABLE knowledge_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  content_blocks jsonb NOT NULL,
  change_summary text NOT NULL,
  author_id uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  reviewer_id uuid REFERENCES app_users(id) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'pending_review', 'approved', 'published', 'superseded', 'archived')),
  ai_involvement text NOT NULL DEFAULT 'none' CHECK (ai_involvement IN ('none', 'assisted', 'generated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  UNIQUE (knowledge_node_id, version)
);

ALTER TABLE knowledge_nodes
  ADD CONSTRAINT knowledge_nodes_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES knowledge_revisions(id) ON DELETE RESTRICT;

CREATE TABLE claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_revision_id uuid NOT NULL REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
  statement text NOT NULL,
  source_id uuid NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  evidence_locator text NOT NULL DEFAULT '',
  confidence numeric(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  valid_from timestamptz,
  valid_to timestamptz,
  verified_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX claims_revision_idx ON claims(knowledge_revision_id);
CREATE INDEX claims_source_idx ON claims(source_id);

CREATE TABLE knowledge_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  to_node_id uuid NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('prerequisite_of', 'part_of', 'causes', 'influences', 'contrasts_with', 'located_in', 'occurred_during', 'succeeded_by', 'explains', 'related_to')),
  strength numeric(4, 3) NOT NULL DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  evidence_source_id uuid REFERENCES sources(id) ON DELETE SET NULL,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_node_id <> to_node_id),
  UNIQUE (from_node_id, to_node_id, relation_type)
);

CREATE TABLE ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  provider text,
  model text,
  prompt_version text,
  input_tokens integer CHECK (input_tokens >= 0),
  output_tokens integer CHECK (output_tokens >= 0),
  cost_minor_units integer CHECK (cost_minor_units >= 0),
  result jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_jobs_status_created_idx ON ai_jobs(status, created_at);
CREATE INDEX ai_jobs_entity_idx ON ai_jobs(entity_type, entity_id);

CREATE TABLE approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  requested_by_type text NOT NULL CHECK (requested_by_type IN ('user', 'ai', 'system')),
  requested_by_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

CREATE INDEX approval_requests_status_created_idx ON approval_requests(status, created_at);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('submission', 'knowledge_node', 'realtime_item')),
  entity_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('illegal', 'factual_error', 'outdated', 'unsupported', 'copyright', 'privacy', 'safety', 'other')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX content_reports_status_created_idx ON content_reports(status, created_at);

CREATE TABLE policy_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_type text NOT NULL CHECK (actor_type IN ('user', 'ai', 'system')),
  actor_id text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_entity_created_idx ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_actor_created_idx ON audit_logs(actor_type, actor_id, created_at DESC);

INSERT INTO policy_config (key, value)
VALUES
  ('submission.expanded_trial', '{"minimumUseful":5,"minimumNetUseful":4,"minimumUsefulnessRate":0.7}'::jsonb),
  ('submission.review_queue', '{"minimumValidVotes":20,"minimumUsefulnessRate":0.8}'::jsonb),
  ('ai.budget', '{"dailyMinorUnits":0,"monthlyMinorUnits":0,"warningRate":0.7,"degradeRate":0.9}'::jsonb);
