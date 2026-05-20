import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

export type AuthTokenPayload = {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
};

export type AuthenticatedRequest = Request & {
  user: AuthTokenPayload;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Optional() private readonly jwtService?: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.hasValidApiKey(request)) {
      request.user = {
        sub: 0,
        email: 'n8n@internal',
      };
      return true;
    }

    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    if (!this.jwtService) {
      throw new UnauthorizedException('Authentication service unavailable');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private hasValidApiKey(request: Request): boolean {
    const expectedApiKey = process.env.API_KEY?.trim();
    const providedApiKey = request.headers['x-api-key'];
    const value = Array.isArray(providedApiKey)
      ? providedApiKey[0]
      : providedApiKey;

    return Boolean(expectedApiKey && value && value === expectedApiKey);
  }
}
