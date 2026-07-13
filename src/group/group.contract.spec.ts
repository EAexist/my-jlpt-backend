import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GroupModule } from './group.module';
import { GroupService } from './group.service';

describe('GroupController (contract)', () => {
  let app: INestApplication;

  const mockLearner = { id: 'user123' };

  const mockGroupService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    remove: vi.fn(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [GroupModule],
    })
      .overrideProvider(GroupService)
      .useValue(mockGroupService)
      .compile();

    app = moduleRef.createNestApplication();

    // Mock the guard to inject the user
    app.use((req: { user: any }, _res: any, next: () => void) => {
      req.user = mockLearner;
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/POST groups', async () => {
    const newGroup = {
      id: 'group1',
      name: 'New Group',
      ownerId: mockLearner.id,
      isDefault: false,
    };
    mockGroupService.create.mockResolvedValue(newGroup);

    const response = await request(app.getHttpServer())
      .post('/groups')
      .send({ name: 'New Group' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(newGroup);
  });

  it('/GET groups', async () => {
    const groups = [
      {
        id: 'group1',
        name: 'Example',
        ownerId: mockLearner.id,
        isDefault: true,
      },
    ];
    mockGroupService.findAll.mockResolvedValue(groups);

    const response = await request(app.getHttpServer()).get('/groups');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(groups);
  });

  it('/GET groups/:id', async () => {
    const group = {
      id: 'group1',
      name: 'Example',
      ownerId: mockLearner.id,
      isDefault: true,
    };
    mockGroupService.findOne.mockResolvedValue(group);

    const response = await request(app.getHttpServer()).get('/groups/group1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(group);
  });

  it('/DELETE groups/:id', async () => {
    mockGroupService.remove.mockResolvedValue({ success: true });

    const response = await request(app.getHttpServer()).delete(
      '/groups/group1',
    );
    expect(response.status).toBe(204);
  });
});
