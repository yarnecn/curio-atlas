'use client';

import { createApiClient } from '@knowledge-map/api-client';
import { PRODUCT_NAME, type KnowledgeNodeSummary, type TopicSummary } from '@knowledge-map/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AccountNav } from '../components/account-nav';

const api = createApiClient({
  baseUrl: '/api',
});
const PAGE_SIZE = 12;

function rotateItems(items: KnowledgeNodeSummary[], offset: number, count = PAGE_SIZE): KnowledgeNodeSummary[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) => items[(offset + index) % items.length])
    .filter((item): item is KnowledgeNodeSummary => Boolean(item));
}

function proportionalItems(items: KnowledgeNodeSummary[], offset: number): KnowledgeNodeSummary[] {
  if (items.length <= PAGE_SIZE) return items;
  const buckets = [...new Map(items.map((item) => [item.domainName, items.filter((candidate) => candidate.domainName === item.domainName)])).values()];
  const target = Math.min(PAGE_SIZE, items.length);
  const quotas = buckets.map((bucket) => ({
    bucket,
    quota: Math.min(bucket.length, Math.max(1, Math.floor(bucket.length / items.length * target))),
    remainder: bucket.length / items.length * target % 1,
  }));
  while (quotas.reduce((sum, item) => sum + item.quota, 0) > target) {
    const candidate = [...quotas].filter((item) => item.quota > 1).sort((a, b) => a.remainder - b.remainder)[0];
    if (!candidate) break;
    candidate.quota -= 1;
  }
  while (quotas.reduce((sum, item) => sum + item.quota, 0) < target) {
    const candidate = [...quotas]
      .filter((item) => item.quota < item.bucket.length)
      .sort((a, b) => b.remainder - a.remainder || b.bucket.length - a.bucket.length)[0];
    if (!candidate) break;
    candidate.quota += 1;
    candidate.remainder = -1;
  }
  const selected = quotas.map(({ bucket, quota }, bucketIndex) => rotateItems(bucket, offset + bucketIndex, quota));
  const result: KnowledgeNodeSummary[] = [];
  for (let row = 0; result.length < target; row += 1) {
    for (const bucket of selected) {
      const item = bucket[row];
      if (item) result.push(item);
    }
  }
  return result;
}

export default function Home() {
  const [nodes, setNodes] = useState<KnowledgeNodeSummary[]>([]);
  const [taxonomy, setTaxonomy] = useState<TopicSummary[]>([]);
  const [domain, setDomain] = useState('全部');
  const [offset, setOffset] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([api.knowledgeNodes(), api.topics()])
      .then(([availableNodes, availableTopics]) => {
        setNodes(availableNodes);
        setTaxonomy(availableTopics);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '正式常识加载失败。'));
  }, []);

  const domains = useMemo(
    () => ['全部', ...new Set(taxonomy.map((topic) => topic.domainName))],
    [taxonomy],
  );
  const matchingNodes = domain === '全部' ? nodes : nodes.filter((node) => node.domainName === domain);
  const visibleNodes = domain === '全部'
    ? proportionalItems(matchingNodes, offset)
    : rotateItems(matchingNodes, offset);

  function selectDomain(nextDomain: string) {
    setDomain(nextDomain);
    setOffset(0);
  }

  function rotate() {
    setOffset((current) => matchingNodes.length === 0 ? 0 : (current + PAGE_SIZE) % matchingNodes.length);
  }

  return (
    <main className="discovery-shell">
      <header className="site-header">
        <Link className="wordmark" href="/">{PRODUCT_NAME}</Link>
        <nav aria-label="主要导航">
          <Link aria-current="page" href="/">发现</Link>
          <Link href="/submissions">候选</Link>
          <Link href="/contribute">贡献</Link>
          <AccountNav />
        </nav>
      </header>

      <section className="discovery-intro">
        <div>
          <p className="eyebrow">已审核常识</p>
          <h1>随便看看</h1>
        </div>
        <p>{taxonomy.length > 0 ? `${nodes.length} 条已发布 · 已规划 ${domains.length - 1} 个领域、${taxonomy.length} 个细分话题` : '正在整理今天的内容'}</p>
      </section>

      <div className="discovery-toolbar">
        <div className="topic-tabs" role="tablist" aria-label="按知识领域筛选">
          {domains.map((item) => (
            <button
              aria-selected={domain === item}
              key={item}
              onClick={() => selectDomain(item)}
              role="tab"
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <button className="rotate-button" onClick={rotate} type="button">换一批</button>
      </div>

      {message && <p className="form-message" role="status">{message}</p>}
      <section className="knowledge-grid" aria-live="polite">
        {visibleNodes.map((node) => (
          <article className="knowledge-card" key={node.id}>
            <div className="knowledge-meta">
              <span>{node.domainName} · {node.topicName}</span>
              <span>约 {node.readingTimeMinutes} 分钟</span>
            </div>
            <h2><Link href={`/knowledge/${node.slug}`}>{node.title}</Link></h2>
            <div className="knowledge-body">
              {node.sections.map((section, index) => (
                <section className="knowledge-section" key={`${section.heading ?? '核心内容'}-${index}`}>
                  {section.heading && <h3>{section.heading}</h3>}
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </section>
              ))}
            </div>
            <Link className="reviewed-mark" href={`/knowledge/${node.slug}`}>已审核 · 查看相关常识 →</Link>
          </article>
        ))}
        {nodes.length > 0 && matchingNodes.length === 0 && (
          <p className="empty">“{domain}”已经列入 V1 目录，首批内容正在补齐和审核。</p>
        )}
        {nodes.length === 0 && !message && <p className="empty">正在读取正式常识...</p>}
      </section>
    </main>
  );
}
