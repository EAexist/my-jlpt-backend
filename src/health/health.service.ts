import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  get() {
    return `This action returns all health`;
  }
}
