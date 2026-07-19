import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { GroupService } from './group.service';

interface MockPrismaService {
  group: {
    create: Mock;
    findMany: Mock;
    findFirstOrThrow: Mock;
    delete: Mock;
  };
  content: {
    updateMany: Mock;
  };
  $transaction: Mock;
}

describe('GroupService', () => {
  let service: GroupService;
  let prismaMock: MockPrismaService;

  beforeEach(async () => {
    prismaMock = {
      group: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirstOrThrow: vi.fn(),
        delete: vi.fn(),
      },
      content: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a non-default group for the owner', async () => {
      const ownerId = 'owner-1';
      const data = { name: 'New Group' };
      const createdGroup = {
        id: 'group-1',
        ...data,
        ownerId,
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.group.create.mockResolvedValue(createdGroup);

      const result = await service.create(ownerId, data);
      expect(prismaMock.group.create).toHaveBeenCalledWith({
        data: { name: data.name, ownerId, isDefault: false },
      });
      expect(result).toEqual(createdGroup);
    });
  });

  describe('findAll', () => {
    it('should return groups for the owner', async () => {
      const ownerId = 'owner-1';
      const groups = [
        {
          id: 'group-1',
          name: 'Default',
          ownerId,
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prismaMock.group.findMany.mockResolvedValue(groups);

      const result = await service.findAll(ownerId);
      expect(prismaMock.group.findMany).toHaveBeenCalledWith({
        where: { ownerId },
        orderBy: { isDefault: 'desc' },
        include: { _count: { select: { contents: true } } },
      });
      expect(result).toEqual(groups);
    });
  });

  describe('remove', () => {
    it('should throw Error if group is default', async () => {
      const ownerId = 'owner-1';
      const groupId = 'group-1';
      prismaMock.group.findFirstOrThrow.mockResolvedValue({
        id: groupId,
        isDefault: true,
        name: 'Default Group',
        ownerId: ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.remove(ownerId, groupId)).rejects.toThrow(
        'Cannot delete default group',
      );
    });

    it('should delete group and reassign content to default group', async () => {
      const ownerId = 'owner-1';
      const groupId = 'group-1';
      const defaultGroupId = 'default-group-id';

      prismaMock.group.findFirstOrThrow
        .mockResolvedValueOnce({
          id: groupId,
          isDefault: false,
          name: 'Group 1',
          ownerId: ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          id: defaultGroupId,
          isDefault: true,
          name: 'Default Group',
          ownerId: ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.remove(ownerId, groupId);

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });
});
