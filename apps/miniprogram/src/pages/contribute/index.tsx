import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { TopicSummary } from '@knowledge-map/contracts';
import { useState } from 'react';
import { isLoginRequired, messageOf, miniApi } from '../../api';
import './index.css';

export default function ContributePage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicIndex, setTopicIndex] = useState(0);
  const [statement, setStatement] = useState('');
  const [whyUseful, setWhyUseful] = useState('');
  const [applicability, setApplicability] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  useDidShow(() => { void miniApi.authState().then((state) => { if (!state.user) void Taro.navigateTo({ url: '/pages/login/index' }); }).catch(() => undefined); void miniApi.topics().then(setTopics).catch((error) => setMessage(messageOf(error, '话题加载失败。'))); });
  async function submit() {
    if (!topics[topicIndex]) { setMessage('请先选择话题。'); return; }
    setWorking(true); setMessage('');
    try { await miniApi.createSubmission({ topicId: topics[topicIndex].id, statement, whyUseful, applicability, sourceUrl: sourceUrl || undefined, experienceBased: false, aiDisclosure: false }); setMessage('已提交，AI 预处理后会进入审核流程。'); setStatement(''); setWhyUseful(''); setApplicability(''); setSourceUrl(''); }
    catch (error) { if (isLoginRequired(error)) { void Taro.navigateTo({ url: '/pages/login/index' }); } else setMessage(messageOf(error, '提交失败，请稍后重试。')); }
    finally { setWorking(false); }
  }
  return <View className="page"><Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button><Text className="eyebrow">CONTRIBUTE · 投稿</Text><Text className="page-title">贡献一条精华</Text><Text className="intro">直接写清楚结论，不用提问。提交后会经过 AI 预处理和人工审核。</Text><View className="form-card"><View className="field"><Text>话题</Text><Picker mode="selector" range={topics.map((topic) => `${topic.domainName} · ${topic.name}`)} value={topicIndex} onChange={(event) => setTopicIndex(Number(event.detail.value))}><View className="input">{topics[topicIndex] ? `${topics[topicIndex].domainName} · ${topics[topicIndex].name}` : '选择话题'}</View></Picker></View><View className="field"><Text>常识内容</Text><Textarea className="textarea" value={statement} onInput={(event) => setStatement(event.detail.value)} maxlength={2000} placeholder="用一到几个短段落把结论说完整" /></View><View className="field"><Text>为什么有用</Text><Textarea className="textarea small" value={whyUseful} onInput={(event) => setWhyUseful(event.detail.value)} maxlength={500} /></View><View className="field"><Text>适用边界</Text><Textarea className="textarea small" value={applicability} onInput={(event) => setApplicability(event.detail.value)} maxlength={500} /></View><View className="field"><Text>来源链接（可选）</Text><Input className="input" value={sourceUrl} onInput={(event) => setSourceUrl(event.detail.value)} /></View><Button className="primary-button" loading={working} disabled={working} onClick={() => void submit()}>提交审核</Button>{message && <Text className="message">{message}</Text>}</View></View>;
}
