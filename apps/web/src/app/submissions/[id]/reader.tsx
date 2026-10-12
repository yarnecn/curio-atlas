'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createApiClient } from '@knowledge-map/api-client';
import type { SubmissionView, VoteValue } from '@knowledge-map/contracts';

const api = createApiClient({ baseUrl: '/api' });

export function CandidateDetail({ id }: { id: string }) {
  const [item, setItem] = useState<SubmissionView | null>(null);
  const [error, setError] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const voting = useRef(false);
  useEffect(() => {
    let active = true;
    setItem(null); setError(''); setMessage('');
    void api.authState().then(({ user }) => { if (active) setHandle(user?.publicHandle ?? null); }).catch(() => {});
    void fetch(`/api/submissions/${encodeURIComponent(id)}`, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('候选不存在、尚未公开或已结束试读。');
      const value = await response.json(); if (active) setItem(value);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [id]);
  async function vote(value: VoteValue) {
    if (!item || voting.current) return;
    voting.current = true; setBusy(true); setMessage('');
    try {
      const { user } = await api.authState();
      setHandle(user?.publicHandle ?? null);
      if (!user) { setMessage('登录后可以评分，阅读无需登录。'); return; }
      if (user.publicHandle === item.authorHandle) { setMessage('这是你的投稿，不能为自己评分。'); return; }
      const updated = await api.vote(item.id, { value });
      setItem(current => current?.id === updated.id ? updated : current);
      setMessage('评分已记录，谢谢反馈。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '评分失败，请重试。'); }
    finally { voting.current = false; setBusy(false); }
  }
  const own = !!item && handle === item.authorHandle;
  return <main className="page-shell"><nav><Link href="/">返回首页</Link><Link href="/submissions">候选列表与评分</Link></nav>
    {error ? <p role="alert">{error}</p> : !item ? <p>正在加载…</p> : <article className="editor-card">
      <p className="eyebrow">试读 · 已初审，尚未正式收录</p>
      <h1>{item.proposedTitle || `${item.topic.name} · 候选试读`}</h1>
      <p>{item.topic.domainName} · {item.topic.name} · {item.authorHandle}</p>
      <h2>摘要 / 核心结论</h2><p style={{ whiteSpace: 'pre-wrap' }}>{item.displayStatement}</p>
      <h2>解释与用途</h2><p style={{ whiteSpace: 'pre-wrap' }}>{item.whyUseful}</p>
      {item.applicability && <><h2>需要注意</h2><p>{item.applicability}</p></>}
      {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源</a>}
      <p>有用 {item.usefulCount} · 没用 {item.notUsefulCount}。评分不是事实核验，正式发布仍需审核。</p>
      {own ? <p>这是你的投稿，等待其他读者反馈；不能为自己评分。</p> : <div className="vote-row">
        <button disabled={busy} onClick={() => void vote('useful')}>有用 {item.usefulCount}</button>
        <button disabled={busy} onClick={() => void vote('not_useful')}>没用 {item.notUsefulCount}</button>
      </div>}
      {!handle && <p><Link href={`/login?next=${encodeURIComponent(`/submissions/${id}`)}`}>登录后参与评分</Link>，无需登录也可以阅读。</p>}
      {message && <p role="status">{message}</p>}
    </article>}</main>;
}
