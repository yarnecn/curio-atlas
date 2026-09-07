import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthStateView, AuthUserView, LoginInput, RegisterAccountInput } from '@knowledge-map/contracts';
import { Phase1Repository } from '@knowledge-map/database';
import { throwRepositoryError } from '../common/repository-errors';

const developmentCookie = 'knowledge_map_session';
const productionCookie = '__Host-knowledge_map_session';
const sessionSeconds = 7 * 24 * 60 * 60;

function cookieName(): string {
  return process.env.COOKIE_SECURE === 'true' ? productionCookie : developmentCookie;
}

function readCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if ((name === developmentCookie || name === productionCookie) && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export interface CookieResponse {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class AuthService {
  constructor(@Inject(Phase1Repository) private readonly repository: Phase1Repository) {}

  async register(input: RegisterAccountInput, response: CookieResponse): Promise<AuthStateView> {
    try {
      const session = await this.repository.registerAccount(input);
      this.setSessionCookie(response, session.token);
      return { user: session.user };
    } catch (error) { return throwRepositoryError(error); }
  }

  async login(input: LoginInput, response: CookieResponse): Promise<AuthStateView> {
    try {
      const session = await this.repository.loginAccount(input);
      this.setSessionCookie(response, session.token);
      return { user: session.user };
    } catch (error) { return throwRepositoryError(error); }
  }

  async state(cookieHeader: string | undefined): Promise<AuthStateView> {
    const token = readCookie(cookieHeader);
    return { user: token ? await this.repository.getSessionUser(token) : null };
  }

  async requireUser(cookieHeader: string | undefined): Promise<AuthUserView> {
    const state = await this.state(cookieHeader);
    if (!state.user) throw new UnauthorizedException('请先登录。');
    return state.user;
  }

  async logout(cookieHeader: string | undefined, response: CookieResponse): Promise<AuthStateView> {
    const token = readCookie(cookieHeader);
    if (token) await this.repository.deleteSession(token);
    this.clearSessionCookie(response);
    return { user: null };
  }

  private setSessionCookie(response: CookieResponse, token: string): void {
    const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
    response.setHeader('Set-Cookie', `${cookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionSeconds}${secure}`);
  }

  private clearSessionCookie(response: CookieResponse): void {
    const secure = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
    response.setHeader('Set-Cookie', `${cookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  }
}
