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
PORT=3001

# Configuración CORS (opcional)
# En desarrollo: true o dejar vacío para permitir todos los orígenes
# En producción: especificar el dominio del frontend, ej: https://tu-dominio.com
CORS_ORIGIN=

# URL de tu aplicación (usada para callbacks de Mercado Pago)
# Desarrollo: https://carvajalfit.fydeli.com
# Producción: https://tu-dominio.com
APP_URL=https://carvajalfit.fydeli.com

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

# ============================================
# CONFIGURACIÓN WEBPAY (TRANSBANK)
# ============================================
# Código de comercio de WebPay (para integración/testing)
# Obtén tus credenciales en: https://www.transbankdevelopers.cl/documentacion/como_empezar
WEBPAY_COMMERCE_CODE_TEST=597055555532

# API Key de WebPay (para integración/testing)
WEBPAY_API_KEY_TEST=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C

# Código de comercio de WebPay (para producción)
# IMPORTANTE: Usa las credenciales de producción solo en producción
WEBPAY_COMMERCE_CODE=tu_codigo_comercio_produccion

# API Key de WebPay (para producción)
# IMPORTANTE: Usa la API key de producción solo en producción
WEBPAY_API_KEY=tu_api_key_produccion

# ============================================
# CONFIGURACIÓN PAYPAL
# ============================================
# Client ID de PayPal (para sandbox/pruebas)
# Obtén tus credenciales en: https://developer.paypal.com/dashboard/applications/sandbox
PAYPAL_CLIENT_ID_SANDBOX=tu_client_id_sandbox

# Client Secret de PayPal (para sandbox/pruebas)
PAYPAL_CLIENT_SECRET_SANDBOX=tu_client_secret_sandbox

# Client ID de PayPal (para producción)
# IMPORTANTE: Usa las credenciales de producción solo en producción
PAYPAL_CLIENT_ID=tu_client_id_produccion

# Client Secret de PayPal (para producción)
# IMPORTANTE: Usa el secret de producción solo en producción
PAYPAL_CLIENT_SECRET=tu_client_secret_produccion

# NOTA: PayPal siempre requiere precios en USD
# Asegúrate de que tus planes tengan precios configurados en USD
# para poder usar PayPal como método de pago

# ============================================
# CONFIGURACIÓN RESEND (EMAIL MARKETING)
# ============================================
# API Key de Resend para envío de emails
# Obtén tu API key en: https://resend.com/api-keys
# IMPORTANTE: Usa la API key de producción en producción
RESEND_API_KEY=re_123456789abcdefghijklmnopqrstuvwxyz

# Email desde el cual se enviarán los correos (debe estar verificado en Resend)
# Formato: email@dominio.com o Nombre <email@dominio.com>
RESEND_FROM_EMAIL=noreply@carvajalfit.com

# Nombre que aparecerá como remitente (opcional)
RESEND_FROM_NAME=Club Carvajal Fit

# ============================================
# CONFIGURACIÓN LIOREN (FACTURACIÓN ELECTRÓNICA)
# ============================================
# API Key de Lioren para emisión de boletas electrónicas
# Obtén tu API key en: https://www.lioren.cl/docs#/api-intro
# IMPORTANTE: Usa la API key de producción solo en producción
LIOREN_API_KEY=tu_api_key_lioren

# URL de la API de Lioren (opcional, por defecto usa la URL oficial)
# LIOREN_API_URL=https://www.lioren.cl/api

# RUT por defecto para usuarios sin RUT registrado (opcional)
# Solo se usa si el usuario no tiene RUT en su perfil
# LIOREN_DEFAULT_RUT=111111111
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
| `PORT` | Puerto donde corre el servidor | `3001` |
| `CORS_ORIGIN` | Origen permitido para CORS | `https://tu-dominio.com` o vacío |
| `APP_URL` | URL base de tu aplicación | `https://carvajalfit.fydeli.com` |

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

### Resend (Email Marketing)

