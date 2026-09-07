-- 端到端流程验收留下的知识节点不属于 V1 正式目录，保留历史但不再对外展示或计数。
UPDATE knowledge_nodes
SET status = 'archived', updated_at = now()
WHERE slug = 'map-scale-and-detail-e2e'
  AND title = '地图比例尺与细节'
  AND created_from_submission_id IS NOT NULL;
