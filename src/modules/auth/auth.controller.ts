import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request, type Response } from 'express';
import { LoginDto } from './dto/login.dto.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';
import { SessionAuthGuard } from '../../common/guards/session-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import {
  AuthenticatedRequest,
  type AuthUser,
} from './interfaces/auth-user.interface.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Authenticate a user and set an HttpOnly session cookie',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'User authenticated successfully. The browser session is maintained through an HttpOnly cookie.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid credentials or inactive account',
  })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    const sessionToken = await this.sessionService.createSession(user);
    this.sessionService.setSessionCookie(response, sessionToken);

    return { user };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Return the current authenticated user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Current user returned from the server-side session',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, invalid, expired, or revoked session',
  })
  me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('session')
  @ApiOperation({ summary: 'Revoke the current session and clear its cookie' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Logout completed. Missing sessions are treated as logged out.',
  })
  async logout(
    @Req() request: Request & Partial<AuthenticatedRequest>,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieValue = this.readCookie(
      request.headers.cookie,
      this.sessionService.getCookieName(),
    );

    if (cookieValue) {
      try {
        const { session } =
          await this.sessionService.validateSessionToken(cookieValue);
        await this.sessionService.invalidateSession(session.id);
      } catch {
        // Logout is intentionally idempotent for missing or already-invalid sessions.
      }
    }

    this.sessionService.clearSessionCookie(response);
    return { success: true };
  }

  private readCookie(cookieHeader: string | undefined, name: string) {
    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
      const [rawName, ...rawValue] = cookie.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rawValue.join('='));
      }
    }

    return undefined;
  }
}
