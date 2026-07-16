import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { ProcessingJob } from '../../generated/prisma';

@Injectable()
export class JobStatusService implements OnModuleDestroy {
  private registry = new Map<string, BehaviorSubject<ProcessingJob>>();

  getJobStatus(job: ProcessingJob): Observable<ProcessingJob> {
    if (!this.registry.has(job.id)) {
      this.registry.set(job.id, new BehaviorSubject<ProcessingJob>(job));
    }
    return this.registry.get(job.id)!.asObservable();
  }

  updateJobStatus(job: ProcessingJob) {
    const subject = this.registry.get(job.id);
    if (!subject) return;

    subject.next(job);

    if (['COMPLETED', 'FAILED'].includes(job.status.toString())) {
      subject.complete();
      this.registry.delete(job.id);
    }
  }

  onModuleDestroy() {
    for (const subject of this.registry.values()) {
      subject.complete();
    }
    this.registry.clear();
  }
}
