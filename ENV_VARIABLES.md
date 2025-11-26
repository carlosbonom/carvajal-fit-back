# 🔐 Variables de Entorno - Backend

Este documento lista todas las variables de entorno necesarias para el backend.

## 📋 Archivo .env

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# ============================================
# CONFIGURACIÓN DE BASE DE DATOS
# ============================================
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=carvajal_fit
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# ============================================
# CONFIGURACIÓN DE TYPORM
# ============================================
# true para sincronizar automáticamente las tablas (solo desarrollo)
# false para producción (usar migraciones)
TYPEORM_SYNC=false
# true para ver logs de queries SQL (útil para debugging)
TYPEORM_LOG=false

# ============================================
# CONFIGURACIÓN DEL SERVIDOR
# ============================================
PORT=3000

# Configuración CORS (opcional)
# En desarrollo: true o dejar vacío para permitir todos los orígenes
# En producción: especificar el dominio del frontend, ej: https://tu-dominio.com
CORS_ORIGIN=

# URL de tu aplicación (usada para callbacks de Mercado Pago)
# Desarrollo: http://localhost:3000
# Producción: https://tu-dominio.com
APP_URL=http://localhost:3000

# ============================================
# CONFIGURACIÓN JWT (AUTENTICACIÓN)
# ============================================
# Secret para firmar los access tokens
# IMPORTANTE: Cambia esto en producción por una clave segura y única
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Tiempo de expiración del access token (formato: 15m, 1h, 7d, etc.)
JWT_EXPIRATION=15m

# Secret para firmar los refresh tokens
# IMPORTANTE: Debe ser diferente de JWT_SECRET y cambiar en producción
JWT_REFRESH_SECRET=your-super-secret-refresh-jwt-key-change-this-in-production

# Tiempo de expiración del refresh token (formato: 7d, 30d, etc.)
JWT_REFRESH_EXPIRATION=7d

# ============================================
# CONFIGURACIÓN MERCADO PAGO
# ============================================
# Access Token de Mercado Pago
# Obtén tu token en: https://www.mercadopago.com/developers/panel/credentials
# IMPORTANTE: Usa el token de producción en producción y el de test en desarrollo
MERCADOPAGO_ACCESS_TOKEN=TEST-1234567890123456-123456-abcdefghijklmnopqrstuvwxyz-123456789
```

## 📝 Descripción de Variables

### Base de Datos

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_HOST` | Host de PostgreSQL | `localhost` |
| `DATABASE_PORT` | Puerto de PostgreSQL | `5432` |
| `DATABASE_NAME` | Nombre de la base de datos | `carvajal_fit` |
| `DATABASE_USER` | Usuario de PostgreSQL | `postgres` |
| `DATABASE_PASSWORD` | Contraseña de PostgreSQL | `tu_password` |

### TypeORM

| Variable | Descripción | Valores |
|----------|-------------|---------|
| `TYPEORM_SYNC` | Sincronizar tablas automáticamente | `true` / `false` |
| `TYPEORM_LOG` | Mostrar logs de queries SQL | `true` / `false` |

**⚠️ IMPORTANTE**: En producción, `TYPEORM_SYNC` debe ser `false`. Usa migraciones en su lugar.

### Servidor

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto donde corre el servidor | `3000` |
| `CORS_ORIGIN` | Origen permitido para CORS | `https://tu-dominio.com` o vacío |
| `APP_URL` | URL base de tu aplicación | `http://localhost:3000` |

### JWT (Autenticación)

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `JWT_SECRET` | Clave secreta para firmar access tokens | `tu-clave-secreta-super-segura` |
| `JWT_EXPIRATION` | Tiempo de expiración del access token | `15m`, `1h`, `7d` |
| `JWT_REFRESH_SECRET` | Clave secreta para firmar refresh tokens | `tu-clave-secreta-refresh` |
| `JWT_REFRESH_EXPIRATION` | Tiempo de expiración del refresh token | `7d`, `30d` |

**🔒 SEGURIDAD**: 
- Genera claves seguras usando: `openssl rand -base64 32`
- Nunca uses las mismas claves en desarrollo y producción
- `JWT_SECRET` y `JWT_REFRESH_SECRET` deben ser diferentes

### Mercado Pago

| Variable | Descripción | Dónde obtenerlo |
|----------|-------------|-----------------|
| `MERCADOPAGO_ACCESS_TOKEN` | Token de acceso de Mercado Pago | [Panel de Desarrolladores](https://www.mercadopago.com/developers/panel/credentials) |

**📌 Notas**:
- Usa el token de **TEST** para desarrollo
- Usa el token de **PRODUCCIÓN** para producción
- Los tokens son diferentes y no son intercambiables

## 🚀 Cómo Obtener el Token de Mercado Pago

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com/developers)
2. Inicia sesión con tu cuenta
3. Ve a **Tus integraciones** → Selecciona tu aplicación
4. En la sección **Credenciales**, encontrarás:
   - **Access Token de TEST** (para desarrollo)
   - **Access Token de PRODUCCIÓN** (para producción)
5. Copia el token correspondiente y pégalo en `MERCADOPAGO_ACCESS_TOKEN`

## ⚠️ Importante

1. **NUNCA** subas el archivo `.env` al repositorio (ya está en `.gitignore`)
2. En producción, usa variables de entorno del servidor o un gestor de secretos
3. Los tokens de Mercado Pago tienen diferentes valores para test y producción
4. Genera `JWT_SECRET` y `JWT_REFRESH_SECRET` seguros antes de ir a producción

## 🔧 Generar Claves Secretas Seguras

### En Linux/Mac:
```bash
openssl rand -base64 32
```

### En Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### Online:
Puedes usar generadores online como: https://randomkeygen.com/

## ✅ Checklist de Configuración

- [ ] Archivo `.env` creado en la raíz del proyecto
- [ ] Variables de base de datos configuradas
- [ ] `JWT_SECRET` y `JWT_REFRESH_SECRET` generados y configurados
- [ ] `MERCADOPAGO_ACCESS_TOKEN` obtenido y configurado
- [ ] `APP_URL` configurado según el entorno (desarrollo/producción)
- [ ] `TYPEORM_SYNC=false` para producción
- [ ] Archivo `.env` está en `.gitignore` (verificado)

## 🆘 Solución de Problemas

### Error: "MERCADOPAGO_ACCESS_TOKEN no está configurado"
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Verifica que la variable `MERCADOPAGO_ACCESS_TOKEN` está escrita correctamente
- Reinicia el servidor después de agregar/modificar variables de entorno

### Error: "JWT_SECRET no está configurado"
- Verifica que `JWT_SECRET` está en el archivo `.env`
- Asegúrate de que no hay espacios antes o después del signo `=`
- Reinicia el servidor

### Error de conexión a la base de datos
- Verifica que PostgreSQL está corriendo
- Verifica las credenciales en `DATABASE_*`
- Verifica que la base de datos existe

