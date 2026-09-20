import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Kutilmagan server xatoligi yuz berdi';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'object' ? (res as any).message || res : res;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[])?.join(', ') || 'nomaʼlum';
        message = `Ma'lumotlar bazasida bunday yozuv mavjud (takroriy maydon: ${target})`;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = `So'ralgan yozuv ma'lumotlar bazasidan topilmadi`;
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = `Bog'langan ma'lumotlar mavjud emas yoki noto'g'ri bog'lanish`;
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Ma'lumotlar bazasi so'rovida xatolik yuz berdi (${exception.code})`;
      }
      this.logger.warn(`Prisma Error [${exception.code}]: ${exception.message}`);
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
      message = exception.message;
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
