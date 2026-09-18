import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { messageOf, miniApi } from '../../api';
import './index.css';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [working, setWorking] = useState(false);

  async function submit() {
    setWorking(true); setMessage('');
    try {
      if (mode === 'register') await miniApi.register({ publicHandle: handle, displayName: displayName || undefined, password });
      else await miniApi.login(handle, password);
      Taro.showToast({ title: '已登录', icon: 'success' });
      setTimeout(() => void Taro.navigateBack(), 500);
    } catch (error) { setMessage(messageOf(error, '操作失败，请检查账号和密码。')); }
    finally { setWorking(false); }
  }
  return <View className="page"><Button className="back" onClick={() => void Taro.navigateBack()}>← 返回</Button><Text className="eyebrow">ACCOUNT · 昵称账号</Text><Text className="page-title">{mode === 'login' ? '登录' : '注册'}</Text><Text className="intro">阅读不需要登录；投稿、评分和收藏使用昵称账号，不要求实名。</Text><View className="auth-tabs"><Button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>登录</Button><Button className={mode === 'register' ? 'tab active' : 'tab'} onClick={() => setMode('register')}>注册</Button></View><View className="form-card"><View className="field"><Text>账号</Text><Input className="input" value={handle} onInput={(event) => setHandle(event.detail.value)} placeholder="小写英文、数字、_ 或 -" /></View>{mode === 'register' && <View className="field"><Text>显示昵称（可不填）</Text><Input className="input" value={displayName} onInput={(event) => setDisplayName(event.detail.value)} /></View>}<View className="field"><Text>密码</Text><Input className="input" password value={password} onInput={(event) => setPassword(event.detail.value)} /></View><Button className="primary-button" loading={working} disabled={working} onClick={() => void submit()}>{working ? '处理中...' : mode === 'login' ? '登录' : '创建昵称账号'}</Button>{message && <Text className="message">{message}</Text>}</View></View>;
}
