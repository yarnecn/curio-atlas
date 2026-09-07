'use client';

import { createApiClient } from '@knowledge-map/api-client';
import type { KnowledgeNodeDetail, KnowledgeRelationType } from '@knowledge-map/contracts';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';

const api = createApiClient({ baseUrl: '/api' });
const relationLabels: Record<KnowledgeRelationType, string> = {
  prerequisite_of: '先了解', part_of: '属于同一体系', causes: '可能导致', influences: '相互影响',
  contrasts_with: '对照理解', located_in: '空间相关', occurred_during: '同一时期', succeeded_by: '前后相接',
  explains: '帮助解释', related_to: '相关常识',
};

export default function KnowledgeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [node, setNode] = useState<KnowledgeNodeDetail | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setNode(null);
    void api.knowledgeNode(slug).then(setNode).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : '常识加载失败。');
    });
  }, [slug]);

  if (message) return <main className="page-shell"><p className="form-message">{message}</p><Link href="/">返回首页</Link></main>;
  if (!node) return <main className="page-shell"><p>正在读取…</p></main>;

  return <main className="knowledge-detail-shell">
    <nav><Link href="/">← 返回随便看看</Link><Link href="/contribute">贡献精华</Link></nav>
    <article className="knowledge-detail">
      <div className="knowledge-meta"><span>{node.domainName} · {node.topicName}</span><span>约 {node.readingTimeMinutes} 分钟</span></div>
      <h1>{node.title}</h1>
      <div className="knowledge-body">
        {node.sections.map((section, index) => <section className="knowledge-section" key={`${section.heading ?? '核心内容'}-${index}`}>
          {section.heading && <h2>{section.heading}</h2>}
          {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>)}
      </div>
    </article>
    <section className="related-panel">
      <p className="eyebrow">FOLLOW THE THREAD · 顺着看</p>
      <h2>相关常识</h2>
      <div className="knowledge-thread">
        <div className="thread-origin"><span>正在看</span><strong>{node.title}</strong></div>
        <div className="related-grid">
          {node.related.map((item, index) => <Link className="related-card" href={`/knowledge/${item.slug}`} key={item.id}>
            <span>{index === 0 ? '下一条建议' : relationLabels[item.relationType]} · {item.domainName}</span>
            <strong>{item.title}</strong>
            <p>{item.summary}</p>
          </Link>)}
          {node.related.length === 0 && <p className="empty">这条常识的关联还在整理。</p>}
        </div>
      </div>
    </section>
  </main>;
}