| Variable | Descripción | Dónde obtenerlo |
|----------|-------------|-----------------|
| `RESEND_API_KEY` | API Key de Resend para envío de emails | [Resend API Keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | Email desde el cual se enviarán los correos | Debe estar verificado en Resend |
| `RESEND_FROM_NAME` | Nombre del remitente (opcional) | Cualquier nombre descriptivo |

### Lioren (Facturación Electrónica)

| Variable | Descripción | Dónde obtenerlo |
|----------|-------------|-----------------|
| `LIOREN_API_KEY` | API Key de Lioren para emisión de boletas | [Documentación Lioren](https://www.lioren.cl/docs#/api-intro) |
| `LIOREN_API_URL` | URL de la API de Lioren (opcional) | Por defecto: `https://www.lioren.cl/api` |
| `LIOREN_DEFAULT_RUT` | RUT por defecto si el usuario no tiene RUT (opcional) | Solo para casos especiales |

**📌 Notas**:
- El email en `RESEND_FROM_EMAIL` debe estar verificado en tu cuenta de Resend
- Puedes verificar dominios en: https://resend.com/domains
- En desarrollo, puedes usar el dominio de prueba de Resend

### Lioren (Facturación Electrónica)

**📌 Notas**:
- La API de Lioren se usa para generar boletas electrónicas automáticamente cuando se confirma un pago
- Las boletas se envían adjuntas en el correo de bienvenida
- El RUT del usuario se obtiene del metadata del pago o suscripción
- Si el usuario no tiene RUT, se usa el valor de `LIOREN_DEFAULT_RUT` o un RUT genérico
- **IMPORTANTE**: En producción, asegúrate de capturar el RUT del usuario durante el registro o checkout

## 🚀 Cómo Obtener el Token de Mercado Pago

1. Ve a [Mercado Pago Developers](https://www.mercadopago.com/developers)
2. Inicia sesión con tu cuenta
3. Ve a **Tus integraciones** → Selecciona tu aplicación
4. En la sección **Credenciales**, encontrarás:
   - **Access Token de TEST** (para desarrollo)
   - **Access Token de PRODUCCIÓN** (para producción)
5. Copia el token correspondiente y pégalo en `MERCADOPAGO_ACCESS_TOKEN`

## 📧 Cómo Configurar Resend para Email Marketing

1. Ve a [Resend](https://resend.com) y crea una cuenta
2. Ve a **API Keys** en el panel de control
3. Crea una nueva API Key y cópiala en `RESEND_API_KEY`
4. Verifica tu dominio o usa el dominio de prueba de Resend
5. Configura `RESEND_FROM_EMAIL` con el email verificado
6. (Opcional) Configura `RESEND_FROM_NAME` con el nombre del remitente

**Nota**: En desarrollo, puedes usar el dominio de prueba `onboarding@resend.dev` sin verificación adicional.

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
- [ ] `RESEND_API_KEY` obtenido y configurado
- [ ] `RESEND_FROM_EMAIL` configurado con email verificado
- [ ] `LIOREN_API_KEY` obtenido y configurado (para facturación electrónica)
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

### Error: "RESEND_API_KEY no está configurado"
- Verifica que `RESEND_API_KEY` está en el archivo `.env`
- Asegúrate de que no hay espacios antes o después del signo `=`
- Reinicia el servidor después de agregar/modificar variables de entorno
- Verifica que el email en `RESEND_FROM_EMAIL` está verificado en Resend

### Error: "LIOREN_API_KEY no está configurado"
- Verifica que `LIOREN_API_KEY` está en el archivo `.env`
- Asegúrate de que no hay espacios antes o después del signo `=`
- Reinicia el servidor después de agregar/modificar variables de entorno
- Verifica que tienes una cuenta activa en Lioren y que la API key es válida
- **Nota**: Si no configuras `LIOREN_API_KEY`, las boletas no se generarán pero el sistema seguirá funcionando

