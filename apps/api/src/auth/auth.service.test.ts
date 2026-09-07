import { describe, expect, it, vi } from 'vitest';
import type { Phase1Repository } from '@knowledge-map/database';
import { AuthService, type CookieResponse } from './auth.service';

describe('AuthService', () => {
  it('stores the opaque session in an HttpOnly SameSite cookie', async () => {
    const repository = {
      loginAccount: vi.fn().mockResolvedValue({
        user: { id: 'user-1', publicHandle: 'reader', displayName: '读者', role: 'user' },
        token: 'opaque-token', expiresAt: new Date(),
      }),
    };
    const response = { setHeader: vi.fn() } as unknown as CookieResponse;
    const service = new AuthService(repository as unknown as Phase1Repository);
    await service.login({ publicHandle: 'reader', password: 'a long passphrase' }, response);
    expect(response.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.stringContaining('HttpOnly; SameSite=Lax'));
    expect(response.setHeader).toHaveBeenCalledWith('Set-Cookie', expect.not.stringContaining('localStorage'));
  });

  it('returns no user when no session cookie exists', async () => {
    const service = new AuthService({} as Phase1Repository);
    await expect(service.state(undefined)).resolves.toEqual({ user: null });
  });
});
