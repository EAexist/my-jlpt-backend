import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthSyncRequest } from './auth.schemas';

@Injectable()
export class AuthService {
    constructor(private prisma: PrismaService) { }

    async syncLearner(dto: AuthSyncRequest) {
        const learner = await this.prisma.$transaction(async (tx) => {
            const l = await tx.learner.upsert({
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
                    ownerId: l.id,
                    isDefault: true,
                },
            });

            if (!defaultGroupExists) {
                await tx.group.create({
                    data: {
                        ownerId: l.id,
                        name: 'My Workspace',
                        isDefault: true,
                    },
                });
            }

            return l;
        });

        return learner;
    }
}
