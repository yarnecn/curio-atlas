import Taro from '@tarojs/taro';
import type {
  AuthStateView,
  CreateSubmissionInput,
  CreateSubmissionResponse,
  KnowledgeNodeDetail,
  KnowledgeNodeSummary,
  SubmissionView,
  TopicSummary,
  VoteInput,
} from '@knowledge-map/contracts';

// 真机预览或正式发布前，将这里改为已备案的 HTTPS API 地址。
export const API_BASE_URL = 'http://127.0.0.1:8080/api';

type RequestOptions = Omit<Taro.request.Option, 'url'>;
const SESSION_COOKIE_KEY = 'curio-session-cookie';

function sessionCookieFromResponse(response: Taro.request.SuccessCallbackResult): string | null {
  const cookie = response.cookies?.find((item) => /(?:__Host-)?knowledge_map_session=/.test(item));
  if (cookie) return cookie.split(';', 1)[0] ?? null;
  const header = response.header ?? {};
  const setCookie = header['Set-Cookie'] ?? header['set-cookie'];
  if (typeof setCookie === 'string') return setCookie.split(';', 1)[0] ?? null;
  if (Array.isArray(setCookie) && typeof setCookie[0] === 'string') return setCookie[0].split(';', 1)[0] ?? null;
  return null;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const sessionCookie = Taro.getStorageSync<string>(SESSION_COOKIE_KEY);
  const response = await Taro.request<T>({
    url: `${API_BASE_URL}${path}`,
    ...options,
    credentials: 'include',
    header: { accept: 'application/json', ...(sessionCookie ? { Cookie: sessionCookie } : {}), ...(options.header ?? {}) },
  });
  const nextCookie = sessionCookieFromResponse(response);
  if (nextCookie) Taro.setStorageSync(SESSION_COOKIE_KEY, nextCookie);
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const payload = response.data as unknown as { message?: string | string[] } | null;
    const message = Array.isArray(payload?.message) ? payload.message.join('；') : payload?.message;
    throw new Error(message ?? `请求失败（${response.statusCode}）`);
  }
  return response.data;
}

export const miniApi = {
  authState: () => request<AuthStateView>('/auth/me'),
  login: (publicHandle: string, password: string) => request<AuthStateView>('/auth/login', { method: 'POST', data: { publicHandle, password } }),
  register: (input: { publicHandle: string; displayName?: string; password: string }) => request<AuthStateView>('/auth/register', { method: 'POST', data: input }),
  topics: () => request<TopicSummary[]>('/topics'),
  knowledgeNodes: () => request<KnowledgeNodeSummary[]>('/knowledge'),
  knowledgeNode: (slug: string) => request<KnowledgeNodeDetail>(`/knowledge/slug/${encodeURIComponent(slug)}`),
  submissions: () => request<SubmissionView[]>('/submissions'),
  vote: (id: string, input: VoteInput) => request<SubmissionView>(`/submissions/${id}/vote`, { method: 'PUT', data: input }),
  createSubmission: (input: CreateSubmissionInput) => request<CreateSubmissionResponse>('/submissions', { method: 'POST', data: input }),
};

export function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isLoginRequired(error: unknown): boolean {
  return error instanceof Error && /登录|认证|权限|unauthorized|401/i.test(error.message);
}
