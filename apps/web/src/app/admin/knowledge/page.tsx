'use client';

import { createApiClient } from '@knowledge-map/api-client';
import {
  type KnowledgeNodeSummary,
  type KnowledgeRevisionSummary,
} from '@knowledge-map/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const api = createApiClient({
  baseUrl: '/api',
});

export default function KnowledgeVersionsPage() {
  const [nodes, setNodes] = useState<KnowledgeNodeSummary[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [revisions, setRevisions] = useState<KnowledgeRevisionSummary[]>([]);
  const [reason, setReason] = useState('回滚到上一版已核验内容。');
  const [message, setMessage] = useState('');
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    api.knowledgeNodes()
      .then((items) => {
        setNodes(items);
        setSelectedId((current) => current || items[0]?.id || '');
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '正式常识加载失败。'));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    api.knowledgeRevisions(selectedId)
      .then(setRevisions)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '版本记录加载失败。'));
  }, [selectedId]);

  async function rollback(targetRevisionId: string) {
    if (reason.trim().length < 4) return;
    setRollingBack(true);
    setMessage('');
    try {
      const result = await api.rollbackKnowledge(selectedId, { targetRevisionId, reason });
      setMessage(`已生成版本 ${result.revision.version}，回滚记录和来源已写入审计。`);
      setRevisions(await api.knowledgeRevisions(selectedId));
      setNodes(await api.knowledgeNodes());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '版本回滚失败。');
    } finally {
      setRollingBack(false);
    }
  }

  return (
    <main className="page-shell">
      <nav><Link href="/admin/review">返回审核台</Link><Link href="/">查看首页</Link></nav>
      <header className="page-header compact-header">
        <p className="eyebrow">VERSION CONTROL · 版本管理</p>
        <h1>正式常识版本</h1>
        <p>回滚会复制目标内容生成一个新的已发布版本，历史记录不会被覆盖。</p>
      </header>

      {message && <p className="form-message" role="status">{message}</p>}
      <section className="version-controls">
        <label>正式常识<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {nodes.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.topicName}</option>)}
        </select></label>
        <label>回滚理由<input value={reason} minLength={4} maxLength={500} onChange={(event) => setReason(event.target.value)} /></label>
      </section>

      <section className="version-list" aria-live="polite">
        {revisions.map((revision) => (
          <article className="version-row" key={revision.id}>
            <div>
              <p className="version-number">版本 {revision.version}{revision.isCurrent ? ' · 当前' : ''}</p>
              <h2>{revision.changeSummary}</h2>
              <p>{revision.aiInvolvement === 'none' ? '人工编辑' : 'AI 辅助'} · {revision.publishedAt ? new Date(revision.publishedAt).toLocaleString('zh-CN') : '未发布时间'}</p>
            </div>
            <button
              className="button"
              disabled={revision.isCurrent || rollingBack || reason.trim().length < 4}
              onClick={() => void rollback(revision.id)}
              type="button"
            >
              {revision.isCurrent ? '当前版本' : '回滚到此版本'}
            </button>
          </article>
        ))}
        {selectedId && revisions.length === 0 && <p className="empty">正在读取版本记录...</p>}
      </section>
    </main>
  );
}
