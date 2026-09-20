import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const authenticatedUser = super.handleRequest(err, user, info, context);

    if (authenticatedUser && authenticatedUser.mustChangePassword) {
      const request = context.switchToHttp().getRequest();
      const url = request.originalUrl || request.url || '';
      const isAllowedRoute =
        url.includes('/api/auth/change-password') ||
        url.includes('/api/auth/logout') ||
        url.includes('/api/auth/me');

      if (!isAllowedRoute) {
        throw new ForbiddenException(
          'Xavfsizlik talabi: Tizimdan to‘liq foydalanishdan oldin parolingizni o‘zgartirishingiz shart!',
        );
      }
    }

    return authenticatedUser;
  }
}
