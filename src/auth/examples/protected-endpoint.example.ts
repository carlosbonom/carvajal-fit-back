/**
 * Ejemplo de cómo proteger un endpoint con autenticación JWT
 * 
 * Este archivo muestra ejemplos de uso del sistema de autenticación
 * en controladores de NestJS.
 */

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { User } from '../../database/entities/users.entity';

@Controller('example')
export class ExampleController {
  /**
   * Endpoint protegido - Requiere autenticación JWT
   * 
   * El usuario autenticado se obtiene mediante el decorador @CurrentUser()
   */
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtectedData(@CurrentUser() user: User) {
    return {
      message: 'Este es un endpoint protegido',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint público - No requiere autenticación
   * 
   * Usa el decorador @Public() para hacer la ruta pública
   * (útil cuando el guard JWT está configurado globalmente)
   */
  @Public()
  @Get('public')
  getPublicData() {
    return {
      message: 'Este es un endpoint público',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Endpoint protegido con acceso basado en roles
   * 
   * Puedes agregar lógica adicional para verificar roles
   */
  @Get('admin-only')
  @UseGuards(JwtAuthGuard)
  getAdminData(@CurrentUser() user: User) {
    // Verificar rol del usuario
    if (user.role !== 'admin') {
      throw new Error('Acceso denegado: se requiere rol de administrador');
    }

    return {
      message: 'Datos de administrador',
      user: user,
    };
  }

  /**
   * Endpoint POST protegido
   */
  @Post('create')
  @UseGuards(JwtAuthGuard)
  createSomething(
    @CurrentUser() user: User,
    @Body() data: any,
  ) {
    return {
      message: 'Recurso creado',
      createdBy: user.id,
      data: data,
    };
  }
}

/**
 * Ejemplo de uso en otro módulo:
 * 
 * 1. Importa el AuthModule en tu módulo:
 * 
 * @Module({
 *   imports: [AuthModule],
 *   controllers: [ExampleController],
 * })
 * export class ExampleModule {}
 * 
 * 2. Usa los guards y decoradores en tus controladores
 * 
 * 3. El guard JWT está configurado globalmente, así que todas las rutas
 *    están protegidas por defecto. Usa @Public() para rutas públicas.
 */

