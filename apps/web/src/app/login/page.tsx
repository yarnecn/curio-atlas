'use client';

import { createApiClient } from '@knowledge-map/api-client';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

const api = createApiClient({ baseUrl: '/api' });

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [nextPath, setNextPath] = useState('/');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('next');
    if (requested?.startsWith('/') && !requested.startsWith('//')) setNextPath(requested);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setMessage('');
    const data = new FormData(event.currentTarget);
    const publicHandle = String(data.get('publicHandle') ?? '');
    const password = String(data.get('password') ?? '');
    try {
      if (mode === 'register') {
        await api.register({ publicHandle, displayName: String(data.get('displayName') ?? '') || undefined, password });
      } else {
        await api.login({ publicHandle, password });
      }
      window.location.assign(nextPath);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败。');
    } finally { setWorking(false); }
  }

  return <main className="page-shell auth-shell">
    <nav><Link href="/">← 继续随便看看</Link></nav>
    <header className="page-header compact-header"><p className="eyebrow">ACCOUNT · 昵称账号</p><h1>{mode === 'login' ? '登录' : '注册'}</h1><p>阅读永远不需要登录。投稿和评分只使用昵称账号，不要求实名、手机号或邮箱。</p></header>
    <div className="auth-switch" role="tablist"><button type="button" aria-selected={mode === 'login'} onClick={() => setMode('login')}>登录</button><button type="button" aria-selected={mode === 'register'} onClick={() => setMode('register')}>注册</button></div>
    <form className="editor-card" onSubmit={submit}>
      <label>账号<input name="publicHandle" required minLength={3} maxLength={32} pattern="[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?" autoComplete="username" placeholder="小写英文、数字、_ 或 -" /></label>
      {mode === 'register' && <label>显示昵称（可不填）<input name="displayName" minLength={2} maxLength={40} autoComplete="nickname" /></label>}
      <label>密码<input name="password" type="password" required minLength={mode === 'register' ? 10 : 1} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
      <button className="button primary" type="submit" disabled={working}>{working ? '处理中…' : mode === 'login' ? '登录' : '创建昵称账号'}</button>
      {message && <p className="form-message" role="status">{message}</p>}
    </form>
  </main>;
}
