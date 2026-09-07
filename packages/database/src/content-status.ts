import { createDatabasePool } from './client.js';

const pool = createDatabasePool();

try {
  const result = await pool.query<{
    name: string;
    v1_target_count: number;
    published: string;
    queued: string;
    reviewable: string;
  }>(`
    SELECT
      t.name,
      t.v1_target_count,
      count(DISTINCT kn.id) FILTER (WHERE kn.status = 'published') AS published,
      count(DISTINCT s.id) FILTER (WHERE s.status = 'queued_for_review') AS queued,
      count(DISTINCT s.id) FILTER (
        WHERE s.status = 'queued_for_review' AND s.current_revision_id IS NOT NULL
      ) AS reviewable
    FROM topics t
    LEFT JOIN knowledge_nodes kn ON kn.topic_id = t.id
    LEFT JOIN submissions s ON s.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `);

  console.table(result.rows.map((row) => ({
    话题: row.name,
    已发布: Number(row.published),
    待审核: Number(row.queued),
    可审核: Number(row.reviewable),
    V1目标: row.v1_target_count,
  })));
} finally {
  await pool.end();
}
