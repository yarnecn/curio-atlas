import { createHash, randomBytes, randomUUID, scrypt as nodeScrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type {
  AiRuntimeConfigView,
  AuthUserView,
  BulkCreateSourceFeedsInput,
  CreateKnowledgeDomainInput,
  CreateSourceFeedInput,
  CreateInternalCandidateInput,
  CreateSubmissionInput,
  CreateTopicInput,
  KnowledgeContentSection,
  KnowledgeCreatorKind,
  KnowledgeNodeDetail,
  KnowledgeNodeSummary,
  KnowledgeRevisionSummary,
  LoginInput,
  RegisterAccountInput,
  ReviewSubmissionInput,
  RollbackKnowledgeInput,
  RollbackKnowledgeResponse,
  SubmissionOriginType,
  SubmissionStatus,
  SubmissionView,
  SourceOperationsView,
  TaxonomyAdminView,
  TopicSummary,
  UpdateAiRuntimeConfigInput,
  UpdateKnowledgeDomainInput,
  UpdateSourceFeedInput,
  UpdateTopicInput,
  UserRole,
  VoteValue,
} from '@knowledge-map/contracts';
import { knowledgeContentSchema, type KnowledgeContent } from '@knowledge-map/content-schema';
import {
  assertSubmissionTransition,
  calculateVoteMetrics,
  nextStatusAfterVote,
  SUBMISSION_THRESHOLDS,
  type SubmissionThresholds,
} from '@knowledge-map/domain';
import { inTransaction, oneOrNull, type Pool, type PoolClient } from './client.js';

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function derivePasswordKey(password: string, salt: Buffer, length: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export interface AuthSessionResult {
  user: AuthUserView;
  token: string;
  expiresAt: Date;
}

interface AuthAccountRow {
  id: string;
  public_handle: string;
  display_name: string;
  role: AuthUserView['role'];
  password_hash: string;
  locked_until: Date | null;
}

function mapAuthUser(row: Pick<AuthAccountRow, 'id' | 'public_handle' | 'display_name' | 'role'>): AuthUserView {
  return { id: row.id, publicHandle: row.public_handle, displayName: row.display_name, role: row.role };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derivePasswordKey(password, salt, 64, { cost: 32768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, costText, blockText, parallelText, saltText, hashText] = encoded.split('$');
  if (algorithm !== 'scrypt' || !costText || !blockText || !parallelText || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, 'base64url');
    const actual = await derivePasswordKey(password, Buffer.from(saltText, 'base64url'), expected.length, {
      cost: Number(costText), blockSize: Number(blockText), parallelization: Number(parallelText), maxmem: 64 * 1024 * 1024,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

function sessionHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const fallbackPasswordHash = hashPassword('invalid-account-password');

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && error.code === 'ER_DUP_ENTRY';
}

interface SubmissionRow {
  id: string;
  author_handle: string;
  origin_type: SubmissionOriginType;
  trigger_reason: string | null;
  proposed_title: string | null;
  proposed_slug: string | null;
  topic_id: string;
  topic_slug: string;
  topic_name: string;
  domain_slug: string;
  domain_name: string;
  topic_v1_target_count: number;
  status: SubmissionStatus;
  statement: string;
  ai_refined_statement: string | null;
  why_useful: string;
  applicability: string;
  source_url: string | null;
  experience_based: boolean;
  ai_disclosure: boolean;
  ai_risk_flags: string[];
  useful_count: number;
  not_useful_count: number;
  valid_vote_count: number;
  usefulness_rate: string | number;
  created_at: Date;
  updated_at: Date;
}

interface LockedSubmissionRow {
  id: string;
  author_id: string;
  topic_id: string;
  origin_type: SubmissionOriginType;
  status: SubmissionStatus;
  current_revision_id: string;
}

interface CurrentRevisionRow {
  id: string;
  statement: string;
  ai_refined_statement: string | null;
  why_useful: string;
  applicability: string;
  source_url: string | null;
  experience_based: boolean;
  ai_disclosure: boolean;
  ai_risk_flags: string[];
}

interface KnowledgeRevisionRow {
  id: string;
  knowledge_node_id: string;
  version: number;
  change_summary: string;
  review_status: KnowledgeRevisionSummary['reviewStatus'];
  ai_involvement: KnowledgeRevisionSummary['aiInvolvement'];
  published_at: Date | null;
  is_current: boolean;
}

interface KnowledgeNodeRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content_blocks: unknown;
  topic_id: string;
  topic_name: string;
  domain_slug: string;
  domain_name: string;
  published_at: Date | null;
  creator_origin_type: SubmissionOriginType | null;
  creator_role: UserRole | null;
  creator_handle: string | null;
}

export interface QueuedAiScreeningJob {
  aiJobId: string;
  submissionId: string;
}

export interface DueSourceFeed {
  id: string;
  topicId: string;
  topicName: string;
  topicDescription: string;
  name: string;
  url: string;
  crawlMode: 'single_page' | 'website';
  maxPagesPerScan: number;
  etag: string | null;
  lastModified: string | null;
  createdBy: string;
}

export interface SourceFetchResult {
  status: 'changed' | 'unchanged' | 'failed';
  httpStatus?: number;
  finalUrl?: string;
  pageTitle?: string;
  contentHash?: string;
  etag?: string | null;
  lastModified?: string | null;
  evidenceText?: string;
  discoveredUrls?: string[];
  error?: string;
}

export interface ReadyEvidencePackage {
  id: string;
  topicId: string;
  topicName: string;
  topicDescription: string;
  feedName: string;
  publisher: string;
  sourceUrl: string;
  pageTitle: string;
  evidenceText: string;
  createdBy: string;
}

const submissionSelect = `
  SELECT
    s.id,
    u.public_handle AS author_handle,
    s.origin_type,
    s.trigger_reason,
    s.proposed_title,
    s.proposed_slug,
    t.id AS topic_id,
    t.slug AS topic_slug,
    t.name AS topic_name,
    d.slug AS domain_slug,
    d.name AS domain_name,
    t.v1_target_count AS topic_v1_target_count,
    s.status,
    sr.statement,
    sr.ai_refined_statement,
    sr.why_useful,
    sr.applicability,
    sr.source_url,
    sr.experience_based,
    sr.ai_disclosure,
    sr.ai_risk_flags,
    s.useful_count,
    s.not_useful_count,
    s.valid_vote_count,
    s.usefulness_rate,
    s.created_at,
    s.updated_at
  FROM submissions s
  JOIN submission_revisions sr ON sr.id = s.current_revision_id
  JOIN app_users u ON u.id = s.author_id
  JOIN topics t ON t.id = s.topic_id
  JOIN knowledge_domains d ON d.id = t.domain_id
`;

export class ContentRepositoryError extends Error {
  constructor(
    readonly code: 'not_found' | 'unauthorized' | 'forbidden' | 'conflict' | 'invalid_state' | 'validation',
    message: string,
  ) {
    super(message);
    this.name = 'ContentRepositoryError';
  }
}

export function nextStatusAfterAiScreening(
  originType: SubmissionOriginType,
  riskFlags: readonly string[],
): SubmissionStatus {
  if (riskFlags.length > 0) return 'held';
  return originType === 'user_submission' ? 'trial' : 'queued_for_review';
}

function mapSubmission(row: SubmissionRow): SubmissionView {
  return {
    id: row.id,
    authorHandle: row.author_handle,
    originType: row.origin_type,
    triggerReason: row.trigger_reason,
    proposedTitle: row.proposed_title,
    proposedSlug: row.proposed_slug,
    topic: {
      id: row.topic_id,
      slug: row.topic_slug,
      name: row.topic_name,
      domainSlug: row.domain_slug,
      domainName: row.domain_name,
      v1TargetCount: row.topic_v1_target_count,
    },
    status: row.status,
    statement: row.statement,
    displayStatement: row.ai_refined_statement ?? row.statement,
    whyUseful: row.why_useful,
    applicability: row.applicability,
    sourceUrl: row.source_url,
    experienceBased: row.experience_based,
    aiDisclosure: row.ai_disclosure,
    aiRiskFlags: row.ai_risk_flags,
    usefulCount: row.useful_count,
    notUsefulCount: row.not_useful_count,
    validVoteCount: row.valid_vote_count,
    usefulnessRate: Number(row.usefulness_rate),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapKnowledgeRevision(row: KnowledgeRevisionRow): KnowledgeRevisionSummary {
  return {
    id: row.id,
    knowledgeNodeId: row.knowledge_node_id,
    version: row.version,
    changeSummary: row.change_summary,
    reviewStatus: row.review_status,
    aiInvolvement: row.ai_involvement,
    publishedAt: row.published_at?.toISOString() ?? null,
    isCurrent: row.is_current,
  };
}

function firstParagraph(contentBlocks: unknown): string | null {
  if (!Array.isArray(contentBlocks)) return null;
  const block = contentBlocks.find((item) => (
    typeof item === 'object'
    && item !== null
    && 'type' in item
    && item.type === 'paragraph'
    && 'text' in item
    && typeof item.text === 'string'
  ));
  return block && typeof block === 'object' && 'text' in block && typeof block.text === 'string'
    ? block.text
    : null;
}

function knowledgeSections(contentBlocks: unknown, fallback: string): KnowledgeContentSection[] {
  if (!Array.isArray(contentBlocks)) return [{ heading: null, paragraphs: [fallback] }];
  const sections: KnowledgeContentSection[] = [];
  let current: KnowledgeContentSection = { heading: null, paragraphs: [] };
  for (const block of contentBlocks) {
    if (!block || typeof block !== 'object' || !('type' in block)) continue;
    if (block.type === 'heading' && 'text' in block && typeof block.text === 'string') {
      if (current.paragraphs.length > 0) sections.push(current);
      current = { heading: block.text, paragraphs: [] };
    }
    if (block.type === 'paragraph' && 'text' in block && typeof block.text === 'string') {
      current.paragraphs.push(block.text);
    }
  }
  if (current.paragraphs.length > 0) sections.push(current);
  return sections.length > 0 ? sections : [{ heading: null, paragraphs: [fallback] }];
}

function readingTimeMinutes(sections: KnowledgeContentSection[]): number {
  const characters = sections.flatMap((section) => section.paragraphs).join('').length;
  return Math.max(1, Math.ceil(characters / 250));
}

export function classifyKnowledgeCreator(
  originType: SubmissionOriginType | null,
  role: UserRole | null,
  publicHandle: string | null,
): { kind: KnowledgeCreatorKind; label: string; handle: string | null } {
  if (!originType) return { kind: 'system', label: '系统整理', handle: null };
  if (originType === 'source_discovery' || originType === 'maintenance') {
    return { kind: 'system', label: '系统抓取', handle: null };
  }
  if (role === 'owner') return { kind: 'owner', label: '站长创建', handle: publicHandle };
  return { kind: 'contributor', label: '用户投稿', handle: publicHandle };
}

function mapKnowledgeNode(row: KnowledgeNodeRow): KnowledgeNodeSummary {
  const sections = knowledgeSections(row.content_blocks, row.summary);
  const creator = classifyKnowledgeCreator(row.creator_origin_type, row.creator_role, row.creator_handle);
  return {
    id: row.id, slug: row.slug, title: row.title, summary: row.summary, sections,
    readingTimeMinutes: readingTimeMinutes(sections), topicId: row.topic_id,
    topicName: row.topic_name, domainSlug: row.domain_slug, domainName: row.domain_name,
    publishedAt: row.published_at?.toISOString() ?? null,
    creatorKind: creator.kind, creatorLabel: creator.label, creatorHandle: creator.handle,
  };
}

function validatedKnowledgeContent(blocks: unknown[]): KnowledgeContent {
  const result = knowledgeContentSchema.safeParse(blocks);
  if (!result.success) {
    throw new ContentRepositoryError('validation', result.error.issues.map((issue) => issue.message).join('；'));
  }
  return result.data;
}

export class Phase1Repository {
  constructor(private readonly pool: Pool) {}

  async registerAccount(input: RegisterAccountInput): Promise<AuthSessionResult> {
    const passwordHash = await hashPassword(input.password);
    return inTransaction(this.pool, async (client) => {
      try {
        const row: AuthAccountRow = {
          id: randomUUID(), public_handle: input.publicHandle,
          display_name: input.displayName || input.publicHandle, role: 'user',
          password_hash: '', locked_until: null,
        };
        await client.query(`
          INSERT INTO app_users (id, public_handle, display_name, role, verification_status)
          VALUES ($1, $2, $3, 'user', 'unverified')
        `, [row.id, row.public_handle, row.display_name]);
        await client.query('INSERT INTO auth_credentials (user_id, password_hash) VALUES ($1, $2)', [row.id, passwordHash]);
        const session = await this.createSession(client, mapAuthUser(row));
        await this.writeAudit(client, row.id, 'account.register', 'app_user', row.id, null,
          { publicHandle: row.public_handle }, 'user');
        return session;
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '这个账号已经被使用。');
        }
        throw error;
      }
    });
  }

  async loginAccount(input: LoginInput): Promise<AuthSessionResult> {
    const account = await oneOrNull<AuthAccountRow>(this.pool, `
      SELECT u.id, u.public_handle, u.display_name, u.role, ac.password_hash, ac.locked_until
      FROM app_users u JOIN auth_credentials ac ON ac.user_id = u.id
      WHERE u.public_handle = $1
    `, [input.publicHandle]);
    const valid = await verifyPassword(input.password, account?.password_hash ?? await fallbackPasswordHash);
    if (!account || !valid || (account.locked_until && account.locked_until > new Date())) {
      if (account && (!account.locked_until || account.locked_until <= new Date())) {
        await this.pool.query(`
          UPDATE auth_credentials SET
            failed_login_count = CASE WHEN first_failed_at < DATE_SUB(now(), INTERVAL 15 MINUTE) OR first_failed_at IS NULL THEN 1 ELSE failed_login_count + 1 END,
            first_failed_at = CASE WHEN first_failed_at < DATE_SUB(now(), INTERVAL 15 MINUTE) OR first_failed_at IS NULL THEN now() ELSE first_failed_at END,
            locked_until = CASE WHEN first_failed_at >= DATE_SUB(now(), INTERVAL 15 MINUTE) AND failed_login_count >= 4 THEN DATE_ADD(now(), INTERVAL 15 MINUTE) ELSE NULL END,
            updated_at = now()
          WHERE user_id = $1
        `, [account.id]);
      }
      throw new ContentRepositoryError('unauthorized', '账号或密码错误；连续失败过多时会暂停登录 15 分钟。');
    }
    return inTransaction(this.pool, async (client) => {
      await client.query(`
        UPDATE auth_credentials SET failed_login_count = 0, first_failed_at = NULL, locked_until = NULL, updated_at = now()
        WHERE user_id = $1
      `, [account.id]);
      await client.query(`
        DELETE FROM user_sessions
        WHERE expires_at <= now() OR (
          user_id = $1 AND token_hash NOT IN (
            SELECT token_hash FROM (
              SELECT token_hash FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 4
            ) AS recent_sessions
          )
        )
      `, [account.id]);
      return this.createSession(client, mapAuthUser(account));
    });
  }

  async getSessionUser(token: string): Promise<AuthUserView | null> {
    const row = await oneOrNull<AuthAccountRow>(this.pool, `
      SELECT u.id, u.public_handle, u.display_name, u.role, '' AS password_hash, NULL AS locked_until
      FROM user_sessions s JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
    `, [sessionHash(token)]);
    if (!row) return null;
    await this.pool.query(`
      UPDATE user_sessions SET last_seen_at = now()
      WHERE token_hash = $1 AND last_seen_at < DATE_SUB(now(), INTERVAL 15 MINUTE)
    `, [sessionHash(token)]);
    return mapAuthUser(row);
  }

  async deleteSession(token: string): Promise<void> {
    await this.pool.query('DELETE FROM user_sessions WHERE token_hash = $1', [sessionHash(token)]);
  }

  async bootstrapOwnerPassword(publicHandle: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await inTransaction(this.pool, async (client) => {
      const owner = await this.ownerForBootstrap(client, publicHandle);
      await client.query(`
        INSERT INTO auth_credentials (user_id, password_hash)
        VALUES ($1, $2)
        ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash),
          failed_login_count = 0, first_failed_at = NULL, locked_until = NULL,
          password_changed_at = now(), updated_at = now()
      `, [owner.id, passwordHash]);
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [owner.id]);
      await this.writeAudit(client, 'bootstrap-owner', 'account.owner_password_set', 'app_user', owner.id, null,
        { publicHandle }, 'system');
    });
  }

  async ensureOwnerPassword(publicHandle: string, password: string): Promise<'created' | 'existing'> {
    return inTransaction(this.pool, async (client) => {
      const owner = await this.ownerForBootstrap(client, publicHandle);
      if (owner.has_credential) return 'existing';
      const passwordHash = await hashPassword(password);
      await client.query('INSERT INTO auth_credentials (user_id, password_hash) VALUES ($1, $2)', [owner.id, passwordHash]);
      await this.writeAudit(client, 'bootstrap-owner', 'account.owner_password_initialized', 'app_user', owner.id, null,
        { publicHandle }, 'system');
      return 'created';
    });
  }

  private async ownerForBootstrap(
    client: PoolClient,
    publicHandle: string,
  ): Promise<{ id: string; has_credential: boolean }> {
    const configured = await oneOrNull<{ id: string; role: string }>(client, `
      SELECT id, role FROM app_users WHERE public_handle = $1 FOR UPDATE
    `, [publicHandle]);
    if (configured) {
      if (configured.role !== 'owner') {
        throw new ContentRepositoryError('conflict', '配置的站长昵称已被普通账号使用，请更换 owner.handle。');
      }
      const credential = await oneOrNull<{ user_id: string }>(
        client,
        'SELECT user_id FROM auth_credentials WHERE user_id = $1',
        [configured.id],
      );
      return { id: configured.id, has_credential: Boolean(credential) };
    }

    const owners = await client.query<{ id: string }>(`
      SELECT id FROM app_users WHERE role = 'owner' ORDER BY created_at FOR UPDATE
    `);
    const ownerIds = owners.rows.map((owner) => owner.id);
    const credentials = ownerIds.length === 0
      ? { rows: [] }
      : await client.query<{ user_id: string }>('SELECT user_id FROM auth_credentials WHERE user_id IN ($1)', [ownerIds]);
    if (credentials.rows.length > 0) {
      throw new ContentRepositoryError('conflict', 'owner.handle 与现有站长账号不一致；为防止误建第二个站长，启动已停止。');
    }
    if (owners.rows.length > 1) {
      throw new ContentRepositoryError('conflict', '数据库里存在多个未初始化站长账号，请先人工确认。');
    }

    const existingOwner = owners.rows[0];
    if (existingOwner) {
      await client.query(`
        UPDATE app_users SET public_handle = $2,
          display_name = CASE WHEN public_handle = 'site-owner' THEN $2 ELSE display_name END,
          updated_at = now()
        WHERE id = $1
      `, [existingOwner.id, publicHandle]);
      await this.writeAudit(client, 'bootstrap-owner', 'account.owner_handle_configured', 'app_user', existingOwner.id,
        null, { publicHandle }, 'system');
      return { id: existingOwner.id, has_credential: false };
    }

    const ownerId = randomUUID();
    await client.query(`
      INSERT INTO app_users (id, public_handle, display_name, role, verification_status)
      VALUES ($1, $2, $2, 'owner', 'verified')
    `, [ownerId, publicHandle]);
    await this.writeAudit(client, 'bootstrap-owner', 'account.owner_created', 'app_user', ownerId,
      null, { publicHandle }, 'system');
    return { id: ownerId, has_credential: false };
  }

  private async createSession(client: PoolClient, user: AuthUserView): Promise<AuthSessionResult> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + sessionLifetimeMs);
    await client.query('INSERT INTO user_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [sessionHash(token), user.id, expiresAt]);
    return { user, token, expiresAt };
  }

  async listTaxonomy(reviewerId: string): Promise<TaxonomyAdminView> {
    const client = await this.pool.connect();
    try {
      await this.assertReviewer(client, reviewerId);
      const [domains, topics] = await Promise.all([
        client.query<{
          id: string; slug: string; name: string; description: string; sort_order: number;
          is_active: boolean; topic_count: number;
        }>(`
          SELECT d.id, d.slug, d.name, d.description, d.sort_order, d.is_active,
                 count(t.id) AS topic_count
          FROM knowledge_domains d
          LEFT JOIN topics t ON t.domain_id = d.id
          GROUP BY d.id
          ORDER BY d.sort_order, d.name
        `),
        client.query<{
          id: string; domain_id: string; slug: string; name: string; description: string;
          sort_order: number; is_active: boolean; domain_slug: string; domain_name: string;
          v1_target_count: number; published_count: number; pending_count: number;
        }>(`
          SELECT t.id, t.domain_id, t.slug, t.name, t.description, t.sort_order, t.is_active,
                 d.slug AS domain_slug, d.name AS domain_name, t.v1_target_count,
                 count(DISTINCT CASE WHEN kn.status = 'published' THEN kn.id END) AS published_count,
                 count(DISTINCT CASE WHEN s.status IN (
                   'submitted', 'automated_screening', 'trial', 'expanded_trial', 'queued_for_review', 'held'
                 ) THEN s.id END) AS pending_count
          FROM topics t
          JOIN knowledge_domains d ON d.id = t.domain_id
          LEFT JOIN knowledge_nodes kn ON kn.topic_id = t.id
          LEFT JOIN submissions s ON s.topic_id = t.id
          GROUP BY t.id, d.id
          ORDER BY d.sort_order, t.sort_order, t.name
        `),
      ]);
      return {
        domains: domains.rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          sortOrder: row.sort_order,
          isActive: row.is_active,
          topicCount: row.topic_count,
        })),
        topics: topics.rows.map((row) => ({
          id: row.id,
          domainId: row.domain_id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          sortOrder: row.sort_order,
          isActive: row.is_active,
          domainSlug: row.domain_slug,
          domainName: row.domain_name,
          v1TargetCount: row.v1_target_count,
          publishedCount: row.published_count,
          pendingCount: row.pending_count,
        })),
      };
    } finally {
      client.release();
    }
  }

  async createKnowledgeDomain(reviewerId: string, input: CreateKnowledgeDomainInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      try {
        const id = randomUUID();
        await client.query(`
          INSERT INTO knowledge_domains (id, slug, name, description, sort_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, input.slug, input.name, input.description, input.sortOrder]);
        await this.writeAudit(client, reviewerId, 'taxonomy.domain.create', 'knowledge_domain', id, null, input);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '领域 slug 已存在。');
        }
        throw error;
      }
    });
  }

  async updateKnowledgeDomain(reviewerId: string, id: string, input: UpdateKnowledgeDomainInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const before = await oneOrNull<Record<string, unknown>>(client, 'SELECT * FROM knowledge_domains WHERE id = $1 FOR UPDATE', [id]);
      if (!before) throw new ContentRepositoryError('not_found', '知识领域不存在。');
      try {
        await client.query(`
          UPDATE knowledge_domains SET slug = $2, name = $3, description = $4, sort_order = $5,
            is_active = $6, updated_at = now() WHERE id = $1
        `, [id, input.slug, input.name, input.description, input.sortOrder, input.isActive]);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '领域 slug 已存在。');
        }
        throw error;
      }
      await this.writeAudit(client, reviewerId, 'taxonomy.domain.update', 'knowledge_domain', id, before, input);
    });
  }

  async createTopic(reviewerId: string, input: CreateTopicInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const domain = await oneOrNull<{ id: string }>(client, 'SELECT id FROM knowledge_domains WHERE id = $1', [input.domainId]);
      if (!domain) throw new ContentRepositoryError('validation', '所属领域不存在。');
      try {
        const id = randomUUID();
        await client.query(`
          INSERT INTO topics (id, domain_id, slug, name, description, sort_order, v1_target_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, input.domainId, input.slug, input.name, input.description, input.sortOrder, input.v1TargetCount]);
        await this.writeAudit(client, reviewerId, 'taxonomy.topic.create', 'topic', id, null, input);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '话题 slug 已存在。');
        }
        throw error;
      }
    });
  }

  async updateTopic(reviewerId: string, id: string, input: UpdateTopicInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const before = await oneOrNull<Record<string, unknown>>(client, 'SELECT * FROM topics WHERE id = $1 FOR UPDATE', [id]);
      if (!before) throw new ContentRepositoryError('not_found', '细分话题不存在。');
      const domain = await oneOrNull<{ id: string }>(client, 'SELECT id FROM knowledge_domains WHERE id = $1', [input.domainId]);
      if (!domain) throw new ContentRepositoryError('validation', '所属领域不存在。');
      try {
        await client.query(`
          UPDATE topics SET domain_id = $2, slug = $3, name = $4, description = $5,
            sort_order = $6, v1_target_count = $7, is_active = $8, updated_at = now()
          WHERE id = $1
        `, [id, input.domainId, input.slug, input.name, input.description, input.sortOrder, input.v1TargetCount, input.isActive]);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '话题 slug 已存在。');
        }
        throw error;
      }
      await this.writeAudit(client, reviewerId, 'taxonomy.topic.update', 'topic', id, before, input);
    });
  }

  async getAiRuntimeConfig(): Promise<AiRuntimeConfigView> {
    const row = await oneOrNull<{ value: Partial<AiRuntimeConfigView> }>(this.pool, `
      SELECT \`value\` FROM policy_config WHERE \`key\` = 'ai.runtime'
    `);
    const value = row?.value ?? {};
    const provider = value.provider && ['rules', 'ollama', 'openai_compatible'].includes(value.provider)
      ? value.provider
      : 'rules';
    return {
      provider,
      model: typeof value.model === 'string' ? value.model : 'deterministic-placeholder',
      baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : null,
      maxInputChars: typeof value.maxInputChars === 'number' ? value.maxInputChars : 12000,
      maxOutputTokens: typeof value.maxOutputTokens === 'number' ? value.maxOutputTokens : 800,
      credentialConfigured: provider !== 'openai_compatible' || Boolean(process.env.AI_API_KEY),
      modeDescription: '',
    };
  }

  async updateAiRuntimeConfig(reviewerId: string, input: UpdateAiRuntimeConfigInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const before = await oneOrNull<{ value: unknown }>(client, "SELECT `value` FROM policy_config WHERE `key` = 'ai.runtime' FOR UPDATE");
      const value = { ...input, baseUrl: input.baseUrl || null };
      await client.query(`
        INSERT INTO policy_config (\`key\`, \`value\`, updated_by)
        VALUES ('ai.runtime', $1, $2)
        ON DUPLICATE KEY UPDATE value = VALUES(value), version = version + 1,
          updated_by = VALUES(updated_by), updated_at = now()
      `, [JSON.stringify(value), reviewerId]);
      await this.writeAudit(client, reviewerId, 'ai.runtime.update', 'policy_config', 'ai.runtime', before?.value ?? null, value);
    });
  }

  async listSourceOperations(reviewerId: string): Promise<SourceOperationsView> {
    const client = await this.pool.connect();
    try {
      await this.assertReviewer(client, reviewerId);
      const [feeds, evidence] = await Promise.all([
        client.query<{
          id: string; topic_id: string; topic_name: string; domain_name: string; name: string;
          publisher: string; url: string; source_type: 'official' | 'research' | 'open_education';
          crawl_mode: 'single_page' | 'website'; max_pages_per_scan: number; auto_scan: boolean;
          license: string; is_active: boolean; check_interval_hours: number; last_checked_at: Date | null;
          next_check_at: Date; last_error: string | null;
        }>(`
          SELECT sf.id, sf.topic_id, t.name AS topic_name, d.name AS domain_name, sf.name, sf.publisher,
                 sf.url, sf.source_type, sf.crawl_mode, sf.max_pages_per_scan, sf.auto_scan,
                 sf.license, sf.is_active, sf.check_interval_hours,
                 sf.last_checked_at, sf.next_check_at, sf.last_error
          FROM source_feeds sf JOIN topics t ON t.id = sf.topic_id
          JOIN knowledge_domains d ON d.id = t.domain_id
          ORDER BY sf.is_active DESC, sf.next_check_at, sf.name
        `),
        client.query<{
          id: string; feed_name: string; topic_name: string; domain_name: string; page_title: string;
          source_url: string; evidence_text: string; status: 'ready' | 'drafting' | 'candidate_created' | 'held' | 'dismissed';
          discovered_urls: string[];
          candidate_submission_id: string | null; error_message: string | null; created_at: Date;
        }>(`
          SELECT ep.id, sf.name AS feed_name, t.name AS topic_name, d.name AS domain_name,
                 ss.page_title, ss.final_url AS source_url, ss.discovered_urls, ep.evidence_text, ep.status,
                 ep.candidate_submission_id, ep.error_message, ep.created_at
          FROM evidence_packages ep JOIN source_snapshots ss ON ss.id = ep.source_snapshot_id
          JOIN source_feeds sf ON sf.id = ss.source_feed_id JOIN topics t ON t.id = ep.topic_id
          JOIN knowledge_domains d ON d.id = t.domain_id
          ORDER BY ep.created_at DESC LIMIT 100
        `),
      ]);
      return {
        automationEnabled: process.env.SOURCE_AUTOMATION_ENABLED === 'true',
        feeds: feeds.rows.map((row) => ({
          id: row.id, topicId: row.topic_id, topicName: row.topic_name, domainName: row.domain_name,
          name: row.name, publisher: row.publisher, url: row.url, sourceType: row.source_type,
          crawlMode: row.crawl_mode, maxPagesPerScan: row.max_pages_per_scan, autoScan: row.auto_scan,
          license: row.license, isActive: row.is_active, checkIntervalHours: row.check_interval_hours,
          lastCheckedAt: row.last_checked_at?.toISOString() ?? null,
          nextCheckAt: row.next_check_at.toISOString(), lastError: row.last_error,
        })),
        evidence: evidence.rows.map((row) => ({
          id: row.id, feedName: row.feed_name, topicName: row.topic_name, domainName: row.domain_name,
          pageTitle: row.page_title, sourceUrl: row.source_url, evidenceText: row.evidence_text,
          discoveredUrls: row.discovered_urls,
          status: row.status, candidateSubmissionId: row.candidate_submission_id,
          errorMessage: row.error_message, createdAt: row.created_at.toISOString(),
        })),
      };
    } finally { client.release(); }
  }

  async createSourceFeed(reviewerId: string, input: CreateSourceFeedInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const topic = await oneOrNull<{ id: string }>(client, 'SELECT id FROM topics WHERE id = $1 AND is_active = true', [input.topicId]);
      if (!topic) throw new ContentRepositoryError('validation', '细分话题不存在或已停用。');
      try {
        const id = randomUUID();
        await client.query(`
          INSERT INTO source_feeds (
            id, topic_id, name, publisher, url, source_type, crawl_mode, max_pages_per_scan,
            auto_scan, license, check_interval_hours, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [id, input.topicId, input.name, input.publisher, input.url, input.sourceType, input.crawlMode,
          input.maxPagesPerScan, input.autoScan, input.license, input.checkIntervalHours, reviewerId]);
        await this.writeAudit(client, reviewerId, 'source_feed.create', 'source_feed', id, null, input);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '该来源地址已经存在。');
        }
        throw error;
      }
    });
  }

  async createSourceFeedsBulk(reviewerId: string, input: BulkCreateSourceFeedsInput): Promise<{ importedCount: number; skippedCount: number }> {
    return inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const topicIds = [...new Set(input.feeds.map((feed) => feed.topicId))];
      const activeTopics = await client.query<{ id: string }>('SELECT id FROM topics WHERE id IN ($1) AND is_active = true', [topicIds]);
      if (activeTopics.rowCount !== topicIds.length) throw new ContentRepositoryError('validation', '批量清单包含不存在或已停用的话题。');
      let importedCount = 0;
      for (const feed of input.feeds) {
        const result = await client.query(`
          INSERT IGNORE INTO source_feeds (
            id, topic_id, name, publisher, url, source_type, crawl_mode, max_pages_per_scan,
            auto_scan, license, check_interval_hours, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [randomUUID(), feed.topicId, feed.name, feed.publisher, feed.url, feed.sourceType, feed.crawlMode,
          feed.maxPagesPerScan, feed.autoScan, feed.license, feed.checkIntervalHours, reviewerId]);
        importedCount += result.rowCount ?? 0;
      }
      const skippedCount = input.feeds.length - importedCount;
      await this.writeAudit(client, reviewerId, 'source_feed.bulk_create', 'source_feed_batch', randomBytes(16).toString('hex'), null,
        { importedCount, skippedCount, urls: input.feeds.map((feed) => feed.url) });
      return { importedCount, skippedCount };
    });
  }

  async updateSourceFeed(reviewerId: string, id: string, input: UpdateSourceFeedInput): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const before = await oneOrNull<Record<string, unknown>>(client, 'SELECT * FROM source_feeds WHERE id = $1 FOR UPDATE', [id]);
      if (!before) throw new ContentRepositoryError('not_found', '来源订阅不存在。');
      try {
        await client.query(`
          UPDATE source_feeds SET topic_id = $2, name = $3, publisher = $4, url = $5,
            source_type = $6, crawl_mode = $7, max_pages_per_scan = $8, auto_scan = $9,
            license = $10, check_interval_hours = $11, is_active = $12,
            updated_at = now(), next_check_at = CASE WHEN $12 AND $9 THEN LEAST(next_check_at, now()) ELSE next_check_at END
          WHERE id = $1
        `, [id, input.topicId, input.name, input.publisher, input.url, input.sourceType, input.crawlMode,
          input.maxPagesPerScan, input.autoScan, input.license, input.checkIntervalHours, input.isActive]);
      } catch (error) {
        if (isDuplicateKey(error)) {
          throw new ContentRepositoryError('conflict', '该来源地址已经存在。');
        }
        throw error;
      }
      await this.writeAudit(client, reviewerId, 'source_feed.update', 'source_feed', id, before, input);
    });
  }

  async scheduleSourceFeedNow(reviewerId: string, id: string): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const result = await client.query(`
        UPDATE source_feeds SET next_check_at = now(), scan_requested = true, last_error = NULL
        WHERE id = $1 AND is_active = true
      `, [id]);
      if (result.rowCount !== 1) throw new ContentRepositoryError('not_found', '启用中的来源订阅不存在。');
      await this.writeAudit(client, reviewerId, 'source_feed.schedule_now', 'source_feed', id, null, { nextCheckAt: 'now' });
    });
  }

  async claimDueSourceFeeds(limit = 3): Promise<DueSourceFeed[]> {
    return inTransaction(this.pool, async (client) => {
      const rows = await client.query<{
        id: string; topic_id: string; topic_name: string; topic_description: string; name: string;
        crawl_mode: 'single_page' | 'website'; max_pages_per_scan: number;
        url: string; etag: string | null; last_modified: string | null; created_by: string;
      }>(`
        SELECT sf.id, sf.topic_id, t.name AS topic_name, t.description AS topic_description,
               sf.name, sf.url, sf.crawl_mode, sf.max_pages_per_scan,
               sf.etag, sf.last_modified, sf.created_by
        FROM source_feeds sf JOIN topics t ON t.id = sf.topic_id
        WHERE sf.is_active = true AND sf.next_check_at <= now()
          AND (sf.auto_scan = true OR sf.scan_requested = true)
        ORDER BY sf.next_check_at LIMIT $1 FOR UPDATE SKIP LOCKED
      `, [limit]);
      if (rows.rows.length > 0) {
        await client.query(`
          UPDATE source_feeds SET next_check_at = DATE_ADD(now(), INTERVAL 10 MINUTE), scan_requested = false
          WHERE id IN ($1)
        `, [rows.rows.map((row) => row.id)]);
      }
      return rows.rows.map((row) => ({
        id: row.id, topicId: row.topic_id, topicName: row.topic_name,
          topicDescription: row.topic_description, name: row.name, url: row.url,
          crawlMode: row.crawl_mode, maxPagesPerScan: row.max_pages_per_scan,
        etag: row.etag, lastModified: row.last_modified, createdBy: row.created_by,
      }));
    });
  }

  async recordSourceFetch(feedId: string, result: SourceFetchResult): Promise<string | null> {
    return inTransaction(this.pool, async (client) => {
      const feed = await oneOrNull<{ id: string; topic_id: string; check_interval_hours: number; last_content_hash: string | null }>(client, `
        SELECT id, topic_id, check_interval_hours, last_content_hash FROM source_feeds WHERE id = $1 FOR UPDATE
      `, [feedId]);
      if (!feed) throw new ContentRepositoryError('not_found', '来源订阅不存在。');
      if (result.status === 'failed') {
        await client.query(`
          UPDATE source_feeds SET last_checked_at = now(), next_check_at = DATE_ADD(now(), INTERVAL 1 HOUR),
            last_error = $2, updated_at = now() WHERE id = $1
        `, [feedId, (result.error ?? '抓取失败').slice(0, 2000)]);
        return null;
      }
      const unchanged = result.status === 'unchanged' || result.contentHash === feed.last_content_hash;
      await client.query(`
        UPDATE source_feeds SET last_checked_at = now(),
          next_check_at = DATE_ADD(now(), INTERVAL check_interval_hours HOUR),
          etag = COALESCE($2, etag), last_modified = COALESCE($3, last_modified),
          last_content_hash = COALESCE($4, last_content_hash), last_error = NULL, updated_at = now()
        WHERE id = $1
      `, [feedId, result.etag ?? null, result.lastModified ?? null, result.contentHash ?? null]);
      if (unchanged) return null;
      if (!result.contentHash || !result.evidenceText || !result.pageTitle || !result.finalUrl || !result.httpStatus) {
        throw new ContentRepositoryError('validation', '抓取结果缺少证据字段。');
      }
      const snapshotId = randomUUID();
      const snapshot = await client.query(`
        INSERT IGNORE INTO source_snapshots (
          id, source_feed_id, content_hash, page_title, final_url, evidence_text, http_status,
          etag, last_modified, discovered_urls
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [snapshotId, feedId, result.contentHash, result.pageTitle, result.finalUrl, result.evidenceText, result.httpStatus,
        result.etag ?? null, result.lastModified ?? null, JSON.stringify(result.discoveredUrls ?? [result.finalUrl])]);
      if (snapshot.rowCount === 0) return null;
      const evidenceId = randomUUID();
      await client.query(`
        INSERT INTO evidence_packages (id, source_snapshot_id, topic_id, evidence_text)
        VALUES ($1, $2, $3, $4)
      `, [evidenceId, snapshotId, feed.topic_id, result.evidenceText]);
      if (evidenceId) {
        await this.writeAudit(client, 'source-monitor', 'source.changed', 'evidence_package', evidenceId, null,
          { feedId, contentHash: result.contentHash }, 'system');
      }
      return evidenceId;
    });
  }

  async claimReadyEvidence(): Promise<ReadyEvidencePackage | null> {
    return inTransaction(this.pool, async (client) => {
      const row = await oneOrNull<{
        id: string; topic_id: string; topic_name: string; topic_description: string; feed_name: string;
        publisher: string; source_url: string; page_title: string; evidence_text: string; created_by: string;
      }>(client, `
        SELECT ep.id, ep.topic_id, t.name AS topic_name, t.description AS topic_description,
               sf.name AS feed_name, sf.publisher, ss.final_url AS source_url, ss.page_title,
               ep.evidence_text, sf.created_by
        FROM evidence_packages ep JOIN topics t ON t.id = ep.topic_id
        JOIN source_snapshots ss ON ss.id = ep.source_snapshot_id
        JOIN source_feeds sf ON sf.id = ss.source_feed_id
        WHERE ep.status = 'ready'
        ORDER BY ep.created_at LIMIT 1 FOR UPDATE SKIP LOCKED
      `);
      if (!row) return null;
      await client.query("UPDATE evidence_packages SET status = 'drafting', updated_at = now() WHERE id = $1", [row.id]);
      return {
        id: row.id, topicId: row.topic_id, topicName: row.topic_name,
        topicDescription: row.topic_description, feedName: row.feed_name, publisher: row.publisher,
        sourceUrl: row.source_url, pageTitle: row.page_title, evidenceText: row.evidence_text,
        createdBy: row.created_by,
      };
    });
  }

  async completeEvidenceDraft(evidenceId: string, submissionId: string): Promise<void> {
    await this.pool.query(`
      UPDATE evidence_packages SET status = 'candidate_created', candidate_submission_id = $2,
        error_message = NULL, updated_at = now() WHERE id = $1
    `, [evidenceId, submissionId]);
  }

  async failEvidenceDraft(evidenceId: string, message: string): Promise<void> {
    await this.pool.query(`
      UPDATE evidence_packages SET status = 'held', error_message = $2, updated_at = now() WHERE id = $1
    `, [evidenceId, message.slice(0, 2000)]);
  }

  async listTopics(): Promise<TopicSummary[]> {
    const result = await this.pool.query<{
      id: string;
      slug: string;
      name: string;
      domain_slug: string;
      domain_name: string;
      v1_target_count: number;
    }>(`
      SELECT t.id, t.slug, t.name, d.slug AS domain_slug, d.name AS domain_name, t.v1_target_count
      FROM topics t
      JOIN knowledge_domains d ON d.id = t.domain_id
      WHERE t.is_active = true AND d.is_active = true
      ORDER BY d.sort_order, t.name
    `);
    return result.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      domainSlug: row.domain_slug,
      domainName: row.domain_name,
      v1TargetCount: row.v1_target_count,
    }));
  }

  async listSubmissions(
    statuses: readonly SubmissionStatus[],
    originTypes?: readonly SubmissionOriginType[],
  ): Promise<SubmissionView[]> {
    const originFilter = originTypes ? ' AND s.origin_type IN ($2)' : '';
    const result = await this.pool.query<SubmissionRow>(
      `${submissionSelect} WHERE s.status IN ($1)${originFilter} ORDER BY s.created_at DESC`,
      originTypes ? [statuses, originTypes] : [statuses],
    );
    return result.rows.map(mapSubmission);
  }

  async listReviewQueue(reviewerId: string): Promise<SubmissionView[]> {
    const client = await this.pool.connect();
    try {
      await this.assertReviewer(client, reviewerId);
      const result = await client.query<SubmissionRow>(
        `${submissionSelect} WHERE s.status = 'queued_for_review' ORDER BY s.review_queued_at ASC`,
      );
      return result.rows.map(mapSubmission);
    } finally {
      client.release();
    }
  }

  async getSubmission(id: string, client: Pool | PoolClient = this.pool): Promise<SubmissionView> {
    const row = await oneOrNull<SubmissionRow>(client, `${submissionSelect} WHERE s.id = $1`, [id]);
    if (!row) throw new ContentRepositoryError('not_found', '候选内容不存在。');
    return mapSubmission(row);
  }

  async createSubmission(
    actorId: string,
    input: CreateSubmissionInput,
  ): Promise<{ submission: SubmissionView; aiJobId: string }> {
    return inTransaction(this.pool, async (client) => {
      await this.assertRegisteredContributor(client, actorId);
      return this.createCandidateRecord(client, actorId, input, 'user_submission', null);
    });
  }

  async createInternalCandidate(
    reviewerId: string,
    input: CreateInternalCandidateInput,
  ): Promise<{ submission: SubmissionView; aiJobId: string }> {
    return inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      return this.createCandidateRecord(client, reviewerId, {
        topicId: input.topicId,
        statement: input.statement,
        whyUseful: input.whyUseful,
        applicability: input.applicability,
        sourceUrl: input.sourceUrl,
        experienceBased: false,
        aiDisclosure: input.aiDisclosure,
      }, input.originType, input.triggerReason, {
        title: input.proposedTitle,
        slug: input.proposedSlug,
      });
    });
  }

  async recordVote(actorId: string, submissionId: string, value: VoteValue): Promise<SubmissionView> {
    return inTransaction(this.pool, async (client) => {
      await this.assertUserExists(client, actorId);
      const submission = await this.lockSubmission(client, submissionId);
      if (submission.origin_type !== 'user_submission') {
        throw new ContentRepositoryError('invalid_state', '内部编辑候选不参与公开评分。');
      }
      if (!['trial', 'expanded_trial', 'queued_for_review'].includes(submission.status)) {
        throw new ContentRepositoryError('invalid_state', '当前状态不能评分。');
      }

      const isValid = actorId !== submission.author_id;
      await client.query(`
        INSERT INTO submission_votes (submission_id, user_id, value, is_valid, invalid_reason)
        VALUES ($1, $2, $3, $4, $5)
        ON DUPLICATE KEY UPDATE
          value = VALUES(value),
          is_valid = VALUES(is_valid),
          invalid_reason = VALUES(invalid_reason),
          updated_at = now()
      `, [submissionId, actorId, value, isValid, isValid ? null : 'author_vote']);

      const counts = await client.query<{ useful_count: number; not_useful_count: number }>(`
        SELECT
          COALESCE(SUM(CASE WHEN value = 'useful' THEN 1 ELSE 0 END), 0) AS useful_count,
          COALESCE(SUM(CASE WHEN value = 'not_useful' THEN 1 ELSE 0 END), 0) AS not_useful_count
        FROM submission_votes
        WHERE submission_id = $1 AND is_valid = true
      `, [submissionId]);
      const countRow = counts.rows[0] ?? { useful_count: 0, not_useful_count: 0 };
      const metrics = calculateVoteMetrics(countRow.useful_count, countRow.not_useful_count);
      const thresholds = await this.submissionThresholds(client);
      const nextStatus = nextStatusAfterVote(submission.status, metrics, thresholds);

      await client.query(`
        UPDATE submissions SET
          status = $2,
          useful_count = $3,
          not_useful_count = $4,
          valid_vote_count = $5,
          usefulness_rate = $6,
          review_queued_at = CASE WHEN $2 = 'queued_for_review' THEN COALESCE(review_queued_at, now()) ELSE NULL END,
          updated_at = now()
        WHERE id = $1
      `, [
        submissionId,
        nextStatus,
        metrics.usefulCount,
        metrics.notUsefulCount,
        metrics.validVoteCount,
        metrics.usefulnessRate,
      ]);
      await this.writeAudit(client, actorId, 'submission.vote', 'submission', submissionId, { status: submission.status }, {
        status: nextStatus,
        value,
        isValid,
        metrics,
      });
      return this.getSubmission(submissionId, client);
    });
  }

  async startAiScreening(aiJobId: string): Promise<void> {
    const result = await this.pool.query(`
      UPDATE ai_jobs SET status = 'running', started_at = COALESCE(started_at, now()), error_message = NULL
      WHERE id = $1 AND status IN ('queued', 'running', 'failed')
    `, [aiJobId]);
    if (result.rowCount !== 1) {
      throw new ContentRepositoryError('invalid_state', 'AI 作业不存在或已被处理。');
    }
  }

  async getCurrentSubmissionRevision(submissionId: string): Promise<CurrentRevisionRow> {
    const row = await oneOrNull<CurrentRevisionRow>(this.pool, `
      SELECT sr.id, sr.statement, sr.ai_refined_statement, sr.why_useful, sr.applicability,
             sr.source_url, sr.experience_based, sr.ai_disclosure, sr.ai_risk_flags
      FROM submissions s
      JOIN submission_revisions sr ON sr.id = s.current_revision_id
      WHERE s.id = $1
    `, [submissionId]);
    if (!row) throw new ContentRepositoryError('not_found', '候选内容不存在。');
    return row;
  }

  async listQueuedAiScreeningJobs(limit = 100): Promise<QueuedAiScreeningJob[]> {
    const result = await this.pool.query<{ id: string; entity_id: string }>(`
      SELECT id, entity_id
      FROM ai_jobs
      WHERE job_type = 'screen_submission' AND entity_type = 'submission' AND status = 'queued'
      ORDER BY created_at ASC
      LIMIT $1
    `, [limit]);
    return result.rows.map((row) => ({ aiJobId: row.id, submissionId: row.entity_id }));
  }

  async completeAiScreening(
    aiJobId: string,
    submissionId: string,
    result: {
      refinedStatement: string;
      riskFlags: readonly string[];
      provider: string;
      model: string;
      inputTokens: number | null;
      outputTokens: number | null;
    },
  ): Promise<void> {
    await inTransaction(this.pool, async (client) => {
      const submission = await this.lockSubmission(client, submissionId);
      const nextStatus = nextStatusAfterAiScreening(submission.origin_type, result.riskFlags);
      assertSubmissionTransition(submission.status, nextStatus);
      await client.query(`
        UPDATE submission_revisions SET
          ai_refined_statement = $2,
          ai_risk_flags = $3,
          ai_model = $4,
          ai_prompt_version = 'submission-screen-v1'
        WHERE id = $1
      `, [submission.current_revision_id, result.refinedStatement, JSON.stringify(result.riskFlags), result.model]);
      await client.query(`
        UPDATE submissions SET status = $2,
          trial_started_at = CASE WHEN $2 = 'trial' THEN now() ELSE NULL END,
          review_queued_at = CASE WHEN $2 = 'queued_for_review' THEN now() ELSE NULL END,
          updated_at = now()
        WHERE id = $1
      `, [submissionId, nextStatus]);
      await client.query(`
        UPDATE ai_jobs SET status = 'completed', result = $2, finished_at = now(),
          provider = $3, model = $4, input_tokens = $5, output_tokens = $6,
          cost_minor_units = CASE WHEN $3 = 'rules' THEN 0 ELSE NULL END
        WHERE id = $1
      `, [aiJobId, JSON.stringify(result), result.provider, result.model, result.inputTokens, result.outputTokens]);
      await this.writeAudit(client, 'ai-operator', 'submission.ai_screen', 'submission', submissionId,
        { status: submission.status }, { status: nextStatus, originType: submission.origin_type, ...result }, 'ai');
    });
  }

  async failAiScreening(aiJobId: string, message: string): Promise<void> {
    await this.pool.query(`
      UPDATE ai_jobs SET status = 'failed', error_message = $2, finished_at = now()
      WHERE id = $1
    `, [aiJobId, message.slice(0, 2_000)]);
  }

  async reviewSubmission(
    reviewerId: string,
    submissionId: string,
    input: ReviewSubmissionInput,
  ): Promise<{ submission: SubmissionView; knowledgeNodeId: string | null }> {
    return inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const submission = await this.lockSubmission(client, submissionId);
      if (input.decision !== 'hold' && submission.status !== 'queued_for_review') {
        throw new ContentRepositoryError('invalid_state', '只有进入审核队列的候选才能执行该决定。');
      }

      let knowledgeNodeId: string | null = null;
      if (input.decision === 'approve_new') {
        knowledgeNodeId = await this.publishNewKnowledge(client, reviewerId, submission, input);
        assertSubmissionTransition(submission.status, 'merged');
        await client.query("UPDATE submissions SET status = 'merged', updated_at = now() WHERE id = $1", [submissionId]);
      } else if (input.decision === 'merge') {
        knowledgeNodeId = await this.mergeIntoKnowledge(client, reviewerId, submission, input);
        assertSubmissionTransition(submission.status, 'merged');
        await client.query("UPDATE submissions SET status = 'merged', updated_at = now() WHERE id = $1", [submissionId]);
      } else if (input.decision === 'reject') {
        assertSubmissionTransition(submission.status, 'rejected');
        await client.query("UPDATE submissions SET status = 'rejected', updated_at = now() WHERE id = $1", [submissionId]);
      } else {
        assertSubmissionTransition(submission.status, 'held');
        await client.query("UPDATE submissions SET status = 'held', updated_at = now() WHERE id = $1", [submissionId]);
      }

      await client.query(`
        INSERT INTO approval_requests (
          action_type, entity_type, entity_id, requested_by_type, requested_by_id,
          status, payload, decided_by, decision_reason, decided_at
        ) VALUES ('submission_review', 'submission', $1, 'user', $2, $3, $4, $5, $6, now())
      `, [
        submissionId,
        submission.author_id,
        input.decision === 'reject' || input.decision === 'hold' ? 'rejected' : 'approved',
        JSON.stringify(input),
        reviewerId,
        input.reason,
      ]);
      await this.writeAudit(client, reviewerId, `submission.review.${input.decision}`, 'submission', submissionId,
        { status: submission.status }, { knowledgeNodeId, reason: input.reason });

      return { submission: await this.getSubmission(submissionId, client), knowledgeNodeId };
    });
  }

  async listKnowledgeNodes(): Promise<KnowledgeNodeSummary[]> {
    const result = await this.pool.query<KnowledgeNodeRow>(`
      SELECT kn.id, kn.slug, kn.title, kn.summary, t.id AS topic_id,
             t.name AS topic_name, d.slug AS domain_slug, d.name AS domain_name,
             kr.published_at, kr.content_blocks,
             creator_submission.origin_type AS creator_origin_type,
             creator_user.role AS creator_role,
             creator_user.public_handle AS creator_handle
      FROM knowledge_nodes kn
      JOIN topics t ON t.id = kn.topic_id
      JOIN knowledge_domains d ON d.id = t.domain_id
      LEFT JOIN knowledge_revisions kr ON kr.id = kn.current_revision_id
      LEFT JOIN submissions creator_submission ON creator_submission.id = kn.created_from_submission_id
      LEFT JOIN app_users creator_user ON creator_user.id = creator_submission.author_id
      WHERE kn.status = 'published'
      ORDER BY kn.updated_at DESC
    `);
    return result.rows.map(mapKnowledgeNode);
  }

  async getKnowledgeNodeBySlug(slug: string): Promise<KnowledgeNodeDetail> {
    const row = await oneOrNull<KnowledgeNodeRow>(this.pool, `
      SELECT kn.id, kn.slug, kn.title, kn.summary, t.id AS topic_id,
             t.name AS topic_name, d.slug AS domain_slug, d.name AS domain_name,
             kr.published_at, kr.content_blocks,
             creator_submission.origin_type AS creator_origin_type,
             creator_user.role AS creator_role,
             creator_user.public_handle AS creator_handle
      FROM knowledge_nodes kn
      JOIN topics t ON t.id = kn.topic_id
      JOIN knowledge_domains d ON d.id = t.domain_id
      LEFT JOIN knowledge_revisions kr ON kr.id = kn.current_revision_id
      LEFT JOIN submissions creator_submission ON creator_submission.id = kn.created_from_submission_id
      LEFT JOIN app_users creator_user ON creator_user.id = creator_submission.author_id
      WHERE kn.status = 'published' AND kn.slug = $1
    `, [slug]);
    if (!row) throw new ContentRepositoryError('not_found', '正式常识不存在。');
    const related = await this.pool.query<{
      id: string; slug: string; title: string; summary: string; topic_name: string; domain_name: string;
      relation_type: KnowledgeNodeDetail['related'][number]['relationType']; strength: string | number;
    }>(`
      SELECT other.id, other.slug, other.title, other.summary, t.name AS topic_name,
             d.name AS domain_name, rel.relation_type, rel.strength
      FROM knowledge_relations rel
      JOIN knowledge_nodes other ON other.id = CASE WHEN rel.from_node_id = $1 THEN rel.to_node_id ELSE rel.from_node_id END
      JOIN topics t ON t.id = other.topic_id
      JOIN knowledge_domains d ON d.id = t.domain_id
      WHERE (rel.from_node_id = $1 OR rel.to_node_id = $1) AND other.status = 'published'
      ORDER BY rel.strength DESC, other.updated_at DESC
      LIMIT 8
    `, [row.id]);
    return {
      ...mapKnowledgeNode(row),
      related: related.rows.map((item) => ({
        id: item.id, slug: item.slug, title: item.title, summary: item.summary,
        topicName: item.topic_name, domainName: item.domain_name,
        relationType: item.relation_type, strength: Number(item.strength),
      })),
    };
  }

  async listKnowledgeRevisions(reviewerId: string, knowledgeNodeId: string): Promise<KnowledgeRevisionSummary[]> {
    const client = await this.pool.connect();
    try {
      await this.assertReviewer(client, reviewerId);
      const result = await client.query<KnowledgeRevisionRow>(`
        SELECT kr.id, kr.knowledge_node_id, kr.version, kr.change_summary, kr.review_status,
               kr.ai_involvement, kr.published_at, kr.id = kn.current_revision_id AS is_current
        FROM knowledge_nodes kn
        JOIN knowledge_revisions kr ON kr.knowledge_node_id = kn.id
        WHERE kn.id = $1
        ORDER BY kr.version DESC
      `, [knowledgeNodeId]);
      if (result.rows.length === 0) throw new ContentRepositoryError('not_found', '正式常识不存在。');
      return result.rows.map(mapKnowledgeRevision);
    } finally {
      client.release();
    }
  }

  async rollbackKnowledgeRevision(
    reviewerId: string,
    knowledgeNodeId: string,
    input: RollbackKnowledgeInput,
  ): Promise<RollbackKnowledgeResponse> {
    return inTransaction(this.pool, async (client) => {
      await this.assertReviewer(client, reviewerId);
      const node = await oneOrNull<{ id: string; current_revision_id: string; summary: string }>(client, `
        SELECT id, current_revision_id, summary
        FROM knowledge_nodes
        WHERE id = $1 AND status = 'published'
        FOR UPDATE
      `, [knowledgeNodeId]);
      if (!node) throw new ContentRepositoryError('not_found', '正式常识不存在。');
      if (node.current_revision_id === input.targetRevisionId) {
        throw new ContentRepositoryError('conflict', '目标版本已经是当前版本。');
      }

      const target = await oneOrNull<{
        id: string;
        content_blocks: unknown;
        ai_involvement: KnowledgeRevisionSummary['aiInvolvement'];
      }>(client, `
        SELECT id, content_blocks, ai_involvement
        FROM knowledge_revisions
        WHERE id = $1 AND knowledge_node_id = $2
          AND review_status IN ('published', 'superseded')
      `, [input.targetRevisionId, knowledgeNodeId]);
      if (!target) throw new ContentRepositoryError('validation', '目标版本不可用于回滚。');

      const maximum = await oneOrNull<{ version: number | null }>(client, `
        SELECT max(version) AS version
        FROM knowledge_revisions
        WHERE knowledge_node_id = $1
      `, [knowledgeNodeId]);
      const nextVersion = (maximum?.version ?? 0) + 1;
      await client.query("UPDATE knowledge_revisions SET review_status = 'superseded' WHERE id = $1", [
        node.current_revision_id,
      ]);
      const restoredId = randomUUID();
      await client.query(`
        INSERT INTO knowledge_revisions (
          id, knowledge_node_id, version, content_blocks, change_summary, author_id,
          reviewer_id, review_status, ai_involvement, published_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, 'published', $7, now())
      `, [
        restoredId,
        knowledgeNodeId,
        nextVersion,
        JSON.stringify(target.content_blocks),
        input.reason,
        reviewerId,
        target.ai_involvement,
      ]);
      const restored = await oneOrNull<KnowledgeRevisionRow>(client, `
        SELECT id, knowledge_node_id, version, change_summary, review_status,
               ai_involvement, published_at, true AS is_current
        FROM knowledge_revisions WHERE id = $1
      `, [restoredId]);
      if (!restored) throw new Error('Failed to create rollback revision.');

      const copiedClaims = await client.query(`
        INSERT INTO claims (
          knowledge_revision_id, statement, source_id, evidence_locator, confidence,
          valid_from, valid_to, verified_by, verified_at
        )
        SELECT $1, statement, source_id, evidence_locator, confidence,
               valid_from, valid_to, $2, now()
        FROM claims
        WHERE knowledge_revision_id = $3
      `, [restored.id, reviewerId, target.id]);
      if (copiedClaims.rowCount === 0) {
        throw new ContentRepositoryError('validation', '目标版本缺少可核验来源，不能回滚发布。');
      }

      const summary = firstParagraph(target.content_blocks) ?? node.summary;
      await client.query(`
        UPDATE knowledge_nodes
        SET current_revision_id = $2, summary = $3, updated_at = now()
        WHERE id = $1
      `, [knowledgeNodeId, restored.id, summary]);
      await client.query(`
        INSERT INTO approval_requests (
          action_type, entity_type, entity_id, requested_by_type, requested_by_id,
          status, payload, decided_by, decision_reason, decided_at
        ) VALUES ('knowledge_rollback', 'knowledge_node', $1, 'user', $2,
                  'approved', $3, $2, $4, now())
      `, [knowledgeNodeId, reviewerId, JSON.stringify({ targetRevisionId: target.id, newRevisionId: restored.id }), input.reason]);
      await this.writeAudit(client, reviewerId, 'knowledge.rollback', 'knowledge_node', knowledgeNodeId, {
        currentRevisionId: node.current_revision_id,
      }, {
        currentRevisionId: restored.id,
        restoredFromRevisionId: target.id,
        version: nextVersion,
        reason: input.reason,
      });

      return { knowledgeNodeId, revision: mapKnowledgeRevision(restored) };
    });
  }

  private async lockSubmission(client: PoolClient, id: string): Promise<LockedSubmissionRow> {
    const row = await oneOrNull<LockedSubmissionRow>(client, `
      SELECT id, author_id, topic_id, origin_type, status, current_revision_id
      FROM submissions WHERE id = $1 FOR UPDATE
    `, [id]);
    if (!row) throw new ContentRepositoryError('not_found', '候选内容不存在。');
    return row;
  }

  private async createCandidateRecord(
    client: PoolClient,
    actorId: string,
    input: CreateSubmissionInput,
    originType: SubmissionOriginType,
    triggerReason: string | null,
    proposal: { title: string; slug: string } | null = null,
  ): Promise<{ submission: SubmissionView; aiJobId: string }> {
    const topic = await oneOrNull<{ id: string }>(client, 'SELECT id FROM topics WHERE id = $1 AND is_active = true', [
      input.topicId,
    ]);
    if (!topic) throw new ContentRepositoryError('validation', '所选话题不存在或已停用。');

    const submissionId = randomUUID();
    await client.query(`
      INSERT INTO submissions (
        id, author_id, topic_id, origin_type, trigger_reason, proposed_title, proposed_slug, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'automated_screening')
    `, [submissionId, actorId, input.topicId, originType, triggerReason, proposal?.title ?? null, proposal?.slug ?? null]);

    const revisionId = randomUUID();
    await client.query(`
      INSERT INTO submission_revisions (
        id, submission_id, version, statement, why_useful, applicability, source_url,
        experience_based, ai_disclosure, created_by
      ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
    `, [
      revisionId,
      submissionId,
      input.statement,
      input.whyUseful,
      input.applicability,
      input.sourceUrl || null,
      input.experienceBased,
      input.aiDisclosure,
      actorId,
    ]);
    await client.query('UPDATE submissions SET current_revision_id = $2 WHERE id = $1', [submissionId, revisionId]);

    const config = await oneOrNull<{ value: Record<string, unknown> }>(client, `
      SELECT \`value\` FROM policy_config WHERE \`key\` = 'ai.runtime'
    `);
    const provider = typeof config?.value.provider === 'string' ? config.value.provider : 'rules';
    const model = typeof config?.value.model === 'string' ? config.value.model : 'deterministic-placeholder';
    const aiJobId = randomUUID();
    await client.query(`
      INSERT INTO ai_jobs (id, job_type, entity_type, entity_id, status, provider, model, prompt_version)
      VALUES ($1, 'screen_submission', 'submission', $2, 'queued', $3, $4, 'submission-screen-v1')
    `, [aiJobId, submissionId, provider, model]);

    await this.writeAudit(client, actorId, 'candidate.create', 'submission', submissionId, null, {
      originType,
      triggerReason,
      status: 'automated_screening',
      revisionId,
    });

    return { submission: await this.getSubmission(submissionId, client), aiJobId };
  }

  private async submissionThresholds(client: PoolClient): Promise<SubmissionThresholds> {
    const result = await client.query<{ key: string; value: Record<string, unknown> }>(`
      SELECT \`key\`, \`value\`
      FROM policy_config
      WHERE \`key\` IN ('submission.expanded_trial', 'submission.review_queue')
    `);
    const policies = new Map(result.rows.map((row) => [row.key, row.value]));
    const expanded = policies.get('submission.expanded_trial') ?? {};
    const review = policies.get('submission.review_queue') ?? {};
    const count = (value: unknown, fallback: number): number =>
      typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
    const rate = (value: unknown, fallback: number): number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;

    return {
      expandedTrial: {
        minimumUseful: count(expanded.minimumUseful, SUBMISSION_THRESHOLDS.expandedTrial.minimumUseful),
        minimumNetUseful: count(expanded.minimumNetUseful, SUBMISSION_THRESHOLDS.expandedTrial.minimumNetUseful),
        minimumUsefulnessRate: rate(
          expanded.minimumUsefulnessRate,
          SUBMISSION_THRESHOLDS.expandedTrial.minimumUsefulnessRate,
        ),
      },
      reviewQueue: {
        minimumValidVotes: count(
          review.minimumValidVotes,
          SUBMISSION_THRESHOLDS.reviewQueue.minimumValidVotes,
        ),
        minimumUsefulnessRate: rate(
          review.minimumUsefulnessRate,
          SUBMISSION_THRESHOLDS.reviewQueue.minimumUsefulnessRate,
        ),
      },
    };
  }

  private async assertUserExists(client: PoolClient, actorId: string): Promise<void> {
    const user = await oneOrNull<{ id: string }>(client, 'SELECT id FROM app_users WHERE id = $1', [actorId]);
    if (!user) throw new ContentRepositoryError('forbidden', '用户不存在或登录已失效。');
  }

  private async assertRegisteredContributor(client: PoolClient, actorId: string): Promise<void> {
    await this.assertUserExists(client, actorId);
  }

  private async assertReviewer(client: PoolClient, actorId: string): Promise<void> {
    const user = await oneOrNull<{ role: string }>(client, 'SELECT role FROM app_users WHERE id = $1', [actorId]);
    if (!user || !['reviewer', 'owner'].includes(user.role)) {
      throw new ContentRepositoryError('forbidden', '只有审核者可以执行此操作。');
    }
  }

  private async currentRevision(client: PoolClient, submission: LockedSubmissionRow): Promise<CurrentRevisionRow> {
    const row = await oneOrNull<CurrentRevisionRow>(client, `
      SELECT id, statement, ai_refined_statement, why_useful, applicability, source_url,
             experience_based, ai_disclosure, ai_risk_flags
      FROM submission_revisions WHERE id = $1
    `, [submission.current_revision_id]);
    if (!row) throw new ContentRepositoryError('not_found', '候选版本不存在。');
    return row;
  }

  private async createSourceForRevision(client: PoolClient, revision: CurrentRevisionRow): Promise<string> {
    if (!revision.source_url) {
      throw new ContentRepositoryError('validation', '正式常识必须有可核验来源，个人经验不能直接发布。');
    }
    const sourceId = randomUUID();
    await client.query(`
      INSERT INTO sources (id, publisher, title, url, source_type, license)
      VALUES ($1, '用户提交来源', $3, $2, 'community', 'link_and_fact_reference_only')
      ON DUPLICATE KEY UPDATE title = VALUES(title), accessed_at = now()
    `, [sourceId, revision.source_url, revision.statement.slice(0, 120)]);
    const source = await oneOrNull<{ id: string }>(client, 'SELECT id FROM sources WHERE url = $1', [revision.source_url]);
    if (!source) throw new Error('Failed to create source.');
    return source.id;
  }

  private async publishNewKnowledge(
    client: PoolClient,
    reviewerId: string,
    submission: LockedSubmissionRow,
    input: ReviewSubmissionInput,
  ): Promise<string> {
    if (!input.title || !input.slug) throw new ContentRepositoryError('validation', '缺少标题或 slug。');
    const revision = await this.currentRevision(client, submission);
    const sourceId = await this.createSourceForRevision(client, revision);
    const statement = revision.ai_refined_statement ?? revision.statement;
    const nodeId = randomUUID();
    await client.query(`
      INSERT INTO knowledge_nodes (
        id, topic_id, slug, title, summary, stability_level, status,
        created_from_submission_id, next_review_at
      ) VALUES ($1, $2, $3, $4, $5, 'stable', 'draft', $6, DATE_ADD(now(), INTERVAL 12 MONTH))
    `, [nodeId, submission.topic_id, input.slug, input.title, statement, submission.id]);
    const blocks = validatedKnowledgeContent([
      { type: 'paragraph', text: statement },
      { type: 'heading', level: 2, text: '为什么有用' },
      { type: 'paragraph', text: revision.why_useful },
      { type: 'heading', level: 2, text: '适用边界' },
      { type: 'paragraph', text: revision.applicability },
      { type: 'source', sourceId },
    ]);
    const revisionId = randomUUID();
    await client.query(`
      INSERT INTO knowledge_revisions (
        id, knowledge_node_id, version, content_blocks, change_summary, author_id,
        reviewer_id, review_status, ai_involvement, published_at
      ) VALUES ($1, $2, 1, $3, $4, $5, $5, 'published', 'assisted', now())
    `, [revisionId, nodeId, JSON.stringify(blocks), input.reason, reviewerId]);
    await client.query(`
      UPDATE knowledge_nodes SET status = 'published', current_revision_id = $2, updated_at = now()
      WHERE id = $1
    `, [nodeId, revisionId]);
    await client.query(`
      INSERT INTO claims (knowledge_revision_id, statement, source_id, evidence_locator, verified_by, verified_at)
      VALUES ($1, $2, $3, '', $4, now())
    `, [revisionId, statement, sourceId, reviewerId]);
    await this.linkPublishedKnowledge(client, nodeId, submission.topic_id);
    return nodeId;
  }

  private async linkPublishedKnowledge(client: PoolClient, nodeId: string, topicId: string): Promise<void> {
    const candidates = await client.query<{ id: string; strength: number }>(`
      SELECT kn.id, 0.75 AS strength
      FROM knowledge_nodes kn
      WHERE kn.status = 'published' AND kn.topic_id = $2 AND kn.id <> $1
      ORDER BY kn.updated_at DESC LIMIT 3
    `, [nodeId, topicId]);
    if (candidates.rows.length < 5) {
      const sameDomain = await client.query<{ id: string; strength: number }>(`
        SELECT kn.id, 0.45 AS strength
        FROM knowledge_nodes kn
        JOIN topics own_topic ON own_topic.id = $2
        JOIN topics other_topic ON other_topic.id = kn.topic_id
        WHERE kn.status = 'published' AND kn.id <> $1 AND kn.topic_id <> $2
          AND other_topic.domain_id = own_topic.domain_id
        ORDER BY kn.updated_at DESC LIMIT 2
      `, [nodeId, topicId]);
      candidates.rows.push(...sameDomain.rows);
    }
    for (const candidate of candidates.rows) {
      await client.query(`
        INSERT IGNORE INTO knowledge_relations
          (id, from_node_id, to_node_id, relation_type, strength, origin)
        VALUES ($1, $2, $3, 'related_to', $4, 'system_auto')
      `, [randomUUID(), nodeId, candidate.id, candidate.strength]);
    }
  }

  private async mergeIntoKnowledge(
    client: PoolClient,
    reviewerId: string,
    submission: LockedSubmissionRow,
    input: ReviewSubmissionInput,
  ): Promise<string> {
    if (!input.targetKnowledgeNodeId) throw new ContentRepositoryError('validation', '缺少目标正式常识。');
    const target = await oneOrNull<{
      id: string;
      topic_id: string;
      current_revision_id: string;
      content_blocks: unknown;
      version: number;
    }>(client, `
      SELECT kn.id, kn.topic_id, kn.current_revision_id, kr.content_blocks, kr.version
      FROM knowledge_nodes kn
      JOIN knowledge_revisions kr ON kr.id = kn.current_revision_id
      WHERE kn.id = $1 AND kn.status = 'published'
      FOR UPDATE
    `, [input.targetKnowledgeNodeId]);
    if (!target) throw new ContentRepositoryError('not_found', '目标正式常识不存在。');
    if (target.topic_id !== submission.topic_id) {
      throw new ContentRepositoryError('validation', '只能合并到同一话题下的正式常识。');
    }
    const revision = await this.currentRevision(client, submission);
    const sourceId = await this.createSourceForRevision(client, revision);
    const statement = revision.ai_refined_statement ?? revision.statement;
    const previousBlocks = Array.isArray(target.content_blocks) ? target.content_blocks : [];
    const blocks = validatedKnowledgeContent([
      ...previousBlocks,
      { type: 'heading', level: 2, text: '补充' },
      { type: 'paragraph', text: statement },
      { type: 'source', sourceId },
    ]);
    await client.query("UPDATE knowledge_revisions SET review_status = 'superseded' WHERE id = $1", [
      target.current_revision_id,
    ]);
    const revisionId = randomUUID();
    await client.query(`
      INSERT INTO knowledge_revisions (
        id, knowledge_node_id, version, content_blocks, change_summary, author_id,
        reviewer_id, review_status, ai_involvement, published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, 'published', 'assisted', now())
    `, [revisionId, target.id, target.version + 1, JSON.stringify(blocks), input.reason, reviewerId]);
    await client.query('UPDATE knowledge_nodes SET current_revision_id = $2, updated_at = now() WHERE id = $1', [
      target.id,
      revisionId,
    ]);
    await client.query(`
      INSERT INTO claims (knowledge_revision_id, statement, source_id, evidence_locator, verified_by, verified_at)
      VALUES ($1, $2, $3, '', $4, now())
    `, [revisionId, statement, sourceId, reviewerId]);
    return target.id;
  }

  private async writeAudit(
    client: PoolClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
    actorType: 'user' | 'ai' | 'system' = 'user',
  ): Promise<void> {
    await client.query(`
      INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id, before_data, after_data)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [actorType, actorId, action, entityType, entityId, JSON.stringify(beforeData), JSON.stringify(afterData)]);
  }
}
