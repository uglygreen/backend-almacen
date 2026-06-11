import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

@Injectable()
export class ClientesMobileRateLimitService {
  private readonly entries = new Map<string, RateLimitEntry>();

  consume(input: {
    scope: string;
    key: string | null | undefined;
    limit: number;
    windowSeconds: number;
    message: string;
  }) {
    const keyPart = (input.key ?? '').trim() || 'unknown';
    const limit = Math.max(input.limit, 1);
    const windowSeconds = Math.max(input.windowSeconds, 1);
    const now = Date.now();
    const key = `${input.scope}:${keyPart}`;
    const existing = this.entries.get(key);

    if (!existing || existing.resetAt <= now) {
      this.entries.set(key, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      this.cleanup(now);
      return;
    }

    if (existing.count >= limit) {
      const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);
      throw new HttpException(
        {
          message: input.message,
          retryAfterSeconds,
          limit,
          windowSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
    this.entries.set(key, existing);
    this.cleanup(now);
  }

  private cleanup(now: number) {
    if (this.entries.size < 500) {
      return;
    }

    for (const [key, entry] of this.entries.entries()) {
      if (entry.resetAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}
