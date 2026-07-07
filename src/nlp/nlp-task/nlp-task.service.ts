import { Injectable } from '@nestjs/common';
import { CloudTasksClient } from '@google-cloud/tasks';

@Injectable()
export class NlpTaskService {
  private client: CloudTasksClient;

  constructor() {
    this.client = new CloudTasksClient();
  }

  async dispatchNlpTask(payload: any) {
    // Basic Cloud Tasks dispatch implementation
    const parent = this.client.queuePath(
      process.env.GCP_PROJECT_ID!,
      process.env.GCP_LOCATION!,
      process.env.GCP_QUEUE_NAME!,
    );
    await this.client.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: process.env.NLP_WORKER_URL!,
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        },
      },
    });
  }
}
