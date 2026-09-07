'use client';

import { createApiClient } from '@knowledge-map/api-client';
import {
  type AiProviderKind,
  type AiRuntimeConfigView,
  type CreateSourceFeedInput,
  type ManagedSourceType,
  type SourceCrawlMode,
  type SourceOperationsView,
  type TaxonomyAdminView,
} from '@knowledge-map/contracts';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

const api = createApiClient({
  baseUrl: '/api',
});

export default function OperationsPage() {
  const [taxonomy, setTaxonomy] = useState<TaxonomyAdminView>({ domains: [], topics: [] });
  const [ai, setAi] = useState<AiRuntimeConfigView | null>(null);
  const [sources, setSources] = useState<SourceOperationsView>({ automationEnabled: false, feeds: [], evidence: [] });
  const [sourceCrawlMode, setSourceCrawlMode] = useState<SourceCrawlMode>('single_page');
  const [sourceMaxPages, setSourceMaxPages] = useState(1);
  const [message, setMessage] = useState('');

  async function load() {
    try {
      const [nextTaxonomy, nextAi, nextSources] = await Promise.all([api.taxonomy(), api.aiRuntime(), api.sourceOperations()]);
      setTaxonomy(nextTaxonomy);
      setAi(nextAi);
      setSources(nextSources);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '运营设置加载失败。');
    }
  }

  useEffect(() => { void load(); }, []);

  async function createDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setTaxonomy(await api.createDomain({
        name: String(data.get('name')), slug: String(data.get('slug')),
        description: String(data.get('description')), sortOrder: Number(data.get('sortOrder')),
      }));
      form.reset();
      setMessage('领域已新增并写入审计。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '领域新增失败。'); }
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setTaxonomy(await api.createTopic({
        domainId: String(data.get('domainId')), name: String(data.get('name')), slug: String(data.get('slug')),
        description: String(data.get('description')), sortOrder: Number(data.get('sortOrder')),
        v1TargetCount: Number(data.get('v1TargetCount')),
      }));
      form.reset();
      setMessage('细分话题已新增并写入审计。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '话题新增失败。'); }
  }

  async function toggleDomain(id: string) {
    const item = taxonomy.domains.find((domain) => domain.id === id);
    if (!item) return;
    try {
      setTaxonomy(await api.updateDomain(id, { ...item, isActive: !item.isActive }));
      setMessage(item.isActive ? '领域已停用，历史内容仍保留。' : '领域已启用。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '领域更新失败。'); }
  }

  async function toggleTopic(id: string) {
    const item = taxonomy.topics.find((topic) => topic.id === id);
    if (!item) return;
    try {
      setTaxonomy(await api.updateTopic(id, { ...item, isActive: !item.isActive }));
      setMessage(item.isActive ? '话题已停用，历史内容仍保留。' : '话题已启用。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '话题更新失败。'); }
  }

  async function saveAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      setAi(await api.updateAiRuntime({
        provider: String(data.get('provider')) as AiProviderKind,
        model: String(data.get('model')),
        baseUrl: String(data.get('baseUrl')) || null,
        maxInputChars: Number(data.get('maxInputChars')),
        maxOutputTokens: Number(data.get('maxOutputTokens')),
      }));
      setMessage('AI 模式已保存，新任务将使用这套配置。');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'AI 配置保存失败。'); }
  }

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      setSources(await api.createSourceFeed({
        topicId: String(data.get('topicId')), name: String(data.get('name')),
        publisher: String(data.get('publisher')), url: String(data.get('url')),
        sourceType: String(data.get('sourceType')) as 'official' | 'research' | 'open_education',
        crawlMode: String(data.get('crawlMode')) as SourceCrawlMode,
        maxPagesPerScan: Number(data.get('maxPagesPerScan')),
        autoScan: data.get('autoScan') === 'on',
        license: String(data.get('license')), checkIntervalHours: Number(data.get('checkIntervalHours')),
      }));
      form.reset();
      setSourceCrawlMode('single_page');
      setSourceMaxPages(1);
      setMessage('白名单来源已添加，可以立即抓取。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '来源新增失败。'); }
  }

  async function createSourcesBulk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const lines = String(new FormData(form).get('manifest') ?? '').split(/\r?\n/)
      .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    try {
      const feeds: CreateSourceFeedInput[] = lines.map((line, index) => {
        const [
          topicSlug, name, publisher, url, sourceType = 'official', license = 'link_and_fact_reference_only',
          hours = '168', crawlMode = 'single_page', maxPages = '1', autoScan = 'false',
        ] = line.split('|').map((item) => item.trim());
        const topic = taxonomy.topics.find((item) => item.slug === topicSlug && item.isActive);
        if (!topic || !name || !publisher || !url || !['official', 'research', 'open_education'].includes(sourceType)
          || !['single_page', 'website'].includes(crawlMode) || !['true', 'false'].includes(autoScan)) {
          throw new Error(`第 ${index + 1} 行格式不正确，或话题 slug 不存在。`);
        }
        return {
          topicId: topic.id, name, publisher, url, sourceType: sourceType as ManagedSourceType,
          crawlMode: crawlMode as SourceCrawlMode, maxPagesPerScan: Number(maxPages), autoScan: autoScan === 'true',
          license, checkIntervalHours: Number(hours),
        };
      });
      const result = await api.createSourceFeedsBulk({ feeds });
      setSources(result);
      form.reset();
      setMessage(`批量导入完成：新增 ${result.importedCount} 个，跳过重复 ${result.skippedCount} 个。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : '批量来源导入失败。'); }
  }

  async function toggleSource(id: string) {
    const item = sources.feeds.find((feed) => feed.id === id);
    if (!item) return;
    try {
      setSources(await api.updateSourceFeed(id, { ...item, isActive: !item.isActive }));
      setMessage(item.isActive ? '来源监测已停用。' : '来源监测已启用。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '来源更新失败。'); }
  }

  async function scanSource(id: string) {
    try {
      setSources(await api.scanSourceFeed(id));
      setMessage('已交给 Python 抓取器立即处理；稍后刷新可查看证据或错误。');
    } catch (error) { setMessage(error instanceof Error ? error.message : '来源调度失败。'); }
  }

  return (
    <main className="page-shell wide">
      <nav><Link href="/admin/review">返回审核台</Link><Link href="/">查看首页</Link></nav>
      <header className="page-header compact-header">
        <p className="eyebrow">OPERATIONS · 运营设置</p>
        <h1>分类与 AI</h1>
        <p>话题从数据库动态读取。停用不会删除历史内容；AI 密钥只从容器挂载的配置文件读取。</p>
      </header>
      {message && <p className="form-message" role="status">{message}</p>}

      <section className="operations-grid">
        <details className="editorial-create" open>
          <summary>新增一级领域</summary>
          <form className="editor-card compact-form" onSubmit={createDomain}>
            <label>名称<input name="name" required minLength={2} maxLength={40} /></label>
            <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
            <label>说明<input name="description" maxLength={200} /></label>
            <label>排序<input name="sortOrder" type="number" min={0} defaultValue={130} required /></label>
            <button className="button primary" type="submit">新增领域</button>
          </form>
        </details>

        <details className="editorial-create" open>
          <summary>新增细分话题</summary>
          <form className="editor-card compact-form" onSubmit={createTopic}>
            <label>所属领域<select name="domainId" required defaultValue="">
              <option value="" disabled>选择领域</option>
              {taxonomy.domains.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label>名称<input name="name" required minLength={2} maxLength={60} /></label>
            <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
            <label>说明<input name="description" maxLength={300} /></label>
            <label>V1 目标<input name="v1TargetCount" type="number" min={0} defaultValue={3} required /></label>
            <label>排序<input name="sortOrder" type="number" min={0} defaultValue={0} required /></label>
            <button className="button primary" type="submit">新增话题</button>
          </form>
        </details>
      </section>

      <section className="coverage-panel">
        <div className="coverage-heading"><div><p className="eyebrow">TAXONOMY · 分类</p><h2>{taxonomy.domains.length} 个领域 · {taxonomy.topics.length} 个话题</h2></div></div>
        <div className="taxonomy-list">
          {taxonomy.domains.map((domain) => (
            <article className="taxonomy-domain" key={domain.id}>
              <div><strong>{domain.name}</strong><span>{domain.topicCount} 个话题 · {domain.isActive ? '启用' : '停用'}</span></div>
              <button className="button" type="button" onClick={() => void toggleDomain(domain.id)}>{domain.isActive ? '停用' : '启用'}</button>
              <div className="taxonomy-topics">
                {taxonomy.topics.filter((topic) => topic.domainId === domain.id).map((topic) => (
                  <div key={topic.id}>
                    <span><strong>{topic.name}</strong> · {topic.publishedCount} 已发布 / {topic.pendingCount} 处理中 / 目标 {topic.v1TargetCount}</span>
                    <button type="button" onClick={() => void toggleTopic(topic.id)}>{topic.isActive ? '停用' : '启用'}</button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {ai && <section className="coverage-panel">
        <p className="eyebrow">AI RUNTIME · 模型插口</p>
        <h2>选择处理模式</h2>
        <p>{ai.modeDescription}</p>
        <form className="editor-card compact-form" onSubmit={saveAi} key={`${ai.provider}-${ai.model}-${ai.baseUrl}`}>
          <label>模式<select name="provider" defaultValue={ai.provider} required>
            <option value="rules">规则模式（免费、无需模型）</option>
            <option value="ollama">本地 Ollama（不按 Token 付费）</option>
            <option value="openai_compatible">OpenAI 兼容接口</option>
          </select></label>
          <label>模型名称<input name="model" defaultValue={ai.model} required /></label>
          <label>服务地址<input name="baseUrl" type="url" defaultValue={ai.baseUrl ?? ''} placeholder="Ollama: http://localhost:11434；远程接口必须 HTTPS" /></label>
          <label>单次输入字符上限<input name="maxInputChars" type="number" min={1000} max={100000} defaultValue={ai.maxInputChars} required /></label>
          <label>单次输出 Token 上限<input name="maxOutputTokens" type="number" min={100} max={8000} defaultValue={ai.maxOutputTokens} required /></label>
          <button className="button primary" type="submit">保存 AI 模式</button>
        </form>
        <p>远程模式密钥状态：{ai.credentialConfigured ? '已满足当前模式' : '配置文件尚未填写 ai.apiKey'}。密钥只写入服务器配置文件，不经过浏览器。</p>
      </section>}

      <section className="coverage-panel">
        <p className="eyebrow">SOURCES · 白名单来源</p>
        <h2>定时抓取与证据包</h2>
        <p>{sources.automationEnabled ? '指定为自动维护的站点会按周期扫描。' : '全局自动扫描当前关闭；手动“立即抓取”仍然可用。'}只有页面内容指纹变化才会产生新证据并调用 AI。</p>
        <details className="editorial-create">
          <summary>新增白名单来源</summary>
          <form className="editor-card compact-form" onSubmit={createSource}>
            <label>归属话题<select name="topicId" required defaultValue="">
              <option value="" disabled>选择细分话题</option>
              {taxonomy.topics.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.domainName} · {item.name}</option>)}
            </select></label>
            <label>来源名称<input name="name" required minLength={2} maxLength={120} /></label>
            <label>发布机构<input name="publisher" required minLength={2} maxLength={120} /></label>
            <label>HTTPS 页面或站点入口<input name="url" type="url" required placeholder="https://..." /></label>
            <label>来源类型<select name="sourceType" defaultValue="official"><option value="official">官方机构</option><option value="research">科研资料</option><option value="open_education">开放教育</option></select></label>
            <label>抓取范围<select name="crawlMode" value={sourceCrawlMode} onChange={(event) => {
              const mode = event.target.value as SourceCrawlMode;
              setSourceCrawlMode(mode);
              setSourceMaxPages(mode === 'single_page' ? 1 : 8);
            }}><option value="single_page">只抓这个页面</option><option value="website">从这个入口发现同站页面</option></select></label>
            <label>每次最多页面数<input name="maxPagesPerScan" type="number" min={1} max={20} required
              value={sourceMaxPages} readOnly={sourceCrawlMode === 'single_page'}
              onChange={(event) => setSourceMaxPages(Number(event.target.value))} /></label>
            <label className="checkbox"><input name="autoScan" type="checkbox" />按检查间隔自动维护</label>
            <label>使用范围<input name="license" required defaultValue="link_and_fact_reference_only" /></label>
            <label>检查间隔（小时）<input name="checkIntervalHours" type="number" min={1} max={8760} required defaultValue={168} /></label>
            <button className="button primary" type="submit">添加来源</button>
          </form>
        </details>
        <details className="editorial-create">
          <summary>批量导入来源（最多 200 个）</summary>
          <p>每行：话题slug | 来源名 | 发布机构 | HTTPS入口 | 来源类型 | 许可 | 间隔小时 | single_page/website | 最多页面 | true/false自动维护</p>
          <form className="editor-card compact-form" onSubmit={createSourcesBulk}>
            <label>来源清单<textarea name="manifest" required rows={8} placeholder="earth-and-maps | 世界海洋资料 | 某官方机构 | https://... | official | link_and_fact_reference_only | 168 | website | 10 | true" /></label>
            <button className="button primary" type="submit">批量导入白名单</button>
          </form>
        </details>
        <div className="taxonomy-list">
          {sources.feeds.map((feed) => <article className="taxonomy-domain" key={feed.id}>
            <div><strong>{feed.name}</strong><span>{feed.domainName} · {feed.topicName} · {feed.crawlMode === 'website' ? `站点最多 ${feed.maxPagesPerScan} 页` : '单页'} · {feed.autoScan ? '自动维护' : '仅手动'}</span></div>
            <div className="source-actions"><button className="button" type="button" onClick={() => void scanSource(feed.id)}>立即抓取</button><button className="button" type="button" onClick={() => void toggleSource(feed.id)}>{feed.isActive ? '停用' : '启用'}</button></div>
            <p className="source-status">{feed.publisher} · 下次 {new Date(feed.nextCheckAt).toLocaleString('zh-CN')}{feed.lastError ? ` · 错误：${feed.lastError}` : ''}</p>
          </article>)}
          {sources.feeds.length === 0 && <p className="empty">还没有白名单来源。</p>}
        </div>
        {sources.evidence.length > 0 && <details className="evidence-list"><summary>查看最近证据包（{sources.evidence.length}）</summary>
          {sources.evidence.map((item) => <article key={item.id}><strong>{item.pageTitle}</strong><span>{item.domainName} · {item.topicName} · {item.status} · {item.discoveredUrls.length} 个页面</span><p>{item.evidenceText}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer">核对来源入口 ↗</a></article>)}
        </details>}
      </section>
    </main>
  );
}
