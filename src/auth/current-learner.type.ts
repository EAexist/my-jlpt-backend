import { Learner } from '../generated/prisma';

export type CurrentLearner = Omit<Learner, 'createdAt' | 'updatedAt'>;
