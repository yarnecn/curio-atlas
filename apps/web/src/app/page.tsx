'use client';

import { createApiClient } from '@knowledge-map/api-client';
import {
  PRODUCT_NAME,
  type KnowledgeCreatorKind,
  type KnowledgeNodeSummary,
  type TopicSummary,
} from '@knowledge-map/contracts';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AccountNav } from '../components/account-nav';

const api = createApiClient({
  baseUrl: '/api',
});
const PAGE_SIZE = 12;
type CreatorFilter = 'all' | KnowledgeCreatorKind;
const creatorFilters: { value: CreatorFilter; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'system', label: '系统内容' },
  { value: 'owner', label: '站长创建' },
  { value: 'contributor', label: '用户投稿' },
];

function rotateItems(items: KnowledgeNodeSummary[], offset: number, count = PAGE_SIZE): KnowledgeNodeSummary[] {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) => items[(offset + index) % items.length])
    .filter((item): item is KnowledgeNodeSummary => Boolean(item));
}

function proportionalItems(items: KnowledgeNodeSummary[], batch: number): KnowledgeNodeSummary[] {
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
  // Rotate by batch, not by the global page offset. A two-item domain would
  // otherwise repeat at the same position when the page advances by 12.
  const selected = quotas.map(({ bucket, quota }, bucketIndex) => rotateItems(bucket, batch + bucketIndex, quota));
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
  const [creator, setCreator] = useState<CreatorFilter>('all');
  const [batch, setBatch] = useState(0);
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
  const matchingNodes = nodes.filter((node) => (
    (domain === '全部' || node.domainName === domain)
    && (creator === 'all' || node.creatorKind === creator)
  ));
  const visibleNodes = domain === '全部'
    ? proportionalItems(matchingNodes, batch)
    : rotateItems(matchingNodes, batch * PAGE_SIZE);

  function selectDomain(nextDomain: string) {
    setDomain(nextDomain);
    setBatch(0);
  }

  function selectCreator(nextCreator: CreatorFilter) {
    setCreator(nextCreator);
    setBatch(0);
  }

  function rotate() {
    setBatch((current) => matchingNodes.length === 0 ? 0 : current + 1);
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
        <div className="discovery-filters">
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
          <div className="creator-tabs" role="tablist" aria-label="按资料创建者筛选">
            {creatorFilters.map((item) => (
              <button
                aria-selected={creator === item.value}
                key={item.value}
                onClick={() => selectCreator(item.value)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
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
            <button
              aria-pressed={creator === node.creatorKind}
              className="creator-mark"
              data-kind={node.creatorKind}
              onClick={() => selectCreator(node.creatorKind)}
              title={`只看${node.creatorLabel}的资料`}
              type="button"
            >
              {node.creatorLabel}{node.creatorKind === 'contributor' && node.creatorHandle ? ` · ${node.creatorHandle}` : ''}
            </button>
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
          <p className="empty">当前领域和创建者组合下还没有已发布常识。</p>
        )}
        {nodes.length === 0 && !message && <p className="empty">正在读取正式常识...</p>}
      </section>
    </main>
  );
}
