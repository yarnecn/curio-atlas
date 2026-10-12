import { Button, Input, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useRef, useState } from 'react';
import { miniApi, messageOf, isLoginRequired, type PersonalNote } from '../../api';

export default function NotesPage() {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  const key = useRef('');
  async function load(start = 0) { try { setNotes(await miniApi.notes(start)); setOffset(start); } catch (error) { setNotes([]); throw error; } }
  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await work(); }
    catch (error) { setMessage(messageOf(error, '操作失败，输入仍保留，请重试。')); }
    finally { setBusy(false); }
  }
  useDidShow(() => { void load().catch(error => setMessage(isLoginRequired(error) ? '登录后就能同步你的私密记录。' : messageOf(error, '记录加载失败。'))); });
  return <View className="page">
    <Text className="page-title">先记下来，再慢慢想</Text>
    <Text className="intro">只给自己看。不必选分类，不会自动公开或交给 AI。</Text>
    <View className="form-card">
      <Textarea className="textarea" maxlength={5000} value={content} placeholder="今天发现…… / 下次想查证……" onInput={event => { setContent(event.detail.value); key.current = ''; }} />
      <Text className="subtle">{content.length} / 5000</Text>
      <Input className="input" value={sourceUrl} placeholder="来源链接（可选）" onInput={event => { setSourceUrl(event.detail.value); key.current = ''; }} />
      <Button className="primary-button" disabled={busy || !content.trim()} loading={busy} onClick={() => void act(async () => {
        if (!key.current) key.current = `mini_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await miniApi.saveNote(content, sourceUrl, key.current, editing);
        setContent(''); setSourceUrl(''); setEditing(undefined); key.current = ''; setMessage('已保存，仅你可见。'); await load();
      })}>{editing ? '保存修改' : '记下来'}</Button>
      {editing && <Button disabled={busy} onClick={() => { setEditing(undefined); setContent(''); setSourceUrl(''); }}>取消编辑</Button>}
    </View>
    {message && <Text className="message">{message}</Text>}
    <Button className="link-button" onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}>登录 / 切换账号</Button>
    <Text className="section-title">我的灵感收件箱</Text>
    {!notes.length && <Text className="intro">从一个小发现开始。记录后，可以慢慢整理成对别人有用的常识。</Text>}
    {notes.map(note => <View className="form-card" key={note.id}>
      <Text className="subtle">{new Date(note.createdAt).toLocaleDateString()} · 私密</Text>
      <Text style={{ whiteSpace: 'pre-wrap', display: 'block' }}>{note.content}</Text>
      {note.sourceUrl && <Button className="link-button" onClick={() => void Taro.setClipboardData({ data: note.sourceUrl })}>复制来源链接</Button>}
      <Button className="primary-button" onClick={() => void Taro.navigateTo({ url: `/pages/contribute/index?note=${note.id}` })}>整理为常识</Button>
      <Button disabled={busy} onClick={() => { setEditing(note.id); setContent(note.content); setSourceUrl(note.sourceUrl); void Taro.pageScrollTo({ scrollTop: 0 }); }}>编辑</Button>
      <Button disabled={busy} onClick={() => void Taro.showModal({ title: '删除记录', content: '永久删除这条私密记录？' }).then(result => { if (result.confirm) void act(async () => { await miniApi.deleteNote(note.id); await load(offset); }); })}>删除</Button>
    </View>)}
    <Button disabled={busy || offset === 0} onClick={() => void act(() => load(Math.max(0, offset - 50)))}>上一页</Button>
    <Button disabled={busy || notes.length < 50} onClick={() => void act(() => load(offset + 50))}>下一页</Button>
  </View>;
}
