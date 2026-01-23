# Módulo de Suscripciones

Este módulo proporciona un sistema completo de suscripciones integrado con Mercado Pago.

## 🔐 Características

- Obtener planes de suscripción disponibles
- Crear suscripciones con Mercado Pago
- Gestionar suscripciones del usuario
- Cancelar suscripciones
- Recibir notificaciones de webhook de Mercado Pago
- Ver historial de pagos

## 📋 Variables de Entorno Requeridas

Agrega estas variables a tu archivo `.env`:

```env
MERCADOPAGO_ACCESS_TOKEN=tu_access_token_de_mercadopago
APP_URL=https://carvajalfit.com  # URL de tu aplicación (opcional)
```

## 🚀 Endpoints

### 1. GET /subscriptions/plans
Obtiene todos los planes de suscripción disponibles (público).

**Response (200):**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "CLUB CARVAJAL FIT",
      "slug": "club-carvajal-fit",
      "description": "Transforma tu cuerpo...",
      "features": ["feature1", "feature2"],
      "prices": [
        {
          "id": "uuid",
          "currency": "CLP",
          "amount": 49990.00,
          "billingCycle": {
            "id": "uuid",
            "name": "Mensual",
            "slug": "mensual",
            "intervalType": "month",
            "intervalCount": 1
          }
        }
      ]
    }
  ]
}
```

### 2. POST /subscriptions/subscribe
Crea una nueva suscripción (requiere autenticación).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "planId": "uuid-del-plan",
  "billingCycleId": "uuid-del-billing-cycle",
  "currency": "CLP",  // Opcional
  "payerEmail": "usuario@example.com",  // Opcional
  "payerFirstName": "Juan",  // Opcional
  "payerLastName": "Pérez",  // Opcional
  "payerIdentificationType": "RUT",  // Opcional
  "payerIdentificationNumber": "12345678-9",  // Opcional
  "backUrl": "https://tu-app.com/success"  // Opcional
}
```

**Response (201):**
```json
{
  "id": "uuid-de-la-suscripcion",
  "status": "payment_failed",
  "mercadoPagoSubscriptionId": "123456789",
  "initPoint": "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=...",
  "message": "Suscripción creada exitosamente"
}
```

### 3. GET /auth/me
Obtiene el perfil del usuario actual incluyendo su suscripción (requiere autenticación).

**Nota:** Este endpoint está en el módulo de autenticación y retorna tanto la información del usuario como su suscripción.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "role": "customer",
  "status": "active",
  "subscription": {
    "id": "uuid",
    "status": "active",
    "startedAt": "2024-01-01T00:00:00.000Z",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelledAt": null,
    "autoRenew": true,
    "cancellationReason": null,
    "mercadoPagoSubscriptionId": "123456789",
    "plan": { ... },
    "billingCycle": { ... },
    "metadata": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Nota:** Si el usuario no tiene suscripción, el campo `subscription` será `null`.

### 4. POST /subscriptions/cancel
Cancela la suscripción del usuario actual (requiere autenticación).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "reason": "Ya no necesito el servicio"  // Opcional
}
```

**Response (200):**
```json
{
  "message": "Suscripción cancelada exitosamente",
  "subscription": { ... }
}
```

### 5. GET /subscriptions/payments
Obtiene el historial de pagos de la suscripción del usuario (requiere autenticación).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 49990.00,
      "currency": "CLP",
      "status": "completed",
      "paymentMethod": "credit_card",
      "paymentProvider": "mercadopago",
      "transactionId": "123456789",
      "periodStart": "2024-01-01T00:00:00.000Z",
      "periodEnd": "2024-02-01T00:00:00.000Z",
      "paidAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 6. POST /subscriptions/webhook
Endpoint público para recibir notificaciones de Mercado Pago.

**Request Body (de Mercado Pago):**
```json
{
  "id": 123456789,
  "live_mode": true,
  "type": "subscription_authorized_payment",
  "date_created": "2024-01-01T12:00:00.000Z",
  "application_id": 123456789,
  "user_id": 123456789,
  "version": 1,
  "api_version": "v1",
  "action": "payment.created",
  "data": {
    "id": "2c9380848a1234567890123456789"
  }
}
```

**Response (200):**
```json
{
  "received": true
}
```

## 🔄 Flujo de Suscripción

1. **Usuario obtiene planes disponibles**: `GET /subscriptions/plans`
2. **Usuario crea suscripción**: `POST /subscriptions/subscribe`
3. **Usuario autoriza pago**: Redirige al `initPoint` de Mercado Pago
4. **Mercado Pago envía webhook**: `POST /subscriptions/webhook`
5. **Sistema actualiza estado**: La suscripción cambia a `ACTIVE`
6. **Usuario gestiona suscripción**: `GET /auth/me` (incluye suscripción), `POST /subscriptions/cancel`

## 📝 Estados de Suscripción

- `active`: Suscripción activa y funcionando
- `cancelled`: Suscripción cancelada por el usuario
- `expired`: Suscripción expirada
- `paused`: Suscripción pausada
- `payment_failed`: Fallo en el pago

## 🔔 Tipos de Notificaciones de Webhook

Mercado Pago envía webhooks **automáticamente** cada vez que ocurre un evento relacionado con la suscripción:

- `subscription_preapproval`: Creación o actualización de suscripción
- `subscription_authorized_payment`: Pago recurrente autorizado (cuando el usuario autoriza el pago inicial)
- `subscription_payment`: Pago recurrente procesado (se envía automáticamente cada mes/año según el ciclo)
- `payment`: Notificación de pago individual (puede ser de una suscripción)

### ⚡ Pagos Recurrentes Automáticos

**IMPORTANTE**: Mercado Pago envía webhooks automáticamente cada vez que se procesa un pago recurrente:
- **Suscripción mensual**: Recibirás un webhook cada mes cuando se cobre
- **Suscripción anual**: Recibirás un webhook cada año cuando se cobre
- **No necesitas consultar manualmente**: El sistema se actualiza automáticamente

Cuando se recibe una notificación de pago:
1. Se obtiene la información del pago desde Mercado Pago
2. Se crea/actualiza un registro en `subscription_payments`
3. Se actualiza el período de la suscripción (fechas de inicio y fin)
4. Se actualiza el estado de la suscripción

## ⚙️ Configuración de Webhook en Mercado Pago

1. Accede al [Panel de Desarrollador de Mercado Pago](https://www.mercadopago.com/developers)
2. Ve a tu aplicación → Webhooks
3. Agrega la URL: `https://tu-dominio.com/subscriptions/webhook`
4. Selecciona los eventos:
   - `subscription_preapproval`
   - `subscription_authorized_payment`
   - `subscription_payment`

## 🛠️ Migración de Base de Datos

Asegúrate de ejecutar las migraciones para agregar los campos necesarios:

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN mercado_pago_subscription_id VARCHAR(255),
ADD COLUMN metadata JSONB;
```

