import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useEffect, useState } from 'react';
import type { SubmissionView, VoteValue } from '@knowledge-map/contracts';
import { miniApi, messageOf } from '../api';

export function TrialCard({ domain, creator, batch }: { domain: string; creator: string; batch: number }) {
  const [items, setItems] = useState<SubmissionView[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useDidShow(() => { void miniApi.submissions().then(setItems).catch(() => setItems([])); });
  useEffect(() => { setMessage(''); }, [domain, creator, batch]);
  const pool = items.filter((entry) => entry.initialReviewRequired === false
    && entry.originType === 'user_submission' && creator === 'all'
    && (domain === '全部' || entry.topic.domainName === domain));
  const item = pool[batch % pool.length];
  if (!item) return null;
  async function vote(value: VoteValue) {
    if (!item || busy) return;
    setBusy(true); setMessage('');
    try {
      const { user } = await miniApi.authState();
      if (!user) { setMessage('登录后可以评分，阅读无需登录。'); return; }
      if (user.publicHandle === item.authorHandle) { setMessage('不能为自己的投稿评分。'); return; }
      const updated = await miniApi.vote(item.id, { value });
      setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      setMessage('评分已记录');
    } catch (error) { setMessage(messageOf(error, '评分失败，请重试。')); }
    finally { setBusy(false); }
  }
  return <View className="compact-card">
    <Text className="eyebrow">试读 · 已初审，未正式收录</Text>
    <Text className="subtle">{item.topic.name} · {item.authorHandle}</Text>
    <Text style={{ display: 'block', whiteSpace: 'pre-wrap', lineHeight: '1.8', margin: '16px 0' }}>{item.displayStatement}</Text>
    {item.applicability && <Text className="subtle">需要注意：{item.applicability}</Text>}
    {item.sourceUrl && <Button className="secondary-button" onClick={() => void Taro.setClipboardData({ data: item.sourceUrl! })}>复制来源链接</Button>}
    <View className="toolbar">
      <Button className="secondary-button" disabled={busy} onClick={() => void vote('useful')}>有用 {item.usefulCount}</Button>
      <Button className="secondary-button" disabled={busy} onClick={() => void vote('not_useful')}>没用 {item.notUsefulCount}</Button>
    </View>
    {message && <Text className="subtle">{message}</Text>}
  </View>;
}
