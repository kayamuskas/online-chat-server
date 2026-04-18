import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const MAX_BUCKETS_BEFORE_PRUNE = 1_000;

interface RequestLike {
  method?: string;
  baseUrl?: string;
  path?: string;
  route?: {
    path?: string;
  };
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket: {
    remoteAddress?: string;
  };
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<RequestLike>();
    const routeKey = `${request.method}:${request.baseUrl}${request.route?.path ?? request.path}`;
    const bucketKey = `${routeKey}:${this.getClientKey(request)}`;
    const now = Date.now();

    this.pruneExpiredBuckets(now);

    const current = this.buckets.get(bucketKey);
    if (!current || current.resetAt <= now) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return true;
    }

    if (current.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        'too many authentication attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    return true;
  }

  private getClientKey(request: RequestLike): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim() !== '') {
      return forwardedFor.split(',')[0].trim();
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private pruneExpiredBuckets(now: number): void {
    if (this.buckets.size < MAX_BUCKETS_BEFORE_PRUNE) {
      return;
    }

    for (const [key, value] of this.buckets.entries()) {
      if (value.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
