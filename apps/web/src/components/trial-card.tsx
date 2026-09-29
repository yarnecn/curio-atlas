'use client';

import { useEffect, useState } from 'react';
import { createApiClient } from '@knowledge-map/api-client';
import type { SubmissionView, VoteValue } from '@knowledge-map/contracts';

const api = createApiClient({ baseUrl: '/api' });

export function TrialCard({ domain, creator, search, batch }: { domain: string; creator: string; search: string; batch: number }) {
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api.submissions().then(setItems).catch(() => setItems([])); }, []);
  useEffect(() => { setMessage(''); }, [domain, creator, search, batch]);
  const pool = items.filter((item) => item.initialReviewRequired === false
    && item.originType === 'user_submission'
    && (domain === '全部' || item.topic.domainName === domain)
    && creator === 'all'
    && (!search.trim() || `${item.displayStatement} ${item.topic.name}`.toLowerCase().includes(search.trim().toLowerCase())));
  const item = pool[batch % pool.length];
  if (!item) return null;
  async function vote(value: VoteValue) {
    if (!item || busy) return;
    setBusy(true); setMessage('');
    try {
      const { user } = await api.authState();
      if (!user) { setMessage('登录后可以评分，阅读无需登录。'); return; }
      if (user.publicHandle === item.authorHandle) { setMessage('不能为自己的投稿评分。'); return; }
      const updated = await api.vote(item.id, { value });
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMessage('评分已记录，谢谢反馈。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '评分失败，请重试。'); }
    finally { setBusy(false); }
  }
  return <article className="content-card trial-discovery-card">
    <p className="eyebrow">试读 · 已通过初审，尚未正式收录</p>
    <p className="card-meta">{item.topic.name} · {item.authorHandle}</p>
    <p className="candidate-body">{item.displayStatement}</p>
    {item.applicability && <p className="candidate-note">需要注意：{item.applicability}</p>}
    {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a>}
    <div className="vote-row">
      <button disabled={busy} onClick={() => void vote('useful')}>有用 {item.usefulCount}</button>
      <button disabled={busy} onClick={() => void vote('not_useful')}>没用 {item.notUsefulCount}</button>
    </div>
    {message && <p role="status">{message}</p>}
  </article>;
}
