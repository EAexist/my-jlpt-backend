import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupService } from './group.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GroupService', () => {
  let service: GroupService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: PrismaService,
          useValue: {
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
          },
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    prisma = module.get<PrismaService>(PrismaService);
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const createMock = vi.mocked(prisma.group.create);
      createMock.mockResolvedValue(createdGroup);

      const result = await service.create(ownerId, data);
      expect(createMock).toHaveBeenCalledWith({
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const findManyMock = vi.mocked(prisma.group.findMany);
      findManyMock.mockResolvedValue(groups);

      const result = await service.findAll(ownerId);
      expect(findManyMock).toHaveBeenCalledWith({
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
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const findFirstOrThrowMock = vi.mocked(prisma.group.findFirstOrThrow);
      findFirstOrThrowMock.mockResolvedValue({
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

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const findFirstOrThrowMock = vi.mocked(prisma.group.findFirstOrThrow);
      findFirstOrThrowMock
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

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const transactionMock = vi.mocked(prisma.$transaction);

      await service.remove(ownerId, groupId);

      expect(transactionMock).toHaveBeenCalled();
    });
  });
});
