CREATE TABLE IF NOT EXISTS app_metadata (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` VARCHAR(255) NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  public_handle VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  role ENUM('user', 'reviewer', 'owner') NOT NULL DEFAULT 'user',
  verification_status ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge_domains (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topics (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  domain_id CHAR(36) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  v1_target_count INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX topics_domain_id_idx (domain_id),
  CONSTRAINT topics_domain_fk FOREIGN KEY (domain_id) REFERENCES knowledge_domains(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS interest_topics (
  interest_id CHAR(36) NOT NULL,
  topic_id CHAR(36) NOT NULL,
  PRIMARY KEY (interest_id, topic_id),
  CONSTRAINT interest_topics_interest_fk FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE,
  CONSTRAINT interest_topics_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sources (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  publisher VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  url TEXT,
  source_type ENUM('official', 'research', 'open_education', 'licensed_media', 'community', 'internal') NOT NULL,
  license VARCHAR(255) NOT NULL DEFAULT 'unknown',
  published_at DATETIME(3),
  accessed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  checksum VARCHAR(128),
  dedupe_key CHAR(64) GENERATED ALWAYS AS (SHA2(CONCAT(COALESCE(url, '<null>'), '|', COALESCE(checksum, '<null>')), 256)) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY sources_dedupe_key (dedupe_key)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS realtime_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  topic_id CHAR(36),
  source_id CHAR(36) NOT NULL,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('discovered', 'fetched', 'normalized', 'screened', 'visible_realtime', 'held', 'expired') NOT NULL DEFAULT 'discovered',
  occurred_at DATETIME(3),
  expires_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX realtime_items_status_created_idx (status, created_at DESC),
  CONSTRAINT realtime_items_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL,
  CONSTRAINT realtime_items_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hot_events (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  summary TEXT NOT NULL,
  status ENUM('tracking', 'stable', 'archived') NOT NULL DEFAULT 'tracking',
  started_at DATETIME(3),
  ended_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS hot_event_items (
  hot_event_id CHAR(36) NOT NULL,
  realtime_item_id CHAR(36) NOT NULL,
  PRIMARY KEY (hot_event_id, realtime_item_id),
  CONSTRAINT hot_event_items_event_fk FOREIGN KEY (hot_event_id) REFERENCES hot_events(id) ON DELETE CASCADE,
  CONSTRAINT hot_event_items_item_fk FOREIGN KEY (realtime_item_id) REFERENCES realtime_items(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submissions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  author_id CHAR(36) NOT NULL,
  topic_id CHAR(36) NOT NULL,
  status ENUM('submitted', 'automated_screening', 'trial', 'expanded_trial', 'queued_for_review', 'merged', 'rejected', 'withdrawn', 'held') NOT NULL DEFAULT 'submitted',
  origin_type ENUM('user_submission', 'source_discovery', 'coverage_gap', 'maintenance', 'admin_seed') NOT NULL DEFAULT 'user_submission',
  trigger_reason TEXT,
  proposed_title VARCHAR(80),
  proposed_slug VARCHAR(160),
  current_revision_id CHAR(36),
  useful_count INT NOT NULL DEFAULT 0,
  not_useful_count INT NOT NULL DEFAULT 0,
  valid_vote_count INT NOT NULL DEFAULT 0,
  usefulness_rate DECIMAL(6,5) NOT NULL DEFAULT 0,
  trial_started_at DATETIME(3),
  review_queued_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX submissions_status_created_idx (status, created_at DESC),
  INDEX submissions_topic_status_idx (topic_id, status),
  INDEX submissions_origin_status_idx (origin_type, status, created_at DESC),
  CONSTRAINT submissions_author_fk FOREIGN KEY (author_id) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT submissions_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submission_revisions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  submission_id CHAR(36) NOT NULL,
  version INT NOT NULL,
  statement TEXT NOT NULL,
  why_useful TEXT NOT NULL,
  applicability TEXT NOT NULL,
  source_url TEXT,
  experience_based BOOLEAN NOT NULL DEFAULT FALSE,
  ai_disclosure BOOLEAN NOT NULL DEFAULT FALSE,
  ai_refined_statement TEXT,
  ai_risk_flags JSON NOT NULL DEFAULT (JSON_ARRAY()),
  ai_model VARCHAR(255),
  ai_prompt_version VARCHAR(100),
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY submission_revisions_version (submission_id, version),
  CONSTRAINT submission_revisions_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT submission_revisions_creator_fk FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS submission_votes (
  submission_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  value ENUM('useful', 'not_useful') NOT NULL,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  invalid_reason VARCHAR(255),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (submission_id, user_id),
  INDEX submission_votes_submission_valid_idx (submission_id, is_valid),
  CONSTRAINT submission_votes_submission_fk FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  CONSTRAINT submission_votes_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  topic_id CHAR(36) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  stability_level ENUM('stable', 'periodic', 'volatile') NOT NULL DEFAULT 'stable',
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  current_revision_id CHAR(36),
  created_from_submission_id CHAR(36),
  next_review_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX knowledge_nodes_topic_status_idx (topic_id, status),
  CONSTRAINT knowledge_nodes_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT knowledge_nodes_submission_fk FOREIGN KEY (created_from_submission_id) REFERENCES submissions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge_revisions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  knowledge_node_id CHAR(36) NOT NULL,
  version INT NOT NULL,
  content_blocks JSON NOT NULL,
  change_summary TEXT NOT NULL,
  author_id CHAR(36) NOT NULL,
  reviewer_id CHAR(36),
  review_status ENUM('draft', 'pending_review', 'approved', 'published', 'superseded', 'archived') NOT NULL DEFAULT 'draft',
  ai_involvement ENUM('none', 'assisted', 'generated') NOT NULL DEFAULT 'none',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  published_at DATETIME(3),
  UNIQUE KEY knowledge_revisions_version (knowledge_node_id, version),
  CONSTRAINT knowledge_revisions_node_fk FOREIGN KEY (knowledge_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_revisions_author_fk FOREIGN KEY (author_id) REFERENCES app_users(id) ON DELETE RESTRICT,
  CONSTRAINT knowledge_revisions_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS claims (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  knowledge_revision_id CHAR(36) NOT NULL,
  statement TEXT NOT NULL,
  source_id CHAR(36) NOT NULL,
  evidence_locator TEXT NOT NULL,
  confidence DECIMAL(4,3),
  valid_from DATETIME(3),
  valid_to DATETIME(3),
  verified_by CHAR(36),
  verified_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX claims_revision_idx (knowledge_revision_id),
  INDEX claims_source_idx (source_id),
  CONSTRAINT claims_revision_fk FOREIGN KEY (knowledge_revision_id) REFERENCES knowledge_revisions(id) ON DELETE CASCADE,
  CONSTRAINT claims_source_fk FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT,
  CONSTRAINT claims_verifier_fk FOREIGN KEY (verified_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  from_node_id CHAR(36) NOT NULL,
  to_node_id CHAR(36) NOT NULL,
  relation_type ENUM('prerequisite_of', 'part_of', 'causes', 'influences', 'contrasts_with', 'located_in', 'occurred_during', 'succeeded_by', 'explains', 'related_to') NOT NULL,
  strength DECIMAL(4,3) NOT NULL DEFAULT 0.5,
  evidence_source_id CHAR(36),
  valid_from DATETIME(3),
  valid_to DATETIME(3),
  origin ENUM('manual', 'ai_suggested', 'system_auto') NOT NULL DEFAULT 'manual',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY knowledge_relations_unique (from_node_id, to_node_id, relation_type),
  CONSTRAINT knowledge_relations_from_fk FOREIGN KEY (from_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_relations_to_fk FOREIGN KEY (to_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  CONSTRAINT knowledge_relations_source_fk FOREIGN KEY (evidence_source_id) REFERENCES sources(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_jobs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  status ENUM('queued', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
  provider VARCHAR(100),
  model VARCHAR(255),
  prompt_version VARCHAR(100),
  input_tokens INT,
  output_tokens INT,
  cost_minor_units INT,
  result JSON,
  error_message TEXT,
  started_at DATETIME(3),
  finished_at DATETIME(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX ai_jobs_status_created_idx (status, created_at),
  INDEX ai_jobs_entity_idx (entity_type, entity_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS approval_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  action_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id CHAR(36) NOT NULL,
  requested_by_type ENUM('user', 'ai', 'system') NOT NULL,
  requested_by_id CHAR(36),
  status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  payload JSON NOT NULL DEFAULT (JSON_OBJECT()),
  decided_by CHAR(36),
  decision_reason TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  decided_at DATETIME(3),
  INDEX approval_requests_status_created_idx (status, created_at),
  CONSTRAINT approval_requests_decider_fk FOREIGN KEY (decided_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS content_reports (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  reporter_id CHAR(36),
  entity_type ENUM('submission', 'knowledge_node', 'realtime_item') NOT NULL,
  entity_id CHAR(36) NOT NULL,
  reason ENUM('illegal', 'factual_error', 'outdated', 'unsupported', 'copyright', 'privacy', 'safety', 'other') NOT NULL,
  details TEXT NOT NULL,
  status ENUM('open', 'reviewing', 'resolved', 'dismissed') NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3),
  INDEX content_reports_status_created_idx (status, created_at),
  CONSTRAINT content_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS policy_config (
  `key` VARCHAR(160) PRIMARY KEY,
  `value` JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_by CHAR(36),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT policy_config_updater_fk FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_type ENUM('user', 'ai', 'system') NOT NULL,
  actor_id VARCHAR(255) NOT NULL,
  action VARCHAR(160) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  before_data JSON,
  after_data JSON,
  reason TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX audit_logs_entity_created_idx (entity_type, entity_id, created_at DESC),
  INDEX audit_logs_actor_created_idx (actor_type, actor_id, created_at DESC)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS source_feeds (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  topic_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  publisher VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  url_hash CHAR(64) GENERATED ALWAYS AS (SHA2(url, 256)) STORED,
  source_type ENUM('official', 'research', 'open_education') NOT NULL,
  crawl_mode ENUM('single_page', 'website') NOT NULL DEFAULT 'single_page',
  max_pages_per_scan INT NOT NULL DEFAULT 1,
  auto_scan BOOLEAN NOT NULL DEFAULT FALSE,
  scan_requested BOOLEAN NOT NULL DEFAULT FALSE,
  license VARCHAR(255) NOT NULL DEFAULT 'link_and_fact_reference_only',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  check_interval_hours INT NOT NULL DEFAULT 168,
  etag TEXT,
  last_modified TEXT,
  last_content_hash VARCHAR(128),
  last_checked_at DATETIME(3),
  next_check_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_error TEXT,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY source_feeds_url_hash (url_hash),
  INDEX source_feeds_due_idx (is_active, auto_scan, scan_requested, next_check_at),
  CONSTRAINT source_feeds_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT source_feeds_creator_fk FOREIGN KEY (created_by) REFERENCES app_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS source_snapshots (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  source_feed_id CHAR(36) NOT NULL,
  content_hash VARCHAR(128) NOT NULL,
  page_title VARCHAR(500) NOT NULL,
  final_url TEXT NOT NULL,
  evidence_text MEDIUMTEXT NOT NULL,
  http_status INT NOT NULL,
  etag TEXT,
  last_modified TEXT,
  discovered_urls JSON NOT NULL DEFAULT (JSON_ARRAY()),
  fetched_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY source_snapshots_content (source_feed_id, content_hash),
  CONSTRAINT source_snapshots_feed_fk FOREIGN KEY (source_feed_id) REFERENCES source_feeds(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS evidence_packages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  source_snapshot_id CHAR(36) NOT NULL UNIQUE,
  topic_id CHAR(36) NOT NULL,
  status ENUM('ready', 'drafting', 'candidate_created', 'held', 'dismissed') NOT NULL DEFAULT 'ready',
  task_type ENUM('source_discovery', 'source_update', 'coverage_gap') NOT NULL DEFAULT 'source_update',
  evidence_text MEDIUMTEXT NOT NULL,
  candidate_submission_id CHAR(36),
  error_message TEXT,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX evidence_packages_status_created_idx (status, created_at),
  CONSTRAINT evidence_packages_snapshot_fk FOREIGN KEY (source_snapshot_id) REFERENCES source_snapshots(id) ON DELETE CASCADE,
  CONSTRAINT evidence_packages_topic_fk FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT evidence_packages_submission_fk FOREIGN KEY (candidate_submission_id) REFERENCES submissions(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id CHAR(36) PRIMARY KEY,
  password_hash TEXT NOT NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  first_failed_at DATETIME(3),
  locked_until DATETIME(3),
  password_changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT auth_credentials_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX user_sessions_user_id_idx (user_id),
  INDEX user_sessions_expires_at_idx (expires_at),
  CONSTRAINT user_sessions_user_fk FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
