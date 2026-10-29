import { useState } from 'react';
import { View, Text, Button, Input, Textarea } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage } from '@tarojs/taro';
import type { AuthUserView } from '@knowledge-map/contracts';
import { api, request, type Case, type Detail, type Comment } from '../../api';

const categories = ['恋爱', '室友', '友情', '家庭', '自己'];
const statuses: Record<string, string> = { pending: '等待开庭 · 审核中', open: '正在开庭', closed: '本案已结', rejected: '未通过审核' };
function juryOpinion(item: Case) {
  if (!item.resultsVisible) return '先给出你的判断，再查看大家的选择。阅读讨论后，你仍可以修改投票。';
  const votes = [Number(item.plaintiff), Number(item.defendant), Number(item.peace)];
  const top = Math.max(...votes);
  if (!top) return '尚无人投票。';
  if (votes.filter(n => n === top).length > 1) return '目前票数相同，讨论仍有不同方向。';
  return ['目前支持原告的票数较多。', '目前支持被告的票数较多。', '目前建议双方协商的票数较多。'][votes.indexOf(top)];
}
const contributionPrompts: Record<string, string> = {
  原告律师: '你认为原告哪里有道理？也可以提出一个大家没注意到的角度。',
  被告律师: '如果站在对方的角度，这件事还有什么解释？',
  和事佬: '你会建议双方怎么处理？方案由你来定。',
  证人: '分享你亲历或了解的情况；类比经历请注明。',
  被告: '从你的角度补充经过，可以回应原告，也可以解释分歧。',
  提问: '你还想了解哪个细节？向当事人或其他参与者提问。',
  补充线索: '补充一个可能影响判断的细节，区分事实与猜测。',
  结案提案: '如果由你来提出解决办法，你会怎么安排？',
  改判理由: '哪条发言或新信息改变了你的判断？说说原因。',
};
export default function Court() {
  const [page, setPage] = useState('feed');
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [items, setItems] = useState<Case[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [scope, setScope] = useState('public');
  const [category, setCategory] = useState('全部');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false);
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [demand, setDemand] = useState('');
  const [kind, setKind] = useState('恋爱');
  const [role, setRole] = useState('和事佬');
  const [content, setContent] = useState('');
  const [pending, setPending] = useState<Comment[]>([]);
  const moderator = !!user && ['owner', 'reviewer'].includes(user.role);

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : '网络开了小差，请重试'); }
    finally { setBusy(false); }
  }
  async function list(next = scope, append = false) {
    const rows = await api.cases(next, append ? items.length : 0);
    setItems(append ? [...items, ...rows] : rows); setScope(next); setMore(rows.length === 20); setLoaded(true);
    if (next === 'review') setPending(await request<Comment[]>('/court/review/comments'));
    setPage('feed');
  }
  async function open(id: string) { setDetail(await api.detail(id)); setContent(''); setRole('和事佬'); setPage('detail'); }
  function needLogin(next: string) { setError(''); setPage(user ? next : 'login'); }
  useLoad(options => {
    void run(async () => {
      setUser((await api.me()).user);
      if (options.id) await open(options.id); else await list('public');
    });
  });
  useShareAppMessage(() => {
    const shareCase = page === 'detail' && detail && ['open', 'closed'].includes(detail.status) ? detail : null;
    return { title: shareCase ? `这事你来判｜${shareCase.title} · 芝麻开庭` : '芝麻开庭：这事你来判', path: `/pages/index/index${shareCase ? `?id=${shareCase.id}` : ''}` };
  });
  async function review(kindValue: string, id: string, decision: string) {
    await request(`/court/review/${kindValue}/${id}`, 'PUT', { decision });
    await list('review');
  }

  return <View className='page'>
    {page === 'feed' && <>
      <View className='hero'><View className='eyebrow'>生活小事 · 共同讨论</View><View className='title'>芝麻开庭。</View><View className='subtitle'>同一件事，可以有不同的道理。听听双方，也说说你的看法。</View><View className='stamp'>每个人都有发言席</View></View>
      <View className='tabs'>{[['public', '围观开庭'], ['mine', '我的案卷'], ...(moderator ? [['review', '审核席']] : [])].map(([value, label]) => <View key={value} className={`chip ${scope === value ? 'active' : ''}`} onClick={() => void run(async () => { if (value !== 'public' && !user) setPage('login'); else await list(value); })}>{label}</View>)}</View>
      <View className='chips'>{['全部', ...categories].map(v => <Text key={v} className={`chip ${category === v ? 'active' : ''}`} onClick={() => setCategory(v)}>{v}</Text>)}</View>
      <View className='small'>匿名展示 · 内容审核后公开 · 陪审意见仅供娱乐</View>
      {items.filter(v => category === '全部' || v.category === category).map(item => <View className='card' key={item.id}>
        <View onClick={() => void run(() => open(item.id))}><View className='meta'>{item.category}法庭 / {statuses[item.status]}</View><View className='case-title'>{item.title}</View><View className='body'>{item.story.slice(0, 90)}{item.story.length > 90 ? '…' : ''}</View><View className='votes'>{item.totalVotes} 人参与判断 · {item.status === 'closed' ? item.resolution : '进入案件，听听不同角度'}</View></View>
        {scope === 'review' && <View className='actions'><Button disabled={busy} onClick={() => void run(() => review('case', item.id, 'approve'))}>准许开庭</Button><Button disabled={busy} onClick={() => void run(() => review('case', item.id, 'reject'))}>驳回</Button></View>}
      </View>)}
      {loaded && !items.filter(v => category === '全部' || v.category === category).length && <View className='empty'>这里还没有案件。你可以发起一件想听听大家看法的小事。</View>}
      {more && <Button disabled={busy} onClick={() => void run(() => list(scope, true))}>继续翻案卷</Button>}
      {scope === 'review' && pending.map(c => <View className='card' key={c.id}><View className='meta'>{c.role} · 待审发言</View><View className='body'>{c.content}</View><View className='actions'><Button onClick={() => void run(() => open(c.caseId!))}>看案情</Button><Button disabled={busy} onClick={() => void run(() => review('comment', c.id, 'approve'))}>通过</Button><Button disabled={busy} onClick={() => void run(() => review('comment', c.id, 'reject'))}>驳回</Button></View></View>)}
    </>}
    {page !== 'feed' && <View className='back' onClick={() => void run(() => list('public'))}>← 返回围观席</View>}
    {page === 'login' && <View className='card'><View className='case-title'>{register ? '领取陪审员席位' : '陪审员请入席'}</View><View className='small'>使用常识漫游账号登录，也可以注册新账号。</View><Input className='field' placeholder='账号' value={handle} maxlength={32} onInput={e => setHandle(e.detail.value)} /><Input className='field' password placeholder='密码（注册至少 10 位）' value={password} maxlength={128} onInput={e => setPassword(e.detail.value)} /><Button className='primary' disabled={busy} onClick={() => void run(async () => { const state = await api.login(handle, password, register); setUser(state.user); setPassword(''); await list('public'); })}>{register ? '注册并入席' : '登录'}</Button><View className='chips'><Text onClick={() => setRegister(!register)}>{register ? '已有账号，去登录' : '没有账号，去注册'}</Text></View></View>}
    {page === 'create' && <><View className='title'>我要立案</View><View className='notice'>请用昵称称呼对方，不填写真实姓名、电话或住址。只聊生活趣事，审核后开庭。</View><View className='chips'>{categories.map(v => <Text className={`chip ${kind === v ? 'active' : ''}`} key={v} onClick={() => setKind(v)}>{v}法庭</Text>)}</View><Input className='field' value={title} maxlength={60} placeholder='案名：最后一口蛋糕失踪案' onInput={e => setTitle(e.detail.value)} /><Textarea className='field story' value={story} maxlength={2000} placeholder='发生了什么？双方的分歧在哪里？你也可以写一个假设情境，邀请大家讨论。' onInput={e => setStory(e.detail.value)} /><Input className='field' value={demand} maxlength={120} placeholder='希望怎么解决？也可以只请大家评理' onInput={e => setDemand(e.detail.value)} /><Button className='primary' disabled={busy || !title.trim() || !story.trim() || !demand.trim()} onClick={() => void run(async () => { const result = await request<Case>('/court/cases', 'POST', { title, story, demand, category: kind }); setTitle(''); setStory(''); setDemand(''); await open(result.id); })}>递交案卷</Button></>}
    {page === 'detail' && detail && <>
      <View className='meta'>案卷 {detail.id.slice(0, 8).toUpperCase()} / {detail.category}法庭</View><View className='title'>{detail.title}</View><View className='stamp'>{statuses[detail.status]}</View><View className='card'><View className='section'>原告陈述</View><View className='body'>{detail.story}</View><View className='demand'>诉求：{detail.demand}</View><View className='small'>当前仅根据已公开陈述讨论；被告身份为用户自述。</View></View>
      <View className='chips'><Text className='chip'>① 阅读案情</Text><Text className='chip'>② 给出判断</Text><Text className='chip'>③ 讨论与改判</Text></View>
      <View className='section'>{detail.status === 'closed' ? '讨论结果' : detail.isAuthor || detail.isDefendant ? '陪审团意见' : detail.myVote ? '你的判断与大家的选择' : '先给出你的判断'}</View><View className='notice'>{juryOpinion(detail)}</View>{detail.resultsVisible && <View className='small'>支持原告 {detail.plaintiff} 票 · 支持被告 {detail.defendant} 票 · 建议协商 {detail.peace} 票。票数代表参与者意见。</View>}
      {detail.status === 'open' && <View className='actions'>{[['plaintiff', '支持原告'], ['defendant', '支持被告'], ['peace', '建议协商']].map(([value, label]) => <Button key={value} disabled={busy || detail.isAuthor || detail.isDefendant} className={detail.myVote === value ? 'green' : ''} onClick={() => { if (!user) setPage('login'); else void run(async () => { await request(`/court/cases/${detail.id}/vote`, 'PUT', { choice: value }); await open(detail.id); }); }}>{label}</Button>)}</View>}
      {detail.status === 'closed' && <View className='notice'>结案记录：{detail.resolution}。感谢每一位参与讨论的人。</View>}
      {detail.myVote && detail.status === 'open' && <View className='small'>读完双方陈述或讨论后，可以直接选择另一项改票；也欢迎在发言中留下改判理由。</View>}
      {['open', 'closed'].includes(detail.status) && <Button openType='share'>邀请朋友来评理 ↗</Button>}
      <View className='section'>庭审发言</View>{detail.comments.map(c => <View className='comment' key={c.id}><View className='meta'>{c.role}{c.status !== 'approved' ? ` · ${c.status === 'pending' ? '待审核' : '未通过'}` : ''}</View><View className='body'>{c.content}</View></View>)}
      {!detail.comments.length && <View className='small'>暂无发言，第一位律师请上场。</View>}
      {detail.status === 'open' && <View className='card'><View className='section'>这次你想怎么参与？</View><View className='small'>角色只是发言角度，可以随时换。你可以认真讨论，也可以展开想象；假设内容请说明。</View><View className='chips'>{['原告律师', '被告律师', '和事佬', '证人', '提问', '补充线索', '结案提案', ...(detail.myVote ? ['改判理由'] : []), ...(!detail.isAuthor ? ['被告'] : [])].map(v => <Text key={v} className={`chip ${role === v ? 'active' : ''}`} onClick={() => setRole(v)}>{v}</Text>)}</View><Textarea className='field story' value={content} maxlength={600} placeholder={contributionPrompts[role]} onInput={e => setContent(e.detail.value)} /><Button disabled={busy || !content.trim()} className='green' onClick={() => { if (!user) setPage('login'); else void run(async () => { await request(`/court/cases/${detail.id}/comments`, 'POST', { role, content }); await open(detail.id); }); }}>提交发言，等待审核</Button></View>}
      {detail.isAuthor && detail.status === 'open' && <><View className='section'>原告申请结案</View><View className='small'>仅记录原告反馈，不代表对方已确认或负有履行义务。</View><View className='actions'>{['已达成共识', '保留不同意见', '撤回案件', '暂时封存'].map(resolution => <Button key={resolution} disabled={busy} onClick={() => void run(async () => { const confirm = await Taro.showModal({ title: '确认结案', content: `结案方式：${resolution}。结案后停止投票和发言。` }); if (confirm.confirm) { await request(`/court/cases/${detail.id}/close`, 'PUT', { resolution }); await open(detail.id); } })}>{resolution}</Button>)}</View></>}
    </>}
    {page === 'profile' && <><View className='title'>我的陪审席</View><View className='card'><View className='case-title'>{user?.displayName || user?.publicHandle}</View><View className='body'>说出理由，也听听不同的看法。</View><View className='actions'><Button onClick={() => void run(() => list('mine'))}>我的案卷</Button><Button disabled={busy} onClick={() => void run(async () => { await api.logout(); setUser(null); await list('public'); })}>退出登录</Button></View></View><View className='notice'>本庭提供娱乐互动，不构成法律判断。暂未接入微信订阅消息，不会主动发送翻账提醒。</View></>}
    {busy && <View className='small'>正在加载…</View>}{error && <View className='error'>{error}<View onClick={() => void run(async () => { if (page === 'detail' && detail) await open(detail.id); else await list(scope); })}>点击重试</View></View>}
    <View className='nav'><Button onClick={() => void run(() => list('public'))}>⚖ 围观</Button><Button className='primary' onClick={() => needLogin('create')}>＋ 我要立案</Button><Button onClick={() => needLogin('profile')}>我的席位</Button></View>
  </View>;
}

