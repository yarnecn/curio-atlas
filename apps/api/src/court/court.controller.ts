import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, Headers, Inject, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { inTransaction, type Pool, type DatabaseClient } from '@knowledge-map/database';
import { AuthService } from '../auth/auth.service';
import { DATABASE_POOL } from '../database/database.module';

export function courtText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`请填写 1～${max} 字的内容。`);
  return value.trim();
}
export function courtChoice(value: unknown, choices: readonly string[]): string {
  if (typeof value !== 'string' || !choices.includes(value)) throw new BadRequestException('请选择有效选项。');
  return value;
}
type CaseRow = { id: string; authorId: string; title: string; story: string; category: string; demand: string; status: string; resolution: string; createdAt: string; plaintiff: number; defendant: number; peace: number };
const fields = `c.id, c.author_id AS authorId, c.title, c.story, c.category, c.demand, c.status, c.resolution, c.created_at AS createdAt,
 (SELECT COUNT(*) FROM court_votes WHERE case_id=c.id AND choice='plaintiff') AS plaintiff,
 (SELECT COUNT(*) FROM court_votes WHERE case_id=c.id AND choice='defendant') AS defendant,
 (SELECT COUNT(*) FROM court_votes WHERE case_id=c.id AND choice='peace') AS peace`;

export function courtPresentation(row: CaseRow, resultsVisible: boolean) {
  return { ...row, totalVotes: Number(row.plaintiff ?? 0) + Number(row.defendant ?? 0) + Number(row.peace ?? 0), resultsVisible,
    plaintiff: resultsVisible ? row.plaintiff : null, defendant: resultsVisible ? row.defendant : null, peace: resultsVisible ? row.peace : null };
}

