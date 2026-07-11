import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    // No-op for global setup
  });

  it('should sync learner and create default group if not exists', async () => {
    const mockLearner = { id: 'uuid-1', provider: 'google', providerAccountId: 'acc-1' };
    const mockPrisma = {
      $transaction: vi.fn(),
      learner: { upsert: vi.fn().mockResolvedValue(mockLearner) },
      group: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'group-uuid' }),
      },
    };

    // Need to handle the $transaction callback
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));

    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    const service = module.get<AuthService>(AuthService);

    const result = await service.syncLearner({
      provider: 'google',
      providerAccountId: 'acc-1',
      email: 'test@example.com',
    } as any);

    expect(result).toEqual(mockLearner);
    expect(mockPrisma.learner.upsert).toHaveBeenCalled();
    expect(mockPrisma.group.create).toHaveBeenCalled();
  });
});
