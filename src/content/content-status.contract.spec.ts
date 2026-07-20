import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventSource } from 'eventsource';
import { BehaviorSubject } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it, Mock, vi } from 'vitest';
import { JobStatusService } from '../job/job-status/job-status.service';
import { JobModule } from '../job/job.module';
import { NlpModule } from '../nlp/nlp.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { StorageModule } from '../storage/storage.module';
import { ContentModule } from './content.module';

interface Job {
  id: string;
  contentId: string;
  status: string;
  progress: number;
  currentStep: string;
  errorMessage: string | null;
}

interface MockPrismaService {
  content: {
    findUnique: Mock;
  };
}

describe('Content Status (SSE)', () => {
  let app: INestApplication;
  let url: string;
  const mockJob: Job = {
    id: 'job-1',
    contentId: 'content-1',
    status: 'PROCESSING',
    progress: 50,
    currentStep: 'Analyzing',
    errorMessage: null,
  };
  const statusSubject = new BehaviorSubject(mockJob);

  beforeAll(async () => {
    const prismaMock: MockPrismaService = {
      content: {
        findUnique: vi.fn(),
      },
    };

    prismaMock.content.findUnique.mockImplementation(
      ({
        where,
        include,
      }: {
        where: { id: string };
        include?: { processingJob?: boolean };
      }) => {
        if (include?.processingJob) {
          return Promise.resolve({
            id: where.id,
            processingJob: mockJob,
          });
        }
        return Promise.resolve(null);
      },
    );

    const moduleFixture = await Test.createTestingModule({
      imports: [
        PrismaModule,
        StorageModule,
        NlpModule,
        JobModule,
        ContentModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(JobStatusService)
      .useValue({
        getJobStatus: vi.fn().mockReturnValue(statusSubject.asObservable()),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    url = await app.getUrl();
  });

  afterAll(async () => {
    statusSubject.complete();
    await app.close();
  });

  it('should initiate SSE connection', async () => {
    const es = new EventSource(`${url}/content/content-1/status`);
    return new Promise<void>((resolve, reject) => {
      es.onopen = () => {
        es.close();
        resolve();
      };
      es.onerror = (err) => {
        es.close();
        reject(
          err instanceof Error
            ? err
            : new Error(typeof err === 'string' ? err : 'EventSource error'),
        );
      };
    });
  }, 10000);

  it('should stream job status updates in correct shape', async () => {
    const es = new EventSource(`${url}/content/content-1/status`);
    return new Promise<void>((resolve, reject) => {
      es.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data) as unknown;
          expect(data).toMatchObject({
            status: 'PROCESSING',
            progress: 50,
          });
          es.close();
          resolve();
        } catch (err) {
          es.close();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };
      es.onerror = (err) => {
        es.close();
        reject(
          err instanceof Error
            ? err
            : new Error(typeof err === 'string' ? err : 'EventSource error'),
        );
      };
    });
  }, 10000);
});
