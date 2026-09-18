import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { SubmissionView, VoteValue } from '@knowledge-map/contracts';
import { useState } from 'react';
import { isLoginRequired, messageOf, miniApi } from '../../api';
import './index.css';

export default function SubmissionsPage() {
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [message, setMessage] = useState('');
  async function load() { try { setItems(await miniApi.submissions()); setMessage(''); } catch (error) { setMessage(messageOf(error, '候选内容加载失败。')); } }
  useDidShow(() => { void load(); });
  async function vote(id: string, value: VoteValue) {
    try { const updated = await miniApi.vote(id, { value }); setItems((current) => current.map((item) => item.id === id ? updated : item)); }
    catch (error) { if (isLoginRequired(error)) { void Taro.navigateTo({ url: '/pages/login/index' }); return; } setMessage(messageOf(error, '评分失败。')); }
  }
  return <View className="page"><Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button><Text className="eyebrow">TRIAL POOL · 尝试池</Text><Text className="page-title">这条常识有用吗？</Text><Text className="intro">评分只决定内容是否值得继续加工；真实性仍由来源和审核负责。</Text>{message && <Text className="message">{message}</Text>}<View className="submission-list">{items.map((item) => <View className="submission-card" key={item.id}><Text className="subtle">{item.topic.domainName} · {item.topic.name}</Text><Text className="submission-title">{item.displayStatement}</Text><Text className="paragraph">{item.whyUseful}</Text><Text className="subtle">适用边界：{item.applicability}</Text><View className="vote-row"><Button className="secondary-button" onClick={() => void vote(item.id, 'useful')}>有用 {item.usefulCount}</Button><Button className="secondary-button" onClick={() => void vote(item.id, 'not_useful')}>没用 {item.notUsefulCount}</Button><Text className="subtle">{Math.round(item.usefulnessRate * 100)}% 有用</Text></View></View>)}</View>{items.length === 0 && !message && <Text className="empty">暂时没有进入尝试展示的内容。</Text>}</View>;
}
