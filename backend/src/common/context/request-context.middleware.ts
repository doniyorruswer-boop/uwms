import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const forwarded = req.headers['x-forwarded-for'];
    let clientIp: string | undefined = undefined;

    if (typeof forwarded === 'string') {
      clientIp = forwarded.split(',')[0].trim();
    } else if (Array.isArray(forwarded) && forwarded.length > 0) {
      clientIp = forwarded[0].trim();
    } else {
      clientIp = (req.ip || req.socket?.remoteAddress || '').replace('::ffff:', '');
    }

    const userAgent = req.headers['user-agent'] || undefined;

    RequestContext.run(
      {
        clientIp: clientIp || undefined,
        userAgent,
      },
      () => {
        next();
      },
    );
  }
}
