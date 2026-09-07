CREATE TABLE source_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  name text NOT NULL,
  publisher text NOT NULL,
  url text NOT NULL UNIQUE,
  source_type text NOT NULL CHECK (source_type IN ('official', 'research', 'open_education')),
  license text NOT NULL DEFAULT 'link_and_fact_reference_only',
  is_active boolean NOT NULL DEFAULT true,
  check_interval_hours integer NOT NULL DEFAULT 168 CHECK (check_interval_hours BETWEEN 1 AND 8760),
  etag text,
  last_modified text,
  last_content_hash text,
  last_checked_at timestamptz,
  next_check_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_by uuid NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX source_feeds_due_idx ON source_feeds(next_check_at) WHERE is_active = true;

CREATE TABLE source_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_feed_id uuid NOT NULL REFERENCES source_feeds(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  page_title text NOT NULL,
  final_url text NOT NULL,
  evidence_text text NOT NULL,
  http_status integer NOT NULL,
  etag text,
  last_modified text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_feed_id, content_hash)
);

CREATE TABLE evidence_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id uuid NOT NULL UNIQUE REFERENCES source_snapshots(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'drafting', 'candidate_created', 'held', 'dismissed')),
  task_type text NOT NULL DEFAULT 'source_update'
    CHECK (task_type IN ('source_discovery', 'source_update', 'coverage_gap')),
  evidence_text text NOT NULL,
  candidate_submission_id uuid REFERENCES submissions(id) ON DELETE SET NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evidence_packages_status_created_idx ON evidence_packages(status, created_at);
