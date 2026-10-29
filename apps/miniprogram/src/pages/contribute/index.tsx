import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad } from '@tarojs/taro';
import type { TopicSummary } from '@knowledge-map/contracts';
import { useState } from 'react';
import { isLoginRequired, messageOf, miniApi } from '../../api';
import './index.css';

export default function ContributePage() {
  const [topics, setTopics] = useState<TopicSummary[]>([]);
  const [topicIndex, setTopicIndex] = useState(0);
  const [statement, setStatement] = useState('');
  const [proposedTitle, setProposedTitle] = useState('');
  const [whyUseful, setWhyUseful] = useState('');
  const [applicability, setApplicability] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);
  const [original, setOriginal] = useState('');
  useLoad((params) => { if (params.note) void miniApi.note(params.note).then(note => { setOriginal(note.content); setStatement(note.content.length <= 160 ? note.content : ''); setSourceUrl(note.sourceUrl); setMessage('已带入私密记录，请提炼 12～160 字结论并补充用途与来源。原记录仍保留。'); }).catch(error => setMessage(messageOf(error, '原记录读取失败。'))); });
  useDidShow(() => { void miniApi.authState().then((state) => { if (!state.user) void Taro.navigateTo({ url: '/pages/login/index' }); }).catch(() => undefined); void miniApi.topics().then(setTopics).catch((error) => setMessage(messageOf(error, '话题加载失败。'))); });
  async function submit() {
    if (proposedTitle.trim().length < 2 || proposedTitle.trim().length > 80) { setMessage('请填写 2～80 字标题。'); return; }
    if (statement.trim().length < 12 || statement.trim().length > 160) { setMessage('请将结论整理为 12～160 字。'); return; }
    if (whyUseful.trim().length < 12 || whyUseful.trim().length > 300) { setMessage('请填写 12～300 字的用途说明。'); return; }
    if (!topics[topicIndex]) { setMessage('请先选择话题。'); return; }
    setWorking(true); setMessage('');
    try { await miniApi.createSubmission({ proposedTitle, topicId: topics[topicIndex].id, statement, whyUseful, applicability, sourceUrl: sourceUrl || undefined, experienceBased: false, aiDisclosure: false }); setMessage('已提交，AI 预处理后会进入审核流程。'); setProposedTitle(''); setStatement(''); setWhyUseful(''); setApplicability(''); setSourceUrl(''); }
    catch (error) { if (isLoginRequired(error)) { void Taro.navigateTo({ url: '/pages/login/index' }); } else setMessage(messageOf(error, '提交失败，请稍后重试。')); }
    finally { setWorking(false); }
  }
  return <View className="page">
    <Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button>
    <Text className="page-title">贡献一条精华</Text>
    <Text className="intro">整理好再提交，不会自动公开。投稿仍经过预处理与人工审核。</Text>
    {original && <View className="form-card"><Text className="subtle">原始灵感 · 仅自己可见</Text><Text style={{ display: 'block', whiteSpace: 'pre-wrap' }}>{original}</Text></View>}
    <View className="form-card">
      <Text>标题（2～80 字）</Text><Input className="input" value={proposedTitle} maxlength={80} onInput={event => setProposedTitle(event.detail.value)} placeholder="例如：HTTPS 能保护什么？" />
      <Text>话题</Text><Picker mode="selector" range={topics.map(topic => `${topic.domainName} · ${topic.name}`)} value={topicIndex} onChange={event => setTopicIndex(Number(event.detail.value))}><View className="input">{topics[topicIndex]?.name ?? '选择话题'}</View></Picker>
      <Text>一句话结论（12～160 字）</Text><Textarea className="textarea" value={statement} onInput={event => setStatement(event.detail.value)} maxlength={160} />
      <Text>为什么有用（12～300 字）</Text><Textarea className="textarea small" value={whyUseful} onInput={event => setWhyUseful(event.detail.value)} maxlength={300} />
      <Text>需要注意（可选）</Text><Textarea className="textarea small" value={applicability} onInput={event => setApplicability(event.detail.value)} maxlength={300} />
      <Text>来源链接（可选，供审核参考）</Text><Input className="input" value={sourceUrl} onInput={event => setSourceUrl(event.detail.value)} />
      <Button className="primary-button" loading={working} disabled={working} onClick={() => void submit()}>提交审核</Button>
      {message && <Text className="message">{message}</Text>}
    </View>
  </View>;
}
