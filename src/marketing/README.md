# Módulo de Marketing

Este módulo proporciona un sistema completo de email marketing con plantillas y envío masivo usando Resend.

## 🔐 Características

- Crear, editar y eliminar plantillas de email
- Sistema de variables en plantillas (formato `{{variable}}`)
- Envío masivo de emails con procesamiento en lotes
- Integración con Resend para envío de emails
- Validación de destinatarios

## 📋 Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env`:

```env
RESEND_API_KEY=re_123456789abcdefghijklmnopqrstuvwxyz
RESEND_FROM_EMAIL=noreply@carvajalfit.com
RESEND_FROM_NAME=Club Carvajal Fit
```

## 🚀 Endpoints

### 1. GET /marketing/templates
Obtiene todas las plantillas de email (requiere autenticación).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Bienvenida Nuevos Miembros",
    "subject": "¡Bienvenido al Club Carvajal Fit!",
    "htmlContent": "<h1>¡Hola {{nombre}}!</h1><p>Gracias por unirte...</p>",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### 2. GET /marketing/templates/:id
Obtiene una plantilla específica por ID (requiere autenticación).

### 3. POST /marketing/templates
Crea una nueva plantilla de email (requiere autenticación).

**Request Body:**
```json
{
  "name": "Bienvenida Nuevos Miembros",
  "subject": "¡Bienvenido al Club Carvajal Fit!",
  "htmlContent": "<h1>¡Hola {{nombre}}!</h1><p>Gracias por unirte...</p>"
}
```

### 4. PATCH /marketing/templates/:id
Actualiza una plantilla existente (requiere autenticación).

**Request Body:**
```json
{
  "name": "Nuevo nombre",
  "subject": "Nuevo asunto",
  "htmlContent": "<p>Nuevo contenido</p>"
}
```

### 5. DELETE /marketing/templates/:id
Elimina una plantilla (requiere autenticación).

### 6. POST /marketing/send
Envía emails masivos usando una plantilla (requiere autenticación y rol admin).

**Request Body:**
```json
{
  "templateId": "uuid-de-la-plantilla",
  "recipients": [
    {
      "email": "usuario1@example.com",
      "nombre": "Juan Pérez",
      "campoPersonalizado": "valor"
    },
    {
      "email": "usuario2@example.com",
      "nombre": "María García"
    }
  ],
  "subject": "Asunto personalizado (opcional)"
}
```

**Response (200):**
```json
{
  "success": 2,
  "failed": 0,
  "errors": []
}
```

## 📝 Sistema de Variables

Las plantillas soportan variables usando el formato `{{variable}}`. Las variables se reemplazan con los valores del objeto `recipient`.

**Ejemplo de plantilla:**
```html
<h1>¡Hola {{nombre}}!</h1>
<p>Tu email es: {{email}}</p>
<p>Bienvenido al Club Carvajal Fit.</p>
```

**Datos del destinatario:**
```json
{
  "email": "juan@example.com",
  "nombre": "Juan Pérez"
}
```

**Resultado:**
```html
<h1>¡Hola Juan Pérez!</h1>
<p>Tu email es: juan@example.com</p>
<p>Bienvenido al Club Carvajal Fit.</p>
```

## 🔄 Flujo de Envío

1. **Crear plantilla**: `POST /marketing/templates`
2. **Cargar destinatarios**: Desde Excel o manualmente
3. **Enviar emails**: `POST /marketing/send`
4. **Procesamiento**: Los emails se procesan en lotes de 10 para evitar rate limits
5. **Resultado**: Se retorna el número de emails exitosos y fallidos

## ⚙️ Configuración de Resend

1. Crea una cuenta en [Resend](https://resend.com)
2. Obtén tu API Key desde el panel de control
3. Verifica tu dominio o usa el dominio de prueba
4. Configura las variables de entorno

**Nota**: En desarrollo, puedes usar `onboarding@resend.dev` como email de prueba.

## 🛠️ Migración de Base de Datos

Ejecuta el script SQL para crear la tabla:

```bash
psql -U postgres -d carvajal_fit -f migration_create_email_templates.sql
```

O si usas TypeORM con `TYPEORM_SYNC=true`, la tabla se creará automáticamente.

## 🔒 Seguridad

- Todos los endpoints requieren autenticación JWT
- Solo usuarios con rol `admin` pueden enviar emails masivos
- Los emails se validan antes de enviar
- Los errores se registran pero no exponen información sensible

## 📊 Límites y Consideraciones

- Los emails se procesan en lotes de 10 para evitar rate limits de Resend
- Hay una pausa de 1 segundo entre lotes
- Resend tiene límites según tu plan (100 emails/día en plan gratuito)
- Los errores se capturan y reportan individualmente

## 🆘 Solución de Problemas

### Error: "RESEND_API_KEY no está configurado"
- Verifica que `RESEND_API_KEY` está en el archivo `.env`
- Reinicia el servidor después de agregar la variable

### Error: "Email no verificado"
- Verifica que el email en `RESEND_FROM_EMAIL` está verificado en Resend
- En desarrollo, usa `onboarding@resend.dev`

### Error: "Rate limit exceeded"
- Reduce el tamaño de los lotes en `marketing.service.ts`
- Aumenta el tiempo de pausa entre lotes
- Considera actualizar tu plan de Resend


