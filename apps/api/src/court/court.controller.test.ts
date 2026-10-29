import { describe, expect, it, vi } from 'vitest';
import type { Pool } from '@knowledge-map/database';
import type { AuthService } from '../auth/auth.service';
import { CourtController, courtChoice, courtText } from './court.controller';

function setup(role = 'user', status = 'open', authorId = 'author') {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT c.id')) return { rows: [{ id: 'case', authorId, status, plaintiff: 4, defendant: 2, peace: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  });
  const release = vi.fn();
  const pool = { query, connect: vi.fn(async () => ({ query, release })) } as unknown as Pool;
  const user = { id: 'visitor', role };
  const auth = { requireUser: vi.fn(async () => user), state: vi.fn(async () => ({ user })) } as unknown as AuthService;
  return { court: new CourtController(pool, auth), query, release };
}

describe('court access and lifecycle', () => {
  it('validates bounded text and enumerated actions', () => {
    for (const value of [null, '', ' ', 123, 'x'.repeat(61)]) expect(() => courtText(value, 60)).toThrow();
    expect(courtText(' 案名 ', 60)).toBe('案名');
    expect(() => courtChoice('invalid', ['approve', 'reject'])).toThrow();
  });
  it('hides unpublished cases from strangers', async () => {
    await expect(setup('user', 'pending').court.detail('case')).rejects.toThrow('暂未公开');
  });
  it('requires a moderator to see the moderation queue', async () => {
    const { court, query } = setup();
    await expect(court.list('review')).rejects.toThrow('仅审核员');
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects self votes and rolls back the transaction', async () => {
    const { court, query, release } = setup('user', 'open', 'visitor');
    await expect(court.vote('case', undefined, { choice: 'plaintiff' })).rejects.toThrow('自己的案件');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
  it('rejects voting and speaking after closure', async () => {
    const { court } = setup('user', 'closed');
    await expect(court.vote('case', undefined, { choice: 'peace' })).rejects.toThrow('不接受投票');
    await expect(court.comment('case', undefined, { role: '证人', content: '证词' })).rejects.toThrow('不接受发言');
  });
  it('prevents arbitrary verdict text from bypassing moderation', async () => {
    const { court, query } = setup();
    await expect(court.close('case', undefined, { resolution: '未经审核的内容' })).rejects.toThrow('有效选项');
    expect(query).not.toHaveBeenCalled();
  });
  it('scopes closure to author and open status', async () => {
    const { court, query } = setup();
    await expect(court.close('case', undefined, { resolution: '笑场撤诉' })).rejects.toThrow('只有原告');
    expect(query.mock.calls[0]?.[0]).toContain("author_id=$3 AND status='open'");
  });
  it('rejects unknown scope and pagination', async () => {
    const { court } = setup();
    await expect(court.list('invalid')).rejects.toThrow();
    await expect(court.list('public', '-1')).rejects.toThrow();
  });
  it('hides vote distribution in the public feed while retaining participation count', async () => {
    const rows = await setup().court.list();
    expect(rows[0]).toMatchObject({ totalVotes: 7, resultsVisible: false, plaintiff: null, defendant: null, peace: null });
  });
  it('hides distribution in detail before the visitor votes', async () => {
    const row = await setup().court.detail('case');
    expect(row).toMatchObject({ myVote: null, resultsVisible: false, plaintiff: null, defendant: null, peace: null });
  });
  it('reveals the final distribution once closed', async () => {
    const row = await setup('user', 'closed').court.detail('case');
    expect(row).toMatchObject({ resultsVisible: true, plaintiff: 4, defendant: 2, peace: 1 });
  });
  it('lets the author follow their own case without self voting', async () => {
    const row = await setup('user', 'open', 'visitor').court.detail('case');
    expect(row).toMatchObject({ isAuthor: true, resultsVisible: true, plaintiff: 4 });
  });
});
