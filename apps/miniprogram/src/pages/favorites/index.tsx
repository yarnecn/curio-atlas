import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import type { KnowledgeNodeSummary } from '@knowledge-map/contracts';
import { miniApi, messageOf } from '../../api';
import { FAVORITES_KEY, readIds } from '../../storage';
import './index.css';

export default function FavoritesPage() {
  const [nodes, setNodes] = useState<KnowledgeNodeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  async function load() {
    setLoading(true); setMessage('');
    try {
      const ids = readIds(FAVORITES_KEY);
      setNodes(ids.length ? (await miniApi.knowledgeNodes()).filter((node) => ids.includes(node.id)) : []);
    } catch (error) { setMessage(messageOf(error, '收藏加载失败，请重试。')); }
    finally { setLoading(false); }
  }
  useDidShow(() => { void load(); });
  function remove(id: string) {
    Taro.setStorageSync(FAVORITES_KEY, readIds(FAVORITES_KEY).filter((item) => item !== id));
    setNodes((items) => items.filter((item) => item.id !== id));
  }
  return <View className="page">
    <Text className="page-title">留着慢慢看</Text>
    <Text className="intro">收藏保存在当前设备，无需登录。</Text>
    {loading ? <Text className="empty">正在读取...</Text> : message ? <View><Text className="message">{message}</Text><Button className="secondary-button" onClick={() => void load()}>重试</Button></View> : nodes.length === 0 ? <View><Text className="empty">还没有可查看的收藏，遇到喜欢的常识点一下 ☆。</Text><Button className="primary-button" onClick={() => void Taro.switchTab({ url: '/pages/index/index' })}>去看看</Button></View> : <View className="compact-list">{nodes.map((node) => <View className="compact-card" key={node.id}>
      <View onClick={() => void Taro.navigateTo({ url: `/pages/knowledge/index?slug=${encodeURIComponent(node.slug)}` })}><Text className="compact-title">{node.title}</Text><Text className="compact-summary">{node.summary}</Text></View>
      <View className="toolbar"><Text className="subtle">约 {node.readingTimeMinutes} 分钟</Text><Button className="link-button" onClick={() => remove(node.id)}>取消收藏</Button></View>
    </View>)}</View>}
  </View>;
}
