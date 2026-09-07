DROP INDEX source_feeds_due_idx;
CREATE INDEX source_feeds_due_idx ON source_feeds(next_check_at) WHERE is_active = true;

ALTER TABLE source_snapshots DROP COLUMN discovered_urls;
ALTER TABLE source_feeds
  DROP COLUMN scan_requested,
  DROP COLUMN auto_scan,
  DROP COLUMN max_pages_per_scan,
  DROP COLUMN crawl_mode;
