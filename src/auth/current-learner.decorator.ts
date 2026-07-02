import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentLearner } from './current-learner.type';

export const CurrentLearnerDecorator = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentLearner => {
    const request = ctx.switchToHttp().getRequest<{ user: CurrentLearner }>();
    return request.user;
  },
);
