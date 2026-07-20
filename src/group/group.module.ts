import { Module } from '@nestjs/common';
import { GroupService } from './group.service';
import { GroupController } from './group.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [PrismaModule, ContentModule],
  controllers: [GroupController],
  providers: [GroupService],
})
export class GroupModule {}
