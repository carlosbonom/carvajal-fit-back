# 🚀 Endpoint de Migración - Envío Automático a Suscriptores Activos

## ⭐ Nuevo Endpoint Recomendado

### POST `/v1/marketing/send-migration-notification-to-active-subscribers`

Este es el endpoint **más fácil y recomendado** para enviar notificaciones de migración.

#### ✨ Características

- ✅ **Automático**: No necesitas proporcionar lista de emails
- ✅ **Inteligente**: Consulta automáticamente la base de datos
- ✅ **Seguro**: Solo envía a usuarios con suscripción activa
- ✅ **Sin duplicados**: Elimina usuarios duplicados automáticamente
- ✅ **Estadísticas completas**: Retorna información detallada del envío

#### 📋 Uso

**Request:**
```bash
POST /v1/marketing/send-migration-notification-to-active-subscribers
Authorization: Bearer YOUR_JWT_TOKEN
```

**No requiere body** - ¡Así de simple!

**Response:**
```json
{
  "success": 45,
  "failed": 0,
  "totalActiveSubscribers": 45
}
```

#### 🔍 Previsualización de Destinatarios

Antes de enviar, puedes ver quiénes recibirán el correo con este endpoint:

**GET** `/v1/marketing/preview-migration-notification-recipients`

**Response:**
```json
[
  {
    "email": "usuario1@example.com",
    "name": "Juan Pérez"
  },
  {
    "email": "usuario2@example.com",
    "name": "María García"
  }
]
```

#### 🔐 Autenticación

Solo usuarios con rol `admin` pueden usar este endpoint.

#### 📊 Respuestas Posibles

**✅ Éxito Total:**
```json
{
  "success": 100,
  "failed": 0,
  "totalActiveSubscribers": 100
}
```

**⚠️ Éxito Parcial:**
```json
{
  "success": 95,
  "failed": 5,
  "totalActiveSubscribers": 100,
  "errors": [
    "Error enviando a usuario1@example.com: Invalid email",
    "Error enviando a usuario2@example.com: Rate limit exceeded"
  ]
}
```

**ℹ️ Sin Suscriptores Activos:**
```json
{
  "success": 0,
  "failed": 0,
  "totalActiveSubscribers": 0
}
```

---

## 📧 Endpoint Alternativo (Manual)

### POST `/v1/marketing/send-migration-notification`

Usa este endpoint si necesitas enviar a una lista específica de usuarios.

**Request Body:**
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

---

## 🎯 Comparación

| Característica | Auto (Recomendado) | Manual |
|----------------|-------------------|--------|
| Requiere lista de emails | ❌ No | ✅ Sí |
| Consulta DB automáticamente | ✅ Sí | ❌ No |
| Filtra solo activos | ✅ Sí | ❌ No |
| Elimina duplicados | ✅ Sí | ⚠️ Manual |
| Facilidad de uso | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 💡 Ejemplo de Uso con cURL

### Envío Automático (Recomendado)

```bash
curl -X POST http://localhost:3001/v1/marketing/send-migration-notification-to-active-subscribers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Envío Manual

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

---

## 🔧 Proceso Interno

Cuando usas el endpoint automático, el sistema:

1. 🔍 Consulta la tabla `user_subscriptions`
2. ✅ Filtra solo suscripciones con `status = 'active'`
3. 👥 Obtiene los datos del usuario relacionado
4. 🔄 Elimina duplicados por email
5. 📧 Envía emails en lotes de 10
6. ⏱️ Pausa 1 segundo entre lotes
7. 📊 Retorna estadísticas completas

---

## ⚙️ Variables de Entorno Requeridas

```env
RESEND_API_KEY=tu_api_key
RESEND_FROM_EMAIL=noreply@carvajalfit.com
RESEND_FROM_NAME=Club Carvajal Fit
```

---

## 📝 Notas Importantes

- ⚡ El envío es **asíncrono** - puede tomar tiempo con muchos usuarios
- 📊 Los logs se muestran en la consola del servidor
- 🔒 Solo administradores pueden ejecutar este endpoint
- 📧 El template HTML se lee desde `src/marketing/templates/migration-notification.html`
