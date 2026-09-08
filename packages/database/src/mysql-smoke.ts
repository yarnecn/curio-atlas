import assert from 'node:assert/strict';
import { closeDatabasePool, createDatabasePool } from './client.js';
import { Phase1Repository } from './phase1-repository.js';

const pool = createDatabasePool({ connectionLimit: 2 });
const repository = new Phase1Repository(pool);
const suffix = Date.now().toString(36);
const publicHandle = `mysql-smoke-${suffix}`;
const password = `Smoke-${suffix}-pass`;
let userId: string | null = null;
const submissionIds: string[] = [];
let knowledgeNodeId: string | null = null;
const sourceUrls: string[] = [];

async function completeRulesScreening(aiJobId: string, submissionId: string, refinedStatement: string): Promise<void> {
  await repository.startAiScreening(aiJobId);
  await repository.completeAiScreening(aiJobId, submissionId, {
    refinedStatement,
    riskFlags: [],
    provider: 'rules',
    model: 'deterministic-placeholder',
    inputTokens: 0,
    outputTokens: 0,
  });
}

try {
  const registered = await repository.registerAccount({ publicHandle, displayName: 'MySQL smoke', password });
  userId = registered.user.id;
  assert.equal((await repository.getSessionUser(registered.token))?.id, userId);

  const topic = (await repository.listTopics())[0];
  assert.ok(topic, '初始化后至少应有一个可用话题。');
  const created = await repository.createSubmission(userId, {
    topicId: topic.id,
    statement: 'MySQL 烟测用于确认投稿、AI 状态和登录链路可以真实写入数据库。',
    whyUseful: '它能发现只靠建表检查无法发现的字段默认值和 SQL 方言问题。',
    applicability: '只在自动化测试数据库中运行，不会发布到正式常识。',
    sourceUrl: 'https://example.com/mysql-smoke',
    experienceBased: false,
    aiDisclosure: true,
  });
  submissionIds.push(created.submission.id);
  assert.deepEqual((await repository.getCurrentSubmissionRevision(created.submission.id)).ai_risk_flags, []);

  await completeRulesScreening(created.aiJobId, created.submission.id, created.submission.statement);
  assert.equal((await repository.getSubmission(created.submission.id)).status, 'trial');
  const selfVote = await repository.recordVote(userId, created.submission.id, 'useful');
  assert.equal(selfVote.validVoteCount, 0);
  assert.equal(selfVote.status, 'trial');

  const loggedIn = await repository.loginAccount({ publicHandle, password });
  assert.equal(loggedIn.user.id, userId);
  await repository.deleteSession(loggedIn.token);

  const owners = await pool.query<{ id: string }>("SELECT id FROM app_users WHERE role = 'owner' ORDER BY created_at LIMIT 1");
  const ownerId = owners.rows[0]?.id;
  assert.ok(ownerId, '初始化后必须存在站长账号。');

  const firstSourceUrl = `https://example.com/mysql-smoke-owner-${suffix}`;
  sourceUrls.push(firstSourceUrl);
  const editorial = await repository.createInternalCandidate(ownerId, {
    topicId: topic.id,
    proposedTitle: 'MySQL 烟测常识',
    proposedSlug: `mysql-smoke-${suffix}`,
    statement: 'MySQL 业务烟测会真实执行审核发布，但测试结束后会删除产生的数据。',
    whyUseful: '它验证站长审核、正式版本、来源和审计记录能够在当前数据库方言下工作。',
    applicability: '只用于自动化测试数据库，不作为百科内容保留。',
    sourceUrl: firstSourceUrl,
    originType: 'admin_seed',
    triggerReason: '验证 MySQL 完整审核发布链路',
    aiDisclosure: true,
  });
  submissionIds.push(editorial.submission.id);
  await completeRulesScreening(editorial.aiJobId, editorial.submission.id, editorial.submission.statement);
  assert.equal((await repository.getSubmission(editorial.submission.id)).status, 'queued_for_review');
  const published = await repository.reviewSubmission(ownerId, editorial.submission.id, {
    decision: 'approve_new',
    reason: 'MySQL 烟测发布',
    title: 'MySQL 烟测常识',
    slug: `mysql-smoke-${suffix}`,
  });
  knowledgeNodeId = published.knowledgeNodeId;
  assert.ok(knowledgeNodeId, '批准新内容后必须返回正式常识 ID。');
  const publishedNode = await repository.getKnowledgeNodeBySlug(`mysql-smoke-${suffix}`);
  assert.equal(publishedNode.creatorKind, 'owner');

  const secondSourceUrl = `https://example.com/mysql-smoke-merge-${suffix}`;
  sourceUrls.push(secondSourceUrl);
  const revisionCandidate = await repository.createInternalCandidate(ownerId, {
    topicId: topic.id,
    proposedTitle: 'MySQL 烟测常识更新',
    proposedSlug: `mysql-smoke-update-${suffix}`,
    statement: '第二个烟测候选用于确认合并会创建新版本，而不是覆盖已经发布的版本。',
    whyUseful: '它可以同时验证版本号、来源 claim、审核记录以及后续回滚能力。',
    applicability: '只用于自动化测试数据库，执行结束后删除。',
    sourceUrl: secondSourceUrl,
    originType: 'maintenance',
    triggerReason: '验证 MySQL 合并和版本回滚链路',
    aiDisclosure: true,
  });
  submissionIds.push(revisionCandidate.submission.id);
  await completeRulesScreening(
    revisionCandidate.aiJobId,
    revisionCandidate.submission.id,
    revisionCandidate.submission.statement,
  );
  await repository.reviewSubmission(ownerId, revisionCandidate.submission.id, {
    decision: 'merge',
    reason: 'MySQL 烟测合并',
    targetKnowledgeNodeId: knowledgeNodeId,
  });
  const revisions = await repository.listKnowledgeRevisions(ownerId, knowledgeNodeId);
  assert.equal(revisions.length, 2);
  const original = revisions.find((revision) => revision.version === 1);
  assert.ok(original, '合并后必须保留最初版本。');
  const rollback = await repository.rollbackKnowledgeRevision(ownerId, knowledgeNodeId, {
    targetRevisionId: original.id,
    reason: 'MySQL 烟测回滚',
  });
  assert.equal(rollback.revision.version, 3);
  console.log('MySQL business smoke check passed.');
} finally {
  if (knowledgeNodeId) {
    await pool.query("DELETE FROM approval_requests WHERE entity_type = 'knowledge_node' AND entity_id = $1", [knowledgeNodeId]);
    await pool.query('DELETE FROM audit_logs WHERE entity_id = $1', [knowledgeNodeId]);
    await pool.query('DELETE FROM knowledge_nodes WHERE id = $1', [knowledgeNodeId]);
  }
  if (submissionIds.length > 0) {
    await pool.query("DELETE FROM approval_requests WHERE entity_type = 'submission' AND entity_id IN ($1)", [submissionIds]);
    await pool.query("DELETE FROM ai_jobs WHERE entity_type = 'submission' AND entity_id IN ($1)", [submissionIds]);
    await pool.query('DELETE FROM audit_logs WHERE entity_id IN ($1)', [submissionIds]);
    await pool.query('DELETE FROM submissions WHERE id IN ($1)', [submissionIds]);
  }
  if (sourceUrls.length > 0) {
    await pool.query('DELETE FROM sources WHERE url IN ($1)', [sourceUrls]);
  }
  if (userId) {
    await pool.query('DELETE FROM audit_logs WHERE actor_id = $1 OR entity_id = $1', [userId]);
    await pool.query('DELETE FROM app_users WHERE id = $1', [userId]);
  }
  await closeDatabasePool(pool);
}
