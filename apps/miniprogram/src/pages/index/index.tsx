import { Button, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { KnowledgeCreatorKind, KnowledgeNodeSummary, TopicSummary } from '@knowledge-map/contracts';
import { useMemo, useState } from 'react';
import { messageOf, miniApi } from '../../api';
import { APP_VERSION } from '../../version';
import './index.css';

const PAGE_SIZE = 8;
const READ_STORAGE_KEY = 'curio-read-knowledge';
const FAVORITES_STORAGE_KEY = 'curio-favorites';
type CreatorFilter = 'all' | KnowledgeCreatorKind;
const creatorLabels: Record<CreatorFilter, string> = { all: '全部来源', system: '系统', owner: '站长', contributor: '投稿' };

function rotate(items: KnowledgeNodeSummary[], batch: number): KnowledgeNodeSummary[] {
  if (items.length <= PAGE_SIZE) return items;
  return Array.from({ length: Math.min(PAGE_SIZE, items.length) }, (_, index) => items[(batch * PAGE_SIZE + index) % items.length]!);
}

export default function IndexPage() {
  const [nodes, setNodes] = useState<KnowledgeNodeSummary[]>([]);
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [domain, setDomain] = useState('全部');
  const [creator, setCreator] = useState<CreatorFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [batch, setBatch] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [availableNodes, availableTopics] = await Promise.all([miniApi.knowledgeNodes(), miniApi.topics()]);
      setNodes(availableNodes); setTopics(availableTopics); setMessage('');
    } catch (error) { setMessage(messageOf(error, '常识加载失败，请稍后重试。')); }
    finally { setLoading(false); }
  }
  useDidShow(() => {
    void load();
    setFavorites(Taro.getStorageSync<string[]>(FAVORITES_STORAGE_KEY) ?? []);
    setReadIds(Taro.getStorageSync<string[]>(READ_STORAGE_KEY) ?? []);
  });

  const domains = useMemo(() => ['全部', ...Array.from(new Set(topics.map((topic) => topic.domainName)))], [topics]);
  const matching = nodes.filter((node) => (domain === '全部' || node.domainName === domain) && (creator === 'all' || node.creatorKind === creator) && (!favoritesOnly || favorites.includes(node.id)));
  const unread = matching.filter((node) => !readIds.includes(node.id));
  const browsePool = unread.length > 0 ? [...unread, ...matching.filter((node) => readIds.includes(node.id))] : matching;
  const visible = rotate(browsePool, batch);
  const featured = visible[0];
  const readCount = nodes.filter((node) => readIds.includes(node.id)).length;

  function toggleFavorite(id: string, event: { stopPropagation?: () => void }) {
    event.stopPropagation?.();
    const next = favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id];
    setFavorites(next); Taro.setStorageSync(FAVORITES_STORAGE_KEY, next);
  }
  function openKnowledge(node: KnowledgeNodeSummary) {
    const next = readIds.includes(node.id) ? readIds : [...readIds, node.id];
    setReadIds(next);
    Taro.setStorageSync(READ_STORAGE_KEY, next);
    void Taro.navigateTo({ url: `/pages/knowledge/index?slug=${encodeURIComponent(node.slug)}` });
  }

  return <View className="page">
    <View className="topbar"><View><Text className="brand">常识地图</Text><Text className="app-version">v{APP_VERSION}</Text></View><View className="top-actions"><Button className="link-button" onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}>登录</Button><Button className="link-button" onClick={() => void Taro.navigateTo({ url: '/pages/contribute/index' })}>贡献</Button></View></View>
    <View className="mini-hero"><Text className="eyebrow">今天 · 已审核常识</Text><Text className="page-title">随手认识一点</Text><Text className="intro">不必先搜索，给自己几分钟，沿着兴趣看下去。</Text></View>
    <ScrollView className="tabs" scrollX>{domains.map((item) => <Button className={domain === item ? 'tab active' : 'tab'} key={item} onClick={() => { setDomain(item); setBatch(0); }}>{item}</Button>)}</ScrollView>
    <ScrollView className="tabs creator-tabs" scrollX>{(Object.keys(creatorLabels) as CreatorFilter[]).map((item) => <Button className={creator === item ? 'tab active' : 'tab'} key={item} onClick={() => { setCreator(item); setBatch(0); }}>{creatorLabels[item]}</Button>)}</ScrollView>
    <View className="toolbar"><View><Text className="subtle">{favoritesOnly ? '我的收藏' : '这一批'} · {matching.length} 条</Text><Text className="read-count">已读 {readCount} 条</Text></View><View className="toolbar-actions"><Button className={favoritesOnly ? 'secondary-button selected' : 'secondary-button'} onClick={() => { setFavoritesOnly((current) => !current); setBatch(0); }}>{favoritesOnly ? '看全部' : '收藏'}</Button><Button className="secondary-button" disabled={matching.length === 0} onClick={() => setBatch((current) => current + 1)}>换一批</Button></View></View>
    {message && <Text className="message">{message}</Text>}
    {loading && <Text className="empty">正在读取常识...</Text>}
    {!loading && visible.length === 0 && <Text className="empty">当前筛选下暂无常识。</Text>}
    <View className="knowledge-list">
      {featured && <View className="featured-card" onClick={() => openKnowledge(featured)}>
        <View className="featured-kicker"><Text>今日精选</Text><Text>{featured.domainName}</Text></View>
        <Text className="featured-title">{featured.title}</Text>
        <Text className="featured-summary">{featured.summary}</Text>
        <Text className="featured-detail">{featured.sections[0]?.paragraphs[0] ?? featured.summary}</Text>
        <View className="featured-footer"><Text>约 {featured.readingTimeMinutes} 分钟 · {featured.creatorLabel}</Text><Button className="favorite" onClick={(event) => toggleFavorite(featured.id, event)}>{favorites.includes(featured.id) ? '★' : '☆'}</Button></View>
      </View>}
      {visible.length > 1 && <Text className="section-label">再看几条</Text>}
      <View className="compact-list">{visible.slice(1).map((node) => <View className="compact-card" key={node.id} onClick={() => openKnowledge(node)}>
        <View className="card-meta"><Text>{node.domainName} · {node.topicName}</Text><Text>约 {node.readingTimeMinutes} 分钟</Text></View>
        <View className="compact-title-row"><Text className="compact-title">{node.title}</Text><Button className="favorite compact-favorite" onClick={(event) => toggleFavorite(node.id, event)}>{favorites.includes(node.id) ? '★' : '☆'}</Button></View>
        <Text className="compact-summary">{node.summary}</Text>
        <Text className="compact-more">点开继续看 →</Text>
      </View>)}</View>
    </View>
  </View>;
}
