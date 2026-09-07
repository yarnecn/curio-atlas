'use client';

import { createApiClient } from '@knowledge-map/api-client';
import type { AuthUserView } from '@knowledge-map/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const api = createApiClient({ baseUrl: '/api' });

export function AccountNav() {
  const [user, setUser] = useState<AuthUserView | null | undefined>(undefined);
  useEffect(() => { void api.authState().then((state) => setUser(state.user)).catch(() => setUser(null)); }, []);

  if (user === undefined) return <span className="account-state">…</span>;
  if (!user) return <Link href="/login">登录</Link>;
  return <>
    {(user.role === 'owner' || user.role === 'reviewer') && <Link className="admin-link" href="/admin/review">审核台</Link>}
    <button className="nav-button" type="button" onClick={() => void api.logout().then(() => setUser(null))}>{user.displayName} · 退出</button>
  </>;
}
