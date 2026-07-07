import { Test, TestingModule } from '@nestjs/testing';
import { GrammarExampleService } from './grammar-example.service';

describe('GrammarExampleService', () => {
  let service: GrammarExampleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrammarExampleService],
    }).compile();

    service = module.get<GrammarExampleService>(GrammarExampleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
