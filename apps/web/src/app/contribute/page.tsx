'use client';

import { createApiClient } from '@knowledge-map/api-client';
import { type CreateSubmissionInput, type TopicSummary } from '@knowledge-map/contracts';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

const api = createApiClient({
  baseUrl: '/api',
});

export default function ContributePage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [experienceBased, setExperienceBased] = useState(false);

  useEffect(() => {
    void api.topics().then(setTopics).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : '话题加载失败。');
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const input: CreateSubmissionInput = {
      topicId: String(data.get('topicId') ?? ''),
      statement: String(data.get('statement') ?? ''),
      whyUseful: String(data.get('whyUseful') ?? ''),
      applicability: String(data.get('applicability') ?? ''),
      sourceUrl: String(data.get('sourceUrl') ?? ''),
      experienceBased,
      aiDisclosure: data.get('aiDisclosure') === 'on',
    };
    try {
      const result = await api.createSubmission(input);
      form.reset();
      setExperienceBased(false);
      setMessage(`已提交，编号 ${result.submission.id}。AI 预处理任务已登记。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交失败。');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <nav><Link href="/">← 返回首页</Link><Link href="/submissions">候选内容</Link></nav>
      <header className="page-header">
        <p className="eyebrow">CONTRIBUTE · 候选精华</p>
        <h1>直接写结论</h1>
        <p>这里不是提问区。请给出简短结论、用途、适用边界和来源；投稿会经过 AI 预处理与人工审核。</p>
      </header>
      <form className="editor-card" onSubmit={submit}>
        <label>话题<select name="topicId" required defaultValue="">
          <option value="" disabled>选择话题</option>
          {topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.domainName} · {topic.name}</option>)}
        </select></label>
        <label>一句话结论<textarea name="statement" required minLength={8} maxLength={160} rows={3} placeholder="例：GDP 增长不意味着每个人的收入以相同比例增长。" /></label>
        <label>为什么有用<textarea name="whyUseful" required minLength={8} maxLength={500} rows={3} /></label>
        <label>适用条件或例外<textarea name="applicability" required minLength={2} maxLength={500} rows={3} /></label>
        <label>来源网址<input name="sourceUrl" type="url" required={!experienceBased} placeholder="https://..." /></label>
        <label className="check"><input type="checkbox" checked={experienceBased} onChange={(event) => setExperienceBased(event.target.checked)} />这是个人经验，不作为可直接发布的正式事实</label>
        <label className="check"><input name="aiDisclosure" type="checkbox" />原始内容使用过 AI 生成或改写</label>
        <button className="button primary" type="submit" disabled={submitting || topics.length === 0}>{submitting ? '提交中…' : '提交候选精华'}</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </main>
  );
}
