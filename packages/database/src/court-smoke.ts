import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabasePool } from './client.js';

// Run against an initialized local/test database. Every write is rolled back.
const pool = createDatabasePool({ connectionLimit: 1 });
const client = await pool.connect();
try {
  await client.query('START TRANSACTION');
  const author = randomUUID(), voter = randomUUID(), caseId = randomUUID();
  for (const id of [author, voter]) {
    await client.query('INSERT INTO app_users (id, public_handle, display_name) VALUES ($1,$2,$3)', [id, `court-${id.slice(0, 20)}`, '法庭烟测']);
  }
  await client.query('INSERT INTO court_cases (id,author_id,title,story,category,demand) VALUES ($1,$2,$3,$4,$5,$6)', [caseId, author, '蛋糕案', '最后一口蛋糕不见了', '恋爱', '赔一份蛋糕']);
  const pending = await client.query<{ status: string }>('SELECT status FROM court_cases WHERE id=$1', [caseId]);
  assert.equal(pending.rows[0]?.status, 'pending');
  await client.query("UPDATE court_cases SET status='open' WHERE id=$1 AND status='pending'", [caseId]);
  for (const choice of ['plaintiff', 'peace']) {
    await client.query('INSERT INTO court_votes (case_id,user_id,choice) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE choice=$3', [caseId, voter, choice]);
  }
  const votes = await client.query<{ choice: string }>('SELECT choice FROM court_votes WHERE case_id=$1', [caseId]);
  assert.equal(votes.rows.length, 1);
  assert.equal(votes.rows[0]?.choice, 'peace');
  const comment = randomUUID();
  await client.query('INSERT INTO court_comments (id,case_id,user_id,role,content) VALUES ($1,$2,$3,$4,$5)', [comment, caseId, voter, '和事佬', '一人一半吧']);
  assert.equal((await client.query<{ status: string }>('SELECT status FROM court_comments WHERE id=$1', [comment])).rows[0]?.status, 'pending');
  await client.query("UPDATE court_comments SET status='approved' WHERE id=$1", [comment]);
  await client.query("UPDATE court_cases SET status='closed',resolution='笑场撤诉' WHERE id=$1 AND author_id=$2 AND status='open'", [caseId, author]);
  assert.equal((await client.query<{ status: string }>('SELECT status FROM court_cases WHERE id=$1', [caseId])).rows[0]?.status, 'closed');
  console.log('Court MySQL smoke passed (all writes rolled back).');
} finally {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
}
