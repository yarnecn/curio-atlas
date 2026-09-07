'use client';

import { createApiClient } from '@knowledge-map/api-client';
import { type SubmissionView, type VoteValue } from '@knowledge-map/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const api = createApiClient({
  baseUrl: '/api',
});

const statusLabels: Record<string, string> = {
  trial: '小流量尝试',
  expanded_trial: '扩大尝试',
  queued_for_review: '等待正式审核',
};

export default function SubmissionsPage() {
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      setItems(await api.submissions());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '候选内容加载失败。');
    }
  }

  useEffect(() => { void load(); }, []);

  async function vote(id: string, value: VoteValue) {
    try {
      const updated = await api.vote(id, { value });
      setItems((current) => current.map((item) => item.id === id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '评分失败。');
    }
  }

  return (
    <main className="page-shell">
      <nav><Link href="/">← 返回首页</Link><Link href="/contribute">贡献精华</Link></nav>
      <header className="page-header">
        <p className="eyebrow">TRIAL POOL · 尝试池</p>
        <h1>这条常识有用吗？</h1>
        <p>评分只决定内容是否值得继续加工；真实性仍由来源和审核负责。</p>
      </header>
      {message && <p className="form-message" role="status">{message}</p>}
      <section className="card-list">
        {items.map((item) => (
          <article className="content-card" key={item.id}>
            <div className="card-meta"><span>{item.topic.domainName} · {item.topic.name}</span><span>{statusLabels[item.status] ?? item.status}</span></div>
            <h2>{item.displayStatement}</h2>
            <p>{item.whyUseful}</p>
            <p className="boundary">适用边界：{item.applicability}</p>
            <div className="vote-row">
              <button type="button" onClick={() => void vote(item.id, 'useful')}>有用 {item.usefulCount}</button>
              <button type="button" onClick={() => void vote(item.id, 'not_useful')}>没用 {item.notUsefulCount}</button>
              <span>{Math.round(item.usefulnessRate * 100)}% 有用 · {item.validVoteCount} 个有效评分</span>
            </div>
          </article>
        ))}
        {items.length === 0 && !message && <p className="empty">暂时没有进入尝试展示的内容。</p>}
      </section>
    </main>
  );
}
