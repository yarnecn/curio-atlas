import { BadRequestException, Body, Controller, Delete, Get, Headers, Inject, NotFoundException, Param, Post, Put, Query, UnauthorizedException, Header } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { inTransaction, type Pool } from '@knowledge-map/database';
import { AuthService } from '../auth/auth.service';
import { DATABASE_POOL } from '../database/database.module';

export function noteInput(body: unknown): { content: string; sourceUrl: string } {
  if (!body || typeof body !== 'object') throw new BadRequestException('请输入记录内容。');
  const value = body as Record<string, unknown>;
  if (typeof value.content !== 'string' || !value.content.trim() || value.content.trim().length > 5000) throw new BadRequestException('记录内容需要 1～5000 字。');
  if (value.sourceUrl !== undefined && typeof value.sourceUrl !== 'string') throw new BadRequestException('来源网址格式不正确。');
  const sourceUrl = (value.sourceUrl as string | undefined)?.trim() ?? '';
  if (sourceUrl) {
    try { if (sourceUrl.length > 2048 || !['http:', 'https:'].includes(new URL(sourceUrl).protocol)) throw new Error(); }
    catch { throw new BadRequestException('来源只支持 HTTP 或 HTTPS 网址。'); }
  }
  return { content: value.content.trim(), sourceUrl };
}

type NoteRow = { id: string; content: string; sourceUrl: string; createdAt: string; updatedAt: string };
const fields = 'id, content, source_url AS sourceUrl, created_at AS createdAt, updated_at AS updatedAt';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Controller('notes')
export class NotesController {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool, @Inject(AuthService) private readonly auth: AuthService) {}

  private async actor(cookie: string | undefined, authorization: string | undefined): Promise<string> {
    if (authorization !== undefined) {
      if (!/^Bearer km_note_[a-f0-9]{64}$/.test(authorization)) throw new UnauthorizedException('记录令牌无效。');
      const result = await this.pool.query<{ user_id: string }>('SELECT user_id FROM personal_note_tokens WHERE token_hash = $1 AND expires_at > UTC_TIMESTAMP(3)', [hash(authorization.slice(7))]);
      if (!result.rows[0]) throw new UnauthorizedException('记录令牌已过期或被撤销。');
      return result.rows[0].user_id;
    }
    return (await this.auth.requireUser(cookie)).id;
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Headers('cookie') cookie: string | undefined, @Headers('authorization') authorization: string | undefined, @Query('offset') offset = '0') {
    const actor = await this.actor(cookie, authorization);
    if (!/^\d{1,7}$/.test(offset)) throw new BadRequestException('分页参数不正确。');
    return (await this.pool.query<NoteRow>(`SELECT ${fields} FROM personal_notes WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET $2`, [actor, Number(offset)])).rows;
  }

  @Get('tokens')
  @Header('Cache-Control', 'no-store')
  async tokens(@Headers('cookie') cookie: string | undefined) {
    const user = await this.auth.requireUser(cookie);
    return (await this.pool.query('SELECT id, name, expires_at AS expiresAt FROM personal_note_tokens WHERE user_id = $1 ORDER BY created_at DESC', [user.id])).rows;
  }

  @Post('tokens')
  @Header('Cache-Control', 'no-store')
  async token(@Headers('cookie') cookie: string | undefined, @Body() body: unknown) {
    const user = await this.auth.requireUser(cookie);
    const name = body && typeof body === 'object' && 'name' in body ? body.name : undefined;
    if (typeof name !== 'string' || !name.trim() || name.length > 60) throw new BadRequestException('请填写 1～60 字的令牌名称。');
    return inTransaction(this.pool, async (client) => {
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [user.id]);
      const count = await client.query<{ total: number }>('SELECT COUNT(*) AS total FROM personal_note_tokens WHERE user_id = $1 AND expires_at > UTC_TIMESTAMP(3)', [user.id]);
      if (Number(count.rows[0]?.total) >= 5) throw new BadRequestException('最多保留 5 个有效令牌，请先撤销旧令牌。');
      const token = `km_note_${randomBytes(32).toString('hex')}`;
      const id = randomUUID();
      await client.query('INSERT INTO personal_note_tokens (id, user_id, token_hash, name, expires_at) VALUES ($1, $2, $3, $4, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 90 DAY))', [id, user.id, hash(token), name.trim()]);
      return { id, token };
    });
  }

  @Delete('tokens/:id')
  async revoke(@Headers('cookie') cookie: string | undefined, @Param('id') id: string) {
    const user = await this.auth.requireUser(cookie);
    await this.pool.query('DELETE FROM personal_note_tokens WHERE user_id = $1 AND id = $2', [user.id, id]);
    return { ok: true };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async get(@Headers('cookie') cookie: string | undefined, @Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const actor = await this.actor(cookie, authorization);
    const row = (await this.pool.query<NoteRow>(`SELECT ${fields} FROM personal_notes WHERE user_id = $1 AND id = $2`, [actor, id])).rows[0];
    if (!row) throw new NotFoundException('记录不存在。');
    return row;
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  async create(@Headers('cookie') cookie: string | undefined, @Headers('authorization') authorization: string | undefined, @Headers('idempotency-key') key: string | undefined, @Body() body: unknown) {
    const actor = await this.actor(cookie, authorization);
    const input = noteInput(body);
    if (key !== undefined && !/^[a-zA-Z0-9_-]{8,80}$/.test(key)) throw new BadRequestException('幂等键需要 8～80 位字母、数字、下划线或短横线。');
    const requestKey = key ?? randomUUID();
    return inTransaction(this.pool, async (client) => {
      await client.query('SELECT id FROM app_users WHERE id = $1 FOR UPDATE', [actor]);
      const previous = (await client.query<NoteRow>(`SELECT ${fields} FROM personal_notes WHERE user_id = $1 AND request_key = $2`, [actor, requestKey])).rows[0];
      if (previous) {
        if (previous.content !== input.content || previous.sourceUrl !== input.sourceUrl) throw new BadRequestException('该幂等键已用于另一条内容。');
        return previous;
      }
      const count = await client.query<{ total: number }>('SELECT COUNT(*) AS total FROM personal_notes WHERE user_id = $1 AND created_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)', [actor]);
      if (Number(count.rows[0]?.total) >= 100) throw new BadRequestException('每天最多保存 100 条记录，请明天再试。');
      const id = randomUUID();
      await client.query('INSERT INTO personal_notes (id, user_id, content, source_url, request_key) VALUES ($1, $2, $3, $4, $5)', [id, actor, input.content, input.sourceUrl, requestKey]);
      return (await client.query<NoteRow>(`SELECT ${fields} FROM personal_notes WHERE id = $1`, [id])).rows[0];
    });
  }

  @Put(':id')
  async update(@Headers('cookie') cookie: string | undefined, @Headers('authorization') authorization: string | undefined, @Param('id') id: string, @Body() body: unknown) {
    const actor = await this.actor(cookie, authorization);
    const input = noteInput(body);
    const result = await this.pool.query('UPDATE personal_notes SET content = $1, source_url = $2, updated_at = UTC_TIMESTAMP(3) WHERE user_id = $3 AND id = $4', [input.content, input.sourceUrl, actor, id]);
    if (!result.rowCount) throw new NotFoundException('记录不存在。');
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Headers('cookie') cookie: string | undefined, @Headers('authorization') authorization: string | undefined, @Param('id') id: string) {
    const actor = await this.actor(cookie, authorization);
    await this.pool.query('DELETE FROM personal_notes WHERE user_id = $1 AND id = $2', [actor, id]);
    return { ok: true };
  }
}
