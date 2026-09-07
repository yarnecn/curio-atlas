ALTER TABLE knowledge_relations
  ADD COLUMN origin text NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual', 'ai_suggested', 'system_auto'));

WITH ordered AS (
  SELECT kn.id,
         lag(kn.id) OVER (PARTITION BY t.domain_id ORDER BY t.sort_order, kn.created_at, kn.id) AS previous_id
  FROM knowledge_nodes kn
  JOIN topics t ON t.id = kn.topic_id
  WHERE kn.status = 'published'
)
INSERT INTO knowledge_relations (from_node_id, to_node_id, relation_type, strength, origin)
SELECT previous_id, id, 'related_to', 0.55, 'system_auto'
FROM ordered
WHERE previous_id IS NOT NULL
ON CONFLICT (from_node_id, to_node_id, relation_type) DO NOTHING;
