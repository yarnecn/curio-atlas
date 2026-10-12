import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';
import { useRef, useState } from 'react';
import type { SubmissionView, VoteValue } from '@knowledge-map/contracts';
import { miniApi, messageOf } from '../../api';

export default function SubmissionPage() {
  const [item, setItem] = useState<SubmissionView | null>(null);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');
  const [handle, setHandle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const voting = useRef(false);
  useDidShow(() => { void miniApi.authState().then(({ user }) => setHandle(user?.publicHandle ?? null)).catch(() => setHandle(null)); });
  useLoad(params => { if (!params.id) { setMessage('缺少候选编号'); return; } void miniApi.submission(params.id).then(setItem).catch(error => setMessage(messageOf(error, '候选未公开或已结束试读。'))); });
  async function vote(value: VoteValue) {
    if (!item || voting.current) return;
    voting.current = true; setBusy(true); setFeedback('');
    try {
      const { user } = await miniApi.authState();
      setHandle(user?.publicHandle ?? null);
      if (!user) { setFeedback('登录后可以评分，阅读无需登录。'); return; }
      if (user.publicHandle === item.authorHandle) { setFeedback('这是你的投稿，不能为自己评分。'); return; }
      setItem(await miniApi.vote(item.id, { value }));
      setFeedback('评分已记录，谢谢反馈。');
    } catch (error) { setFeedback(messageOf(error, '评分失败，请重试。')); }
    finally { voting.current = false; setBusy(false); }
  }
  return <View className="page">
    {message ? <Text className="message">{message}</Text> : !item ? <Text>正在加载…</Text> : <View className="form-card">
      <Text className="eyebrow">已初审 · 尚未正式收录</Text>
      <Text className="page-title">{item.proposedTitle || `${item.topic.name} · 候选试读`}</Text>
      <Text className="subtle">{item.topic.name} · {item.authorHandle}</Text>
      <Text className="section-title">摘要 / 核心结论</Text><Text className="paragraph">{item.displayStatement}</Text>
      <Text className="section-title">解释与用途</Text><Text className="paragraph">{item.whyUseful}</Text>
      {item.applicability && <Text className="paragraph">需要注意：{item.applicability}</Text>}
      {item.sourceUrl && <Button onClick={() => void Taro.setClipboardData({ data: item.sourceUrl! })}>复制来源</Button>}
      <Text className="subtle">评分代表用途反馈，不代表事实核验；正式收录仍需审核。</Text>
      {handle === item.authorHandle ? <Text className="paragraph">这是你的投稿，等待其他读者反馈；不能为自己评分。</Text> : <View className="vote-row">
        <Button disabled={busy} onClick={() => void vote('useful')}>有用 {item.usefulCount}</Button>
        <Button disabled={busy} onClick={() => void vote('not_useful')}>没用 {item.notUsefulCount}</Button>
      </View>}
      {!handle && <Button onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}>登录后参与评分</Button>}
      {feedback && <Text className="message">{feedback}</Text>}
    </View>}
  </View>;
}
