import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

import { BearerAuthGuard } from './bearer-auth.guard';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, BearerAuthGuard],
  exports: [AuthService, BearerAuthGuard],
})
export class AuthModule {}
