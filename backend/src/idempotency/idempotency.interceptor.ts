import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import * as crypto from 'crypto';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const method = req.method?.toUpperCase();
    if (!['POST', 'PATCH', 'PUT'].includes(method)) {
      return next.handle();
    }

    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return next.handle();
    }

    const clientKey = rawKey.trim();
    // Xavfsizlik: Idempotency kaliti autentifikatsiyadan o‘tgan foydalanuvchiga bog‘lanadi (Cross-user data leakage oldini olish)
    const scopedKey = req.user?.id ? `${req.user.id}:${clientKey}` : clientKey;
    const reqPath = req.originalUrl || req.url || '';

    return from(this.idempotencyService.get(scopedKey)).pipe(
      switchMap((cached) => {
        if (cached) {
          this.logger.log(`Idempotency HIT for key: ${clientKey} [${method} ${reqPath}]`);
          res.setHeader('Idempotent-Replay', 'true');
          res.setHeader('X-Idempotency-Key', clientKey);
          if (res.status && typeof res.status === 'function') {
            res.status(cached.statusCode);
          }
          return of(cached.data);
        }

        return next.handle().pipe(
          tap({
            next: async (data) => {
              const statusCode = res.statusCode || 200;
              // Faqat muvaffaqiyatli 2xx javoblarni saqlash
              if (statusCode >= 200 && statusCode < 300) {
                await this.idempotencyService.save(
                  scopedKey,
                  reqPath,
                  statusCode,
                  data,
                );
              }
            },
          }),
        );
      }),
    );
  }
}
