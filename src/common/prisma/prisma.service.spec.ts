import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should connect on module init', async () => {
    const spy = vi.spyOn(service, '$connect').mockResolvedValue(undefined);
    await service.onModuleInit();
    expect(spy).toHaveBeenCalled();
  });

  it('should disconnect on module destroy', async () => {
    const spy = vi.spyOn(service, '$disconnect').mockResolvedValue(undefined);
    await service.onModuleDestroy();
    expect(spy).toHaveBeenCalled();
  });
});
