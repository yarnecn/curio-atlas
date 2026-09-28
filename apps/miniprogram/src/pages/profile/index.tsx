import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';
import type { AuthUserView } from '@knowledge-map/contracts';
import { miniApi, messageOf } from '../../api';
import { APP_VERSION } from '../../version';

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setMessage('');
    try { setUser((await miniApi.authState()).user); }
    catch (error) { setMessage(messageOf(error, '账号状态暂时无法读取。')); }
    finally { setLoading(false); }
  }
  useDidShow(() => { void load(); });
  async function logout() {
    setLoading(true); setMessage('');
    try { await miniApi.logout(); setUser(null); }
    catch (error) { setMessage(messageOf(error, '退出失败，请重试。')); }
    finally { setLoading(false); }
  }
  return <View className="page">
    <Text className="page-title">{user?.displayName ?? '我的'}</Text>
    <Text className="intro">阅读和本机收藏无需登录。投稿、评分时使用昵称账号。</Text>
    <View className="form-card">
      {loading ? <Text className="subtle">正在处理...</Text> : user ? <Text className="subtle">@{user.publicHandle}</Text> : <Button className="primary-button" onClick={() => void Taro.navigateTo({ url: '/pages/login/index' })}>登录 / 注册</Button>}
      <Button className="secondary-button" onClick={() => void Taro.navigateTo({ url: '/pages/contribute/index' })}>写一条常识</Button>
      <Button className="secondary-button" onClick={() => void Taro.navigateTo({ url: '/pages/submissions/index' })}>尝试池 · 帮忙评一评</Button>
      {user && <Button className="link-button" disabled={loading} onClick={() => void logout()}>退出登录</Button>}
    </View>
    {message && <View><Text className="message">{message}</Text><Button className="secondary-button" onClick={() => void load()}>重新读取账号</Button></View>}
    <Text className="intro">常识地图 · {APP_VERSION}</Text>
  </View>;
}
