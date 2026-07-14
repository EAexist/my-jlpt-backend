import { Test, TestingModule } from '@nestjs/testing';
import { GrammarExampleService } from './grammar-example.service';
import { PrismaModule } from '../../prisma/prisma.module';

describe('GrammarExampleService', () => {
  let service: GrammarExampleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [GrammarExampleService],
    }).compile();

    service = module.get<GrammarExampleService>(GrammarExampleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
