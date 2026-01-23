# Migration Notification Endpoint

## Descripción
Endpoint para enviar notificaciones masivas de migración a usuarios, informándoles sobre la nueva página web y solicitándoles que recuperen su contraseña.

## Endpoint

**POST** `/v1/marketing/send-migration-notification`

### Autenticación
- Requiere autenticación JWT
- Solo usuarios con rol `admin` pueden usar este endpoint

### Request Body

```json
{
  "recipients": [
    {
      "email": "usuario1@example.com",
      "name": "Juan Pérez"
    },
    {
      "email": "usuario2@example.com",
      "name": "María González"
    }
  ]
}
```

### Response

```json
{
  "success": 2,
  "failed": 0
}
```

En caso de errores:

```json
{
  "success": 1,
  "failed": 1,
  "errors": [
    "Error enviando a usuario2@example.com: Invalid email address"
  ]
}
```

## Características del Email

El email enviado incluye:
- ✅ Diseño responsive y profesional
- ✅ Notificación sobre la nueva página web
- ✅ Instrucciones paso a paso para recuperar contraseña
- ✅ Botón CTA que lleva a `https://carvajalfit.com/login`
- ✅ Enlace alternativo en texto plano
- ✅ Personalización con el nombre del usuario
- ✅ Branding de Club Carvajal Fit

## Procesamiento

- Los emails se envían en lotes de 10 para evitar rate limits
- Hay una pausa de 1 segundo entre lotes
- Los errores se capturan y reportan sin detener el proceso completo

## Variables de Entorno Requeridas

```env
RESEND_API_KEY=tu_api_key_de_resend
RESEND_FROM_EMAIL=noreply@carvajalfit.com
RESEND_FROM_NAME=Club Carvajal Fit
```

## Ejemplo de Uso con cURL

```bash
curl -X POST http://localhost:3001/v1/marketing/send-migration-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "recipients": [
      {
        "email": "usuario@example.com",
        "name": "Juan Pérez"
      }
    ]
  }'
```

## Ejemplo de Uso con Postman

1. Método: POST
2. URL: `http://localhost:3001/v1/marketing/send-migration-notification`
3. Headers:
   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer YOUR_JWT_TOKEN`
4. Body (raw JSON):
```json
{
  "recipients": [
    {
      "email": "usuario@example.com",
      "name": "Juan Pérez"
    }
  ]
}
```

## Notas

- El endpoint está protegido y solo usuarios administradores pueden usarlo
- Los emails se envían usando Resend API
- El contenido del email está en español y es específico para la migración a la nueva plataforma
