import { Injectable, NotFoundException } from '@nestjs/common';
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

  async moveContent(contentId: string, groupId: string) {
    return await this.prisma.content.update({
      where: { id: contentId },
      data: { groupId },
    });
  }

  async deleteContent(contentId: string) {
    return await this.prisma.$transaction(async (tx) => {
      await tx.processingJob.deleteMany({
        where: { contentId },
      });
      await tx.section.deleteMany({
        where: { contentId },
      });
      await tx.uploadedFile.deleteMany({
        where: { contentId },
      });
      return await tx.content.delete({
        where: { id: contentId },
      });
    });
  }
}
