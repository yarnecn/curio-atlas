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
  const [note, setNote] = useState<{ content: string; sourceUrl: string } | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('note');
    if (id) void fetch(`/api/notes/${encodeURIComponent(id)}`, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('原记录无法读取，请登录后重试。');
      setNote(await response.json());
    }).catch((error: Error) => setMessage(error.message));
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
      proposedTitle: String(data.get('proposedTitle') ?? ''),
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
        <label>标题<input name="proposedTitle" required minLength={2} maxLength={80} placeholder="例如：HTTPS 能保护什么？" /></label>
        <Link href="/notes">还没想好？先私密记下来</Link>
        {note && <aside><h2>原始灵感（仅自己可见）</h2><p style={{ whiteSpace: 'pre-wrap' }}>{note.content}</p><p>请将原文提炼为简短结论，并补充用途与依据；不会自动公开原记录。</p></aside>}
        <label>话题<select name="topicId" required defaultValue="">
          <option value="" disabled>选择话题</option>
          {topics.map((topic) => <option value={topic.id} key={topic.id}>{topic.domainName} · {topic.name}</option>)}
        </select></label>
        <label>一句话结论（12～160 字）<textarea key={note ? 'note' : 'empty'} defaultValue={note && note.content.length <= 160 ? note.content : ''} name="statement" required minLength={12} maxLength={160} rows={3} placeholder="例：GDP 增长不意味着每个人的收入以相同比例增长。" /></label>
        <label>为什么有用（12～300 字）<textarea name="whyUseful" required minLength={12} maxLength={300} rows={3} /></label>
        <label>需要注意（可选）<textarea name="applicability" minLength={8} maxLength={300} rows={3} placeholder="有特殊条件或例外时再写，没有可留空" /></label>
        <label>来源网址<input key={note?.sourceUrl ?? ''} defaultValue={note?.sourceUrl ?? ''} name="sourceUrl" type="url" required={!experienceBased} placeholder="https://..." /></label>
        <label className="check"><input type="checkbox" checked={experienceBased} onChange={(event) => setExperienceBased(event.target.checked)} />这是个人经验，不作为可直接发布的正式事实</label>
        <label className="check"><input name="aiDisclosure" type="checkbox" />原始内容使用过 AI 生成或改写</label>
        <button className="button primary" type="submit" disabled={submitting || topics.length === 0}>{submitting ? '提交中…' : '提交候选精华'}</button>
        {message && <p className="form-message" role="status">{message}</p>}
      </form>
    </main>
  );
}
