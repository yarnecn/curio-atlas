'use client';

import { createApiClient } from '@knowledge-map/api-client';
import {
  type CreateInternalCandidateInput,
  type InternalCandidateOriginType,
  type KnowledgeNodeSummary,
  type ReviewDecision,
  type SubmissionView,
  type TopicSummary,
} from '@knowledge-map/contracts';
import Link from 'next/link';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

const api = createApiClient({
  baseUrl: '/api',
});

interface DraftDecision {
  title: string;
  slug: string;
  reason: string;
  targetKnowledgeNodeId: string;
}

const emptyDraft: DraftDecision = {
  title: '',
  slug: '',
  reason: '来源与表述已核验。',
  targetKnowledgeNodeId: '',
};

const originLabels: Record<SubmissionView['originType'], string> = {
  user_submission: '用户投稿',
  source_discovery: '来源发现',
  coverage_gap: '覆盖缺口',
  maintenance: '维护更新',
  admin_seed: '站长种子',
};

export default function ReviewPage() {
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeNodeSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftDecision>>({});
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [topicFilter, setTopicFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState('v1');

  async function load() {
    try {
      const [queue, nodes, availableTopics] = await Promise.all([
        api.reviewQueue(),
        api.knowledgeNodes(),
        api.topics(),
      ]);
      setItems(queue);
      setKnowledge(nodes);
      setTopics(availableTopics);
      setDrafts(Object.fromEntries(queue.map((item) => [item.id, {
        ...emptyDraft,
        title: item.proposedTitle ?? item.displayStatement.replace(/[。！？]$/, '').slice(0, 40),
        slug: item.proposedSlug ?? `candidate-${item.id.slice(0, 8)}`,
      }])));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审核队列加载失败。');
    }
  }

  async function createInternalCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: CreateInternalCandidateInput = {
      topicId: String(data.get('topicId') ?? ''),
      proposedTitle: String(data.get('proposedTitle') ?? ''),
      proposedSlug: String(data.get('proposedSlug') ?? ''),
      originType: String(data.get('originType') ?? '') as InternalCandidateOriginType,
      triggerReason: String(data.get('triggerReason') ?? ''),
      statement: String(data.get('statement') ?? ''),
      whyUseful: String(data.get('whyUseful') ?? ''),
      applicability: String(data.get('applicability') ?? ''),
      sourceUrl: String(data.get('sourceUrl') ?? ''),
      aiDisclosure: data.get('aiDisclosure') === 'on',
    };
    try {
      const result = await api.createInternalCandidate(input);
      form.reset();
      setMessage(`内部候选 ${result.submission.id} 已登记，AI 检查通过后会自动进入本审核队列。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '内部候选创建失败。');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function update(id: string, field: keyof DraftDecision, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDraft), [field]: value } }));
  }

  const scopedItems = scopeFilter === 'v1'
    ? items.filter((item) => item.triggerReason?.startsWith('V1 内容目录'))
    : items;
  const visibleItems = topicFilter === 'all'
    ? scopedItems
    : scopedItems.filter((item) => item.topic.id === topicFilter);
  const domainCoverage = useMemo(() => {
    const grouped = new Map<string, {
      domainSlug: string;
      domainName: string;
      target: number;
      published: number;
      pending: number;
      topics: TopicSummary[];
    }>();
    for (const topic of topics) {
      const current = grouped.get(topic.domainSlug) ?? {
        domainSlug: topic.domainSlug,
        domainName: topic.domainName,
        target: 0,
        published: knowledge.filter((node) => node.domainSlug === topic.domainSlug).length,
        pending: items.filter((candidate) => candidate.topic.domainSlug === topic.domainSlug).length,
        topics: [],
      };
      current.target += topic.v1TargetCount;
      current.topics.push(topic);
      grouped.set(topic.domainSlug, current);
    }
    return [...grouped.values()];
  }, [items, knowledge, topics]);

  async function decide(id: string, decision: ReviewDecision) {
    const draft = drafts[id] ?? emptyDraft;
    try {
      await api.reviewSubmission(id, {
        decision,
        reason: draft.reason,
        title: decision === 'approve_new' ? draft.title : undefined,
        slug: decision === 'approve_new' ? draft.slug : undefined,
        targetKnowledgeNodeId: decision === 'merge' ? draft.targetKnowledgeNodeId : undefined,
      });
      setMessage('审核决定已保存，并写入审计记录。');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '审核操作失败。');
    }
  }

  return (
    <main className="page-shell wide">
      <nav><Link href="/">返回首页</Link><Link href="/admin/knowledge">版本管理</Link><Link href="/admin/operations">分类与 AI</Link><Link href="/submissions">候选内容</Link></nav>
      <header className="page-header">
        <p className="eyebrow">HUMAN GATE · 人工审核</p>
        <h1>正式常识审核台</h1>
        <p>同时核对原稿、AI 稿、来源、评分和适用边界。达到门槛不代表必须通过。</p>
      </header>
      <section className="coverage-panel" aria-label="V1 内容覆盖度">
        <div className="coverage-heading">
          <div><p className="eyebrow">V1 CONTENT · 内容覆盖</p><h2>165 条稳定常识</h2></div>
          <span>{knowledge.length} 已发布 · {items.length} 待审 / {topics.reduce((sum, item) => sum + item.v1TargetCount, 0)}</span>
        </div>
        <div className="coverage-grid">
          {domainCoverage.map((item) => {
            const percentage = item.target === 0 ? 0 : Math.min(100, Math.round((item.published / item.target) * 100));
            return <div className="coverage-row" key={item.domainSlug}>
              <div><strong>{item.domainName}</strong><span>{item.published} 已发布 · {item.pending} 待审 / {item.target}</span></div>
              <progress aria-label={`${item.domainName}完成度`} max={100} value={percentage} />
            </div>;
          })}
        </div>
        <p>进度条只统计已发布内容；抓取稿和 AI 整理稿即使已经待审，也必须由你确认后才会上首页。</p>
      </section>
      {message && <p className="form-message" role="status">{message}</p>}
      <details className="editorial-create">
        <summary>创建内部编辑候选</summary>
        <p>用于覆盖缺口、来源发现和维护任务，不需要公开凑票；AI 检查通过后直接等待人工审核。</p>
        <form className="editor-card" onSubmit={createInternalCandidate}>
          <label>触发类型<select name="originType" defaultValue="coverage_gap" required>
            <option value="coverage_gap">覆盖缺口</option>
            <option value="source_discovery">来源发现</option>
            <option value="maintenance">维护更新</option>
            <option value="admin_seed">站长种子</option>
          </select></label>
          <label>话题<select name="topicId" required defaultValue="">
            <option value="" disabled>选择话题</option>
            {topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.domainName} · {topic.name}</option>)}
          </select></label>
          <label>建议标题<input name="proposedTitle" required minLength={2} maxLength={80} /></label>
          <label>建议 Slug<input name="proposedSlug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="weather-and-climate" /></label>
          <label>触发原因<textarea name="triggerReason" required minLength={4} maxLength={500} rows={2} placeholder="例：覆盖地图缺少解释天气与气候区别的基础节点。" /></label>
          <label>一句话结论<textarea name="statement" required minLength={8} maxLength={160} rows={3} /></label>
          <label>为什么值得知道<textarea name="whyUseful" required minLength={8} maxLength={500} rows={3} /></label>
          <label>适用边界<textarea name="applicability" required minLength={2} maxLength={500} rows={2} /></label>
          <label>可核验来源<input name="sourceUrl" type="url" required placeholder="https://..." /></label>
          <label className="check"><input name="aiDisclosure" type="checkbox" defaultChecked />候选使用过 AI 生成或实质性改写</label>
          <button className="button primary" type="submit" disabled={creating || topics.length === 0}>{creating ? '登记中…' : '登记并进入 AI 检查'}</button>
        </form>
      </details>
      <section className="review-toolbar" aria-label="审核队列筛选">
        <label>内容批次<select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}>
          <option value="v1">V1 编辑批次 01（{items.filter((item) => item.triggerReason?.startsWith('V1 内容目录')).length}）</option>
          <option value="all">全部待审核（{items.length}）</option>
        </select></label>
        <label>只看某个细分话题（不改变归类）<select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
          <option value="all">全部细分话题（{scopedItems.length}）</option>
          {domainCoverage.map((domain) => <optgroup label={domain.domainName} key={domain.domainSlug}>
            {domain.topics.map((topic) => <option value={topic.id} key={topic.id}>
              {topic.name}（{scopedItems.filter((item) => item.topic.id === topic.id).length}）
            </option>)}
          </optgroup>)}
        </select></label>
      </section>
      <section className="review-list">
        {visibleItems.map((item) => {
          const draft = drafts[item.id] ?? emptyDraft;
          return (
            <article className="review-card" key={item.id}>
              <div className="review-source">
                <p className="card-meta">
                  <span className="topic-assigned">已归类：{item.topic.domainName} · {item.topic.name}</span>
                  <span>{item.originType === 'user_submission' ? `${item.validVoteCount} 票 · ${Math.round(item.usefulnessRate * 100)}% 有用` : '内部候选 · 无需公开评分'}</span>
                </p>
                <p className="candidate-origin">{originLabels[item.originType]} · {item.authorHandle}</p>
                {item.triggerReason && <p className="trigger-reason">触发原因：{item.triggerReason}</p>}
                <h2>{item.proposedTitle ?? item.displayStatement}</h2>
                {item.proposedTitle && <p className="core-statement"><strong>一句话结论：</strong>{item.displayStatement}</p>}
                {item.statement !== item.displayStatement && <details><summary>查看原始投稿</summary><p>{item.statement}</p></details>}
                <p>{item.whyUseful}</p>
                <p className="boundary">适用边界：{item.applicability}</p>
                {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">核对来源 ↗</a>}
              </div>
              <div className="decision-panel">
                <label>正式标题<input value={draft.title} onChange={(event) => update(item.id, 'title', event.target.value)} /></label>
                <label>Slug<input value={draft.slug} onChange={(event) => update(item.id, 'slug', event.target.value)} /></label>
                <label>审核理由<textarea rows={2} value={draft.reason} onChange={(event) => update(item.id, 'reason', event.target.value)} /></label>
                <button className="button primary" type="button" onClick={() => void decide(item.id, 'approve_new')}>创建正式常识</button>
                <div className="merge-row">
                  <select value={draft.targetKnowledgeNodeId} onChange={(event) => update(item.id, 'targetKnowledgeNodeId', event.target.value)}>
                    <option value="">仅在内容重复时选择同话题常识</option>
                    {knowledge.filter((node) => node.topicId === item.topic.id).map((node) => <option value={node.id} key={node.id}>{node.title}</option>)}
                  </select>
                  <button className="button" type="button" disabled={!draft.targetKnowledgeNodeId} onClick={() => void decide(item.id, 'merge')}>合并重复内容</button>
                </div>
                <div className="secondary-actions">
                  <button type="button" onClick={() => void decide(item.id, 'hold')}>暂缓</button>
                  <button type="button" onClick={() => void decide(item.id, 'reject')}>驳回</button>
                </div>
              </div>
            </article>
          );
        })}
        {visibleItems.length === 0 && !message && <p className="empty">当前筛选下没有待审核内容。</p>}
      </section>
    </main>
  );
}
