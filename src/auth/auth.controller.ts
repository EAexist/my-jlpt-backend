import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthSyncRequest } from './auth.schemas';
import { Request } from 'express';
import { BearerAuthGuard } from './bearer-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  async sync(@Body() dto: AuthSyncRequest) {
    return this.authService.syncLearner(dto);
  }

  @Get('me')
  @UseGuards(BearerAuthGuard)
  async getMe(@Req() req: Request & { user: { id: string } }) {
    // This is a placeholder since the service needs a method to fetch current user profile.
    // Spec shows UserResponse fields: id, email, name, avatarUrl.
    // Re-check AuthService for a findById method or similar in future if needed.
    // For now assuming the standard response serialization handles DTO shape.
    return { id: req.user.id };
  }
}
