'use client';

import { createApiClient } from '@knowledge-map/api-client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

const api = createApiClient({ baseUrl: '/api' });

export function AdminGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'allowed' | 'forbidden'>('loading');

  useEffect(() => {
    void api.authState().then(({ user }) => {
      if (!user) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setState(user.role === 'owner' || user.role === 'reviewer' ? 'allowed' : 'forbidden');
    }).catch(() => router.replace(`/login?next=${encodeURIComponent(pathname)}`));
  }, [pathname, router]);

  if (state === 'loading') return <main className="access-state"><p>正在确认登录状态…</p></main>;
  if (state === 'forbidden') return <main className="access-state"><h1>没有审核权限</h1><p>普通账号可以投稿和评分，但不能进入后台。</p><Link href="/">返回首页</Link></main>;
  return children;
}
