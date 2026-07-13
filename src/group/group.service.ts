import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupService {
  constructor(private prisma: PrismaService) {}

  async create(ownerId: string, data: { name: string }) {
    return this.prisma.group.create({
      data: {
        name: data.name,
        ownerId,
        isDefault: false,
      },
    });
  }

  async findAll(ownerId: string) {
    return this.prisma.group.findMany({
      where: { ownerId },
      orderBy: { isDefault: 'desc' },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });
  }

  async findOne(ownerId: string, id: string) {
    return this.prisma.group.findFirstOrThrow({
      where: { id, ownerId },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });
  }

  async remove(ownerId: string, id: string) {
    const group = await this.prisma.group.findFirstOrThrow({
      where: { id, ownerId },
    });

    if (group.isDefault) {
      throw new Error('Cannot delete default group');
    }

    const defaultGroup = await this.prisma.group.findFirstOrThrow({
      where: { ownerId, isDefault: true },
    });

    await this.prisma.$transaction([
      this.prisma.content.updateMany({
        where: { groupId: group.id },
        data: { groupId: defaultGroup.id },
      }),
      this.prisma.group.delete({ where: { id: group.id } }),
    ]);

    return { success: true };
  }

  async findContents(
    ownerId: string,
    groupId: string,
    page: number,
    limit: number,
  ) {
    // Validate group ownership
    await this.prisma.group.findFirstOrThrow({
      where: { id: groupId, ownerId },
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.content.findMany({
        where: { groupId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.content.count({ where: { groupId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }
}
