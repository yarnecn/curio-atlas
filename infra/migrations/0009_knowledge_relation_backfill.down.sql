DELETE FROM knowledge_relations WHERE origin = 'system_auto';
ALTER TABLE knowledge_relations DROP COLUMN origin;
