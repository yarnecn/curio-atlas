import { describe, expect, it, vi } from 'vitest';
import type { Pool } from '@knowledge-map/database';
import { NotesController, noteInput } from './notes.controller';
import type { AuthService } from '../auth/auth.service';

function setup() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const auth = { requireUser: vi.fn().mockResolvedValue({ id: 'owner-a' }) };
  const controller = new NotesController({ query } as unknown as Pool, auth as unknown as AuthService);
  return { controller, query, auth };
}
describe('private notes', () => {
  it('requires non-empty content and limits size', () => {
    for (const body of [null, {}, { content: ' ' }, { content: 'a'.repeat(5001) }]) expect(() => noteInput(body)).toThrow();
    expect(noteInput({ content: ' 一个想法 ' })).toEqual({ content: '一个想法', sourceUrl: '' });
  });
  it('accepts optional HTTP sources, never executable URLs', () => {
    expect(noteInput({ content: 'x', sourceUrl: 'https://example.com' }).sourceUrl).toBe('https://example.com');
    for (const sourceUrl of ['javascript:alert(1)', 'file:///tmp/a', 'not-a-url', 1]) expect(() => noteInput({ content: 'x', sourceUrl })).toThrow();
  });
  it('scopes reads to authenticated owner', async () => {
    const { controller, query } = setup();
    await controller.list('session', undefined, '0');
    expect(query.mock.calls[0]?.[0]).toContain('WHERE user_id = $1');
    expect(query.mock.calls[0]?.[1]).toEqual(['owner-a', 0]);
  });
  it('does not expose another user note', async () => {
    const { controller, query } = setup();
    await expect(controller.get('session', undefined, 'other-note')).rejects.toThrow('记录不存在');
    expect(query.mock.calls[0]?.[1]).toEqual(['owner-a', 'other-note']);
  });
  it('never falls back to cookie for invalid bearer credentials', async () => {
    const { controller, auth } = setup();
    await expect(controller.list('session', 'Bearer invalid')).rejects.toThrow('令牌无效');
    expect(auth.requireUser).not.toHaveBeenCalled();
  });
  it('rejects revoked tokens, queries hashes instead of secrets', async () => {
    const { controller, query } = setup();
    const raw = `km_note_${'a'.repeat(64)}`;
    await expect(controller.list(undefined, `Bearer ${raw}`)).rejects.toThrow('过期或被撤销');
    expect(query.mock.calls[0]?.[1]?.[0]).not.toBe(raw);
    expect(query.mock.calls[0]?.[0]).toContain('expires_at >');
  });
  it('scopes deletes to owner', async () => {
    const { controller, query } = setup();
    await controller.remove('session', undefined, 'other-note');
    expect(query.mock.calls[0]?.[1]).toEqual(['owner-a', 'other-note']);
  });
  it('rejects invalid pagination and idempotency keys', async () => {
    const { controller } = setup();
    await expect(controller.list('session', undefined, '-1')).rejects.toThrow();
    await expect(controller.create('session', undefined, 'x', { content: 'hi' })).rejects.toThrow();
  });
  it('returns existing record on retry without inserting a duplicate', async () => {
    const previous = { id: 'existing', content: 'idea', sourceUrl: '' };
    const query = vi.fn().mockImplementation(async (sql: string) => ({ rows: sql.includes('request_key =') ? [previous] : [], rowCount: 0 }));
    const release = vi.fn();
    const pool = { connect: async () => ({ query, release }) } as unknown as Pool;
    const auth = { requireUser: async () => ({ id: 'owner-a' }) } as unknown as AuthService;
    const controller = new NotesController(pool, auth);
    expect(await controller.create('session', undefined, 'retry-001', { content: 'idea' })).toEqual(previous);
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO personal_notes'))).toBe(false);
    expect(query.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(true);
    expect(release).toHaveBeenCalled();
  });
  it('rolls back conflicting idempotency key', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => ({ rows: sql.includes('request_key =') ? [{ content: 'original', sourceUrl: '' }] : [], rowCount: 0 }));
    const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
    const controller = new NotesController(pool, { requireUser: async () => ({ id: 'owner-a' }) } as unknown as AuthService);
    await expect(controller.create('session', undefined, 'retry-001', { content: 'different' })).rejects.toThrow('另一条内容');
    expect(query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
  });
});