@Controller('court')
export class CourtController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool, @Inject(AuthService) private readonly auth: AuthService) {}

  private async row(client: DatabaseClient, id: string, lock = false) {
    const row = (await client.query<CaseRow>(`SELECT ${fields} FROM court_cases c WHERE c.id=$1${lock ? ' FOR UPDATE' : ''}`, [id])).rows[0];
    if (!row) throw new NotFoundException('案件不存在。');
    return row;
  }
  private async reviewer(cookie?: string) {
    const user = await this.auth.requireUser(cookie);
    if (!['owner', 'reviewer'].includes(user.role)) throw new ForbiddenException('仅审核员可以操作。');
    return user;
  }

  @Get('cases')
  @Header('Cache-Control', 'no-store')
  async list(@Query('scope') scope = 'public', @Query('offset') offset = '0', @Headers('cookie') cookie?: string) {
    if (!/^\d{1,6}$/.test(offset)) throw new BadRequestException('分页参数不正确。');
    let where = "c.status IN ('open','closed')";
    const values: unknown[] = [];
    if (scope === 'mine') { values.push((await this.auth.requireUser(cookie)).id); where = 'c.author_id=$1'; }
    else if (scope === 'review') { await this.reviewer(cookie); where = "c.status='pending'"; }
    else if (scope !== 'public') throw new BadRequestException('列表类型不正确。');
    values.push(Number(offset));
    const rows = (await this.pool.query<CaseRow>(`SELECT ${fields} FROM court_cases c WHERE ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT 20 OFFSET $${values.length}`, values)).rows;
    return rows.map(row => courtPresentation(row, row.status === 'closed' || scope !== 'public'));
  }

  @Post('cases')
  async create(@Headers('cookie') cookie: string | undefined, @Body() body: Record<string, unknown>) {
    const user = await this.auth.requireUser(cookie);
    const title = courtText(body?.title, 60), story = courtText(body?.story, 2000), demand = courtText(body?.demand, 120);
    const category = courtChoice(body?.category, ['恋爱', '室友', '友情', '家庭', '自己']);
    return inTransaction(this.pool, async (client) => {
      await client.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [user.id]);
      const count = await client.query<{ total: number }>('SELECT COUNT(*) AS total FROM court_cases WHERE author_id=$1 AND created_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)', [user.id]);
      if (Number(count.rows[0]?.total) >= 10) throw new BadRequestException('今天已立案 10 次，明天再来吧。');
      const id = randomUUID();
      await client.query('INSERT INTO court_cases (id, author_id, title, story, category, demand) VALUES ($1,$2,$3,$4,$5,$6)', [id, user.id, title, story, category, demand]);
      return this.row(client, id);
    });
  }

  @Get('cases/:id')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('id') id: string, @Headers('cookie') cookie?: string) {
    const row = await this.row(this.pool, id);
    const user = (await this.auth.state(cookie)).user;
    const moderator = !!user && ['owner', 'reviewer'].includes(user.role);
    if (!['open', 'closed'].includes(row.status) && row.authorId !== user?.id && !moderator) throw new NotFoundException('案件暂未公开。');
    const comments = (await this.pool.query<{ id: string; userId: string; role: string; content: string; status: string }>(`SELECT id, user_id AS userId, role, content, status, created_at AS createdAt FROM court_comments WHERE case_id=$1 AND (status='approved' OR user_id=$2 OR $3=1) ORDER BY created_at ASC LIMIT 100`, [id, user?.id ?? '', moderator ? 1 : 0])).rows;
    const vote = user ? (await this.pool.query<{ choice: string }>('SELECT choice FROM court_votes WHERE case_id=$1 AND user_id=$2', [id, user.id])).rows[0]?.choice : null;
    const isAuthor = row.authorId === user?.id;
    const defense = user ? await this.pool.query("SELECT id FROM court_comments WHERE case_id=$1 AND user_id=$2 AND role='被告' AND status<>'rejected' LIMIT 1", [id, user.id]) : null;
    const isDefendant = !!defense?.rows.length;
    const resultsVisible = row.status === 'closed' || !!vote || isAuthor || isDefendant || moderator;
    return { ...courtPresentation(row, resultsVisible), comments, myVote: vote ?? null, isAuthor, isDefendant };
  }

  @Put('cases/:id/vote')
  async vote(@Param('id') id: string, @Headers('cookie') cookie: string | undefined, @Body() body: Record<string, unknown>) {
    const user = await this.auth.requireUser(cookie);
    const choice = courtChoice(body?.choice, ['plaintiff', 'defendant', 'peace']);
    return inTransaction(this.pool, async (client) => {
      const row = await this.row(client, id, true);
      if (row.status !== 'open') throw new BadRequestException('本案暂不接受投票。');
      if (row.authorId === user.id) throw new ForbiddenException('原告不能给自己的案件投票。');
      const defense = await client.query("SELECT id FROM court_comments WHERE case_id=$1 AND user_id=$2 AND role='被告' AND status<>'rejected' LIMIT 1", [id, user.id]);
      if (defense.rows.length) throw new ForbiddenException('已应诉的当事人不能参加陪审投票。');
      await client.query('INSERT INTO court_votes (case_id,user_id,choice) VALUES ($1,$2,$3) ON DUPLICATE KEY UPDATE choice=$3', [id, user.id, choice]);
      return this.row(client, id);
    });
  }

  @Post('cases/:id/comments')
  async comment(@Param('id') id: string, @Headers('cookie') cookie: string | undefined, @Body() body: Record<string, unknown>) {
    const user = await this.auth.requireUser(cookie);
    const content = courtText(body?.content, 600), role = courtChoice(body?.role, ['原告律师', '被告律师', '和事佬', '证人', '被告', '提问', '补充线索', '结案提案', '改判理由']);
    return inTransaction(this.pool, async (client) => {
      const row = await this.row(client, id, true);
      if (row.status !== 'open') throw new BadRequestException('本案暂不接受发言。');
      if (role === '被告') {
        if (row.authorId === user.id) throw new BadRequestException('原告不能同时作为被告。');
        await client.query('DELETE FROM court_votes WHERE case_id=$1 AND user_id=$2', [id, user.id]);
      }
      const count = await client.query<{ total: number }>('SELECT COUNT(*) AS total FROM court_comments WHERE case_id=$1 AND user_id=$2 AND created_at>DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)', [id, user.id]);
      if (Number(count.rows[0]?.total) >= 10) throw new BadRequestException('本案今天已发言 10 次，让其他陪审员说两句吧。');
      await client.query('INSERT INTO court_comments (id,case_id,user_id,role,content) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), id, user.id, role, content]);
      return { message: '发言已提交，审核后公开。' };
    });
  }

  @Put('cases/:id/close')
  async close(@Param('id') id: string, @Headers('cookie') cookie: string | undefined, @Body() body: Record<string, unknown>) {
    const user = await this.auth.requireUser(cookie);
    const resolution = courtChoice(body?.resolution, ['已达成共识', '保留不同意见', '撤回案件', '暂时封存', '已赔一顿饭', '双方已和好', '笑场撤诉']);
    const result = await this.pool.query("UPDATE court_cases SET status='closed', resolution=$1 WHERE id=$2 AND author_id=$3 AND status='open'", [resolution, id, user.id]);
    if (!result.rowCount) throw new BadRequestException('只有原告可以为开庭中的案件结案。');
    return this.row(this.pool, id);
  }

  @Get('review/comments')
  @Header('Cache-Control', 'no-store')
  async pendingComments(@Headers('cookie') cookie?: string) {
    await this.reviewer(cookie);
    return (await this.pool.query("SELECT id, case_id AS caseId, role, content FROM court_comments WHERE status='pending' ORDER BY created_at ASC LIMIT 50")).rows;
  }

  @Put('review/:kind/:id')
  async review(@Param('kind') kind: string, @Param('id') id: string, @Headers('cookie') cookie: string | undefined, @Body() body: Record<string, unknown>) {
    await this.reviewer(cookie);
    courtChoice(kind, ['case', 'comment']);
    const decision = courtChoice(body?.decision, ['approve', 'reject']);
    const table = kind === 'case' ? 'court_cases' : 'court_comments';
    const status = decision === 'reject' ? 'rejected' : kind === 'case' ? 'open' : 'approved';
    const result = await this.pool.query(`UPDATE ${table} SET status=$1 WHERE id=$2 AND status='pending'`, [status, id]);
    if (!result.rowCount) throw new BadRequestException('内容不存在或已审核。');
    return { ok: true };
  }
}
