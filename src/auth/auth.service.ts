// https://www.prisma.io/docs/guides/frameworks/nestjs#4-create-user-and-post-services
import { Injectable } from '@nestjs/common';
import { Learner } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSyncRequest } from './auth.schemas';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async syncLearner(dto: AuthSyncRequest): Promise<Learner> {
    return this.prisma.$transaction(async (tx) => {
      const learner: Learner = await tx.learner.upsert({
        where: {
          provider_providerAccountId: {
            provider: dto.provider,
            providerAccountId: dto.providerAccountId,
          },
        },
        update: {
          email: dto.email,
          name: dto.name,
          avatarUrl: dto.image,
        },
        create: {
          provider: dto.provider,
          providerAccountId: dto.providerAccountId,
          email: dto.email,
          name: dto.name,
          avatarUrl: dto.image,
        },
      });

      const defaultGroupExists = await tx.group.findFirst({
        where: {
          ownerId: learner.id,
          isDefault: true,
        },
      });

      if (!defaultGroupExists) {
        await tx.group.create({
          data: {
            ownerId: learner.id,
            name: 'My Workspace',
            isDefault: true,
          },
        });
      }

      return learner;
    });
  }
}
