import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

@Injectable()
export class OwnershipService {
  /**
   * Ensures that a resource owned by a learner exists and belongs to the current learner.
   *
   * @param resource - The resource to check (should have an `ownerId` or `learnerId`)
   * @param currentLearnerId - The ID of the authenticated learner
   * @param resourceName - Name of the resource for error messages
   * @throws NotFoundException if resource is null or undefined
   * @throws ForbiddenException if resource does not belong to the learner
   */
  ensureOwnership<T extends { learnerId?: string; userId?: string }>(
    resource: T | null | undefined,
    currentLearnerId: string,
    resourceName: string,
  ): asserts resource is T {
    if (!resource) {
      throw new NotFoundException(`${resourceName} not found.`);
    }

    const ownerId = resource.learnerId || resource.userId;
    if (ownerId !== currentLearnerId) {
      throw new ForbiddenException(
        `You do not have permission to access this ${resourceName}.`,
      );
    }
  }
}
