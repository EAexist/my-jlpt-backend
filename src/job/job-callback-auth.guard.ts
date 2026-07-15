import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { Request } from 'express';

@Injectable()
export class JobCallbackAuthGuard implements CanActivate {
  private readonly oAuth2Client = new OAuth2Client();
  private readonly expectedAudience = process.env.APP_URL; // Using App URL as audience

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.split(' ')[1];

    try {
      const ticket = await this.oAuth2Client.verifyIdToken({
        idToken: token,
        audience: this.expectedAudience,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid token payload');
      }

      // Optionally verify service account email here if needed:
      // if (payload.email !== process.env.NLP_WORKER_SERVICE_ACCOUNT) { ... }

      (request as any).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token verification failed');
    }
  }
}
