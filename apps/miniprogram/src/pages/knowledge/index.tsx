import { Button, Text, View } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import type { KnowledgeNodeDetail } from '@knowledge-map/contracts';
import { useEffect, useState } from 'react';
import { messageOf, miniApi } from '../../api';
import './index.css';

export default function KnowledgePage() {
  const { params } = useRouter();
  const [node, setNode] = useState<KnowledgeNodeDetail | null>(null);
  const [message, setMessage] = useState('');
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const slug = params.slug;
    if (!slug) { setMessage('缺少常识地址。'); return; }
    const saved = Taro.getStorageSync<string[]>('curio-favorites') ?? [];
    miniApi.knowledgeNode(slug).then((value) => { setNode(value); setFavorite(saved.includes(value.id)); }).catch((error) => setMessage(messageOf(error, '常识读取失败。')));
  }, [params.slug]);

  function toggleFavorite() {
    if (!node) return;
    const saved = Taro.getStorageSync<string[]>('curio-favorites') ?? [];
    const next = favorite ? saved.filter((id) => id !== node.id) : [...saved, node.id];
    Taro.setStorageSync('curio-favorites', next); setFavorite(!favorite);
  }
  function openRelated(slug: string) { void Taro.redirectTo({ url: `/pages/knowledge/index?slug=${encodeURIComponent(slug)}` }); }

  if (message) return <View className="page"><Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button><Text className="message">{message}</Text></View>;
  if (!node) return <View className="page"><Text className="empty">正在读取...</Text></View>;
  return <View className="page detail-page">
    <View className="detail-nav"><Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button><Button className="favorite-button" onClick={toggleFavorite}>{favorite ? '★ 已收藏' : '☆ 收藏'}</Button></View>
    <Text className="eyebrow">{node.domainName} · {node.topicName}</Text>
    <Text className="detail-title">{node.title}</Text>
    <Text className="detail-creator">{node.creatorLabel}{node.creatorHandle ? ` · ${node.creatorHandle}` : ''} · 约 {node.readingTimeMinutes} 分钟</Text>
    <View className="detail-summary"><Text className="summary-label">先记住</Text><Text className="summary-text">{node.summary}</Text></View>
    <View className="detail-card">{node.sections.map((section, index) => <View key={`${section.heading ?? 'section'}-${index}`}><Text className="section-heading">{section.heading ?? (index === 0 ? '核心内容' : '')}</Text>{section.paragraphs.map((paragraph) => <Text className="paragraph" key={paragraph}>{paragraph}</Text>)}</View>)}</View>
    {node.related.length > 0 && <View className="related"><Text className="section-heading">继续看看</Text>{node.related.map((item) => <View className="related-card" key={item.id} onClick={() => openRelated(item.slug)}><Text className="related-title">{item.title}</Text><Text className="subtle">{item.domainName} · {item.topicName}</Text><Text className="related-summary">{item.summary}</Text></View>)}</View>}
  </View>;
}
