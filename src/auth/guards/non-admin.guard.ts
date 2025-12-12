import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../database/entities/users.entity';

@Injectable()
export class NonAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Los administradores no pueden acceder a este endpoint');
    }

    return true;
  }
}

