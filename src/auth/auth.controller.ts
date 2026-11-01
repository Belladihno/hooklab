import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../common/access/access.decorators.js';
import { REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { clearAuthCookies, CookieTtls, setAuthCookies } from './cookies.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UserResponseDto } from './dto/response/user.response.dto.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Public()
  register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    return this.auth.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const result = await this.auth.login(
      dto,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );

    setAuthCookies(res, result.tokens, this.cookieTtls());

    return result.user;
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserResponseDto> {
    const result = await this.auth.refresh(
      request.cookies?.[REFRESH_TOKEN_COOKIE],
    );

    setAuthCookies(res, result.tokens, this.cookieTtls());

    return result.user;
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[REFRESH_TOKEN_COOKIE]);
    clearAuthCookies(res, this.cookieTtls().isProduction);
  }

  private cookieTtls(): CookieTtls {
    return {
      accessTtlSeconds:
        this.config.get<number>('JWT_ACCESS_TTL_SECONDS') ?? 900,
      refreshAbsoluteTtlSeconds:
        this.config.get<number>('REFRESH_ABSOLUTE_TTL_SECONDS') ?? 2_592_000,
      isProduction: this.config.get<string>('NODE_ENV') === 'production',
    };
  }
}
