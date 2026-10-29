import Taro from '@tarojs/taro';
import type { AuthUserView } from '@knowledge-map/contracts';

// Uses the same deployed gateway as Curio Atlas; configure the WeChat request domain before release.
const BASE = 'https://atlas.yarne.cc/api';
const COOKIE = 'court-session';
export type Case = { id: string; authorId: string; title: string; story: string; category: string; demand: string; status: string; resolution: string; plaintiff: number | null; defendant: number | null; peace: number | null; totalVotes: number; resultsVisible: boolean };
export type Comment = { id: string; caseId?: string; role: string; content: string; status: string };
export type Detail = Case & { comments: Comment[]; myVote: string | null; isAuthor: boolean; isDefendant: boolean };
export async function request<T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', data?: object): Promise<T> {
  const cookie = Taro.getStorageSync<string>(COOKIE);
  const response = await Taro.request<T>({ url: BASE + path, method, data, header: cookie ? { Cookie: cookie } : {} });
  const next = response.cookies?.find(v => /knowledge_map_session=/.test(v)) ?? response.header?.['Set-Cookie'] ?? response.header?.['set-cookie'];
  if (typeof next === 'string') Taro.setStorageSync(COOKIE, next.split(';')[0]);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message = (response.data as { message?: string | string[] })?.message;
    throw new Error(Array.isArray(message) ? message.join('；') : message || '请求失败，请稍后重试');
  }
  return response.data;
}
export const api = {
  me: () => request<{ user: AuthUserView | null }>('/auth/me'),
  login: (publicHandle: string, password: string, register: boolean) => request<{ user: AuthUserView }>(`/auth/${register ? 'register' : 'login'}`, 'POST', { publicHandle, password }),
  logout: async () => { await request('/auth/logout', 'POST'); Taro.removeStorageSync(COOKIE); },
  cases: (scope: string, offset = 0) => request<Case[]>(`/court/cases?scope=${scope}&offset=${offset}`),
  detail: (id: string) => request<Detail>(`/court/cases/${id}`),
};
