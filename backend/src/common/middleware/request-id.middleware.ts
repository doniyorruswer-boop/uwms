import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const rawId = req.headers['x-request-id'] || req.headers['request-id'];
    const requestId =
      typeof rawId === 'string' && rawId.trim()
        ? rawId.trim()
        : crypto.randomUUID();

    (req as any).id = requestId;
    (req as any).requestId = requestId;

    res.setHeader('X-Request-Id', requestId);
    next();
  }
}
