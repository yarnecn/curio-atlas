'use client';

import { createApiClient } from '@knowledge-map/api-client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

const api = createApiClient({ baseUrl: '/api' });

export function AccountRequired({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<'loading' | 'allowed' | 'signed-out'>('loading');

  useEffect(() => {
    void api.authState().then(({ user }) => setState(user ? 'allowed' : 'signed-out')).catch(() => setState('signed-out'));
  }, []);

  if (state === 'loading') return <main className="access-state"><p>正在确认登录状态…</p></main>;
  if (state === 'signed-out') return <main className="access-state"><h1>投稿前先登录</h1><p>只需要昵称账号，不要求实名、手机号或邮箱。</p><Link className="button primary" href={`/login?next=${encodeURIComponent(pathname)}`}>登录或注册</Link></main>;
  return children;
}
