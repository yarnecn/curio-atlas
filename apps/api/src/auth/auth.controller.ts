import { Body, Controller, Get, Headers, Inject, Post, Res } from '@nestjs/common';
import { loginSchema, registerAccountSchema } from '@knowledge-map/content-schema';
import type { AuthStateView, LoginInput, RegisterAccountInput } from '@knowledge-map/contracts';
import { parseBody } from '../common/request-validation';
import { AuthService, type CookieResponse } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Get('me')
  state(@Headers('cookie') cookie: string | undefined): Promise<AuthStateView> {
    return this.auth.state(cookie);
  }

  @Post('register')
  register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthStateView> {
    return this.auth.register(parseBody<RegisterAccountInput>(registerAccountSchema, body), response);
  }

  @Post('login')
  login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthStateView> {
    return this.auth.login(parseBody<LoginInput>(loginSchema, body), response);
  }

  @Post('logout')
  logout(
    @Headers('cookie') cookie: string | undefined,
    @Res({ passthrough: true }) response: CookieResponse,
  ): Promise<AuthStateView> {
    return this.auth.logout(cookie, response);
  }
}
