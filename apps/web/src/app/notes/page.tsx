'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Note = { id: string; content: string; sourceUrl: string; createdAt: string };
type Token = { id: string; name: string; expiresAt: string };
async function request<T>(path: string, method = 'GET', body?: object, key?: string): Promise<T> {
  const response = await fetch(`/api/notes${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message ?? '操作失败，请重试。');
  return value as T;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tokenName, setTokenName] = useState('手机快捷指令');
  const [secret, setSecret] = useState('');
  const key = useRef('');
  async function load(start = 0) {
    setLoading(true);
    try {
      const rows = await request<Note[]>(`?offset=${start}`);
      setNotes(rows); setOffset(start); setMore(rows.length === 50);
    } catch (error) { setNotes([]); setMore(false); throw error; }
    finally { setLoading(false); }
  }
  useEffect(() => { void load().catch(error => setMessage(String(error.message))); }, []);
  async function act(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : '操作失败，输入仍保留。'); }
    finally { setBusy(false); }
  }
  return <main className="page-shell">
    <nav><Link href="/">← 随便看看</Link><Link href="/contribute">写好的常识直接投稿</Link><Link href="/login">登录 / 注册</Link></nav>
    <header className="page-header"><p className="eyebrow">只给自己看 · 灵感收件箱</p><h1>先记下来，再慢慢想</h1><p>一句发现、一个疑问、一段值得核实的话，都可以先放这里。不会公开，也不会自动交给 AI。</p></header>
    <form className="editor-card" onSubmit={event => { event.preventDefault(); void act(async () => {
      if (!key.current) key.current = crypto.randomUUID();
      await request(editing ? `/${editing}` : '', editing ? 'PUT' : 'POST', { content, sourceUrl }, key.current);
      setContent(''); setSourceUrl(''); setEditing(null); key.current = ''; setMessage('已保存，仅你可见。'); await load();
    }); }}>
      <label>想记录什么？<textarea required maxLength={5000} rows={5} value={content} onChange={event => { setContent(event.target.value); key.current = ''; }} placeholder="今天发现…… / 为什么…… / 下次想查证……" /></label>
      <small>{content.length} / 5000 · 不必先选分类</small>
      <label>来源链接（可选）<input type="url" value={sourceUrl} onChange={event => { setSourceUrl(event.target.value); key.current = ''; }} /></label>
      <button className="button primary" disabled={busy}>{busy ? '处理中…' : editing ? '保存修改' : '记下来'}</button>
      {editing && <button type="button" disabled={busy} onClick={() => { setEditing(null); setContent(''); setSourceUrl(''); }}>取消编辑</button>}
    </form>
    {message && <p role="status" className="form-message">{message}</p>}
    <h2>我的记录</h2><p>回头看一条，把“我知道了”变成“别人也用得上”。整理投稿会复制内容，原记录仍然保留。</p>
    {loading ? <p role="status">正在读取你的记录…</p> : !notes.length && <p>这里还没有可显示的记录。登录后，从今天的一个小发现开始。</p>}
    {notes.map(note => <article className="editor-card" key={note.id}>
      <small>{new Date(note.createdAt).toLocaleString('zh-CN')} · 私密</small>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.content}</p>
      {note.sourceUrl && <a href={note.sourceUrl} target="_blank" rel="noopener noreferrer">查看来源</a>}
      <div className="actions"><Link href={`/contribute?note=${note.id}`}>整理为常识 →</Link>
        <button disabled={busy} onClick={() => { setEditing(note.id); setContent(note.content); setSourceUrl(note.sourceUrl); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>编辑</button>
        <button disabled={busy} onClick={() => { if (window.confirm('永久删除这条私密记录？')) void act(async () => { await request(`/${note.id}`, 'DELETE'); await load(offset); }); }}>删除</button></div>
    </article>)}
    <button disabled={busy || offset === 0} onClick={() => void act(() => load(Math.max(0, offset - 50)))}>上一页</button>
    <button disabled={busy || !more} onClick={() => void act(() => load(offset + 50))}>下一页</button>
    <details className="editor-card" onToggle={event => { if (event.currentTarget.open) void request<Token[]>('/tokens').then(setTokens).catch(error => setMessage(error.message)); }}>
      <summary>进阶：用快捷指令或脚本随手记</summary>
      <p>令牌只能管理你的私密记录，不能投稿或发布。90 天有效，密钥仅展示一次，请勿分享。</p>
      <label>用途名称<input value={tokenName} maxLength={60} onChange={event => setTokenName(event.target.value)} /></label>
      <button disabled={busy} onClick={() => void act(async () => { const result = await request<{ token: string }>('/tokens', 'POST', { name: tokenName }); setSecret(result.token); setTokens(await request('/tokens')); })}>创建令牌</button>
      {secret && <div><p>立即复制保存，关闭页面后无法再次查看：</p><code style={{ overflowWrap: 'anywhere' }}>{secret}</code><button onClick={() => setSecret('')}>隐藏</button></div>}
      {tokens.map(token => <p key={token.id}>{token.name} · 到期 {new Date(token.expiresAt).toLocaleDateString()} <button disabled={busy} onClick={() => { if (window.confirm('撤销后使用此令牌的快捷指令会失效，继续？')) void act(async () => { await request(`/tokens/${token.id}`, 'DELETE'); setTokens(await request('/tokens')); setSecret(''); }); }}>撤销</button></p>)}
      <pre style={{ whiteSpace: 'pre-wrap' }}>{'POST /api/notes\nAuthorization: Bearer <你的令牌>\nIdempotency-Key: <每条记录的唯一标识，重试时保持相同>\nContent-Type: application/json\n\n{"content":"今天的发现……","sourceUrl":""}'}</pre>
    </details>
  </main>;
}
