import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Pagination } from './content-management.schemas';

@Injectable()
export class ContentManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async findPaginatedContentByGroup(groupId: string, { page, limit }: Pagination) {
    const skip = (page - 1) * limit;
    return await this.prisma.content.findMany({
      where: { groupId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}
