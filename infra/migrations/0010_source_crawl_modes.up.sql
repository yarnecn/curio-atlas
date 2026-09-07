ALTER TABLE source_feeds
  ADD COLUMN crawl_mode text NOT NULL DEFAULT 'single_page'
    CHECK (crawl_mode IN ('single_page', 'website')),
  ADD COLUMN max_pages_per_scan integer NOT NULL DEFAULT 1
    CHECK (max_pages_per_scan BETWEEN 1 AND 20),
  ADD COLUMN auto_scan boolean NOT NULL DEFAULT false,
  ADD COLUMN scan_requested boolean NOT NULL DEFAULT false;

ALTER TABLE source_snapshots
  ADD COLUMN discovered_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP INDEX source_feeds_due_idx;
CREATE INDEX source_feeds_due_idx
  ON source_feeds(next_check_at)
  WHERE is_active = true AND (auto_scan = true OR scan_requested = true);
