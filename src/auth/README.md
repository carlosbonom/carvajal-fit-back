# Módulo de Autenticación

Este módulo proporciona un sistema completo de autenticación con JWT usando NestJS.

## 🔐 Características

- Registro de usuarios con email y contraseña
- Login con email y contraseña
- JWT Access Token (vida corta, 15 minutos por defecto)
- JWT Refresh Token (vida larga, 7 días por defecto)
- Refresh tokens hasheados en base de datos
- Logout que invalida refresh tokens
- Protección de rutas con Guards
- Validaciones con class-validator

## 📋 Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=carvajal_fit
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# TypeORM Configuration
TYPEORM_SYNC=false
TYPEORM_LOG=false

# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production
JWT_REFRESH_EXPIRATION=7d
```

## 🚀 Endpoints

### POST /auth/register
Registra un nuevo usuario.

**Request Body:**
```json
{
  "email": "usuario@example.com",
  "password": "password123",
  "name": "Juan Pérez" // opcional
}
```

**Response (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /auth/login
Inicia sesión con email y contraseña.

**Request Body:**
```json
{
  "email": "usuario@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### POST /auth/logout
Cierra sesión e invalida el refresh token.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

### POST /auth/refresh
Renueva el access token usando el refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### GET /auth/me
Obtiene los datos del usuario autenticado.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response (200):**
```json
{
  "id": "uuid-del-usuario",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "role": "customer",
  "status": "active",
  "emailVerified": false,
  "preferredCurrency": "CLP",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastLoginAt": "2024-01-01T00:00:00.000Z"
}
```

## 🛡️ Proteger Endpoints

Para proteger un endpoint, usa el decorador `@UseGuards(JwtAuthGuard)`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('protected')
export class ProtectedController {
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: User) {
    return {
      message: `Hola ${user.name}, estás autenticado!`,
      user: user,
    };
  }
}
```

### Rutas Públicas

Si necesitas hacer una ruta pública (por ejemplo, en el AuthController), usa el decorador `@Public()`:

```typescript
import { Public } from '../auth/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // Esta ruta es pública, no requiere autenticación
  }
}
```

## 🔒 Seguridad

- Las contraseñas se hashean con bcrypt (10 salt rounds)
- Los refresh tokens se hashean antes de guardarse en la base de datos
- Los tokens nunca se guardan en texto plano
- Los tokens se envían por JSON (no cookies)
- Validación automática de DTOs con class-validator
- El guard JWT está configurado globalmente, todas las rutas están protegidas por defecto

## ⚠️ Manejo de Errores

El módulo lanza las siguientes excepciones:

- `ConflictException`: Email ya registrado
- `UnauthorizedException`: Credenciales inválidas, token inválido, usuario inactivo
- `BadRequestException`: Datos de entrada inválidos (manejado por ValidationPipe)
- `NotFoundException`: Usuario no encontrado

## 📝 Notas

- El Access Token expira en 15 minutos por defecto
- El Refresh Token expira en 7 días por defecto
- Los tiempos de expiración se configuran en las variables de entorno
- El guard JWT está configurado globalmente, usa `@Public()` para rutas públicas

