import {
  Controller,
  Post,
  Get,
  Body,
  Delete,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, ChangePasswordDto } from './dto/auth.dto';
import { Public } from '../../common/decorators';
import { CurrentUser } from '../../common/decorators';
import type { Request } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  // Strict rate limit: 5 registrations per minute per IP
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.name, dto.email, dto.password);
  }

  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  // Strict rate limit: 5 login attempts per minute per IP (brute-force protection)
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password, dto.totpCode);
  }

  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({ status: 200, description: 'New token pair returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  // Rate limit: 10 refresh attempts per minute
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string }) {
    return user;
  }

  @ApiOperation({ summary: 'Change the authenticated user password' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or current password incorrect' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  // Rate limit: 3 password change attempts per minute
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @ApiOperation({ summary: 'Logout and invalidate a refresh token' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logged out' };
  }

  @ApiOperation({ summary: 'Logout from all sessions' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'All sessions invalidated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser('id') userId: string) {
    await this.authService.logoutAll(userId);
    return { message: 'All sessions invalidated' };
  }

  @ApiOperation({ summary: 'List active sessions for the current user' })
  @ApiBearerAuth('bearer')
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get('sessions')
  async sessions(@CurrentUser('id') userId: string) {
    return this.authService.getActiveSessions(userId);
  }

  @ApiOperation({ summary: 'Check if this is the first run (no users exist)' })
  @ApiResponse({ status: 200, description: 'First-run status returned' })
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Get('first-run')
  async firstRun() {
    const isFirstRun = await this.authService.isFirstRun();
    return { isFirstRun };
  }
}
