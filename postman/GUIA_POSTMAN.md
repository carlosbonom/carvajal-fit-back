# Guía de Uso - Colección Postman para Migration Notification

## 📥 Importar la Colección

1. Abre Postman
2. Click en **Import** (arriba a la izquierda)
3. Selecciona el archivo: `postman/migration_notification.postman_collection.json`
4. Click en **Import**

## ⚙️ Configuración Inicial

### Variables de Entorno

La colección ya incluye variables por defecto:

- `base_url`: `http://localhost:3001/v1`
- `jwt_token`: (se llena automáticamente al hacer login)

Si necesitas cambiar la URL (por ejemplo, para producción):

1. Click en el ícono de ojo 👁️ (arriba derecha)
2. Click en **Edit** junto a "Migration Notification - Club Carvajal Fit"
3. Modifica `base_url` a tu URL de producción

## 🚀 Cómo Usar

### Paso 1: Autenticación

1. Abre la carpeta **Auth**
2. Click en **Login Admin**
3. Modifica el body con tus credenciales de admin:
   ```json
   {
     "email": "tu_email_admin@carvajalfit.com",
     "password": "tu_password"
   }
   ```
4. Click en **Send**
5. ✅ El token JWT se guardará automáticamente en `{{jwt_token}}`

### Paso 2: Enviar Notificaciones

Tienes 3 ejemplos disponibles:

#### 📧 Opción 1: Un Solo Usuario

1. Abre **Migration Notification** > **Enviar a un solo usuario**
2. Modifica el email y nombre:
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
3. Click en **Send**

#### 📧 Opción 2: Múltiples Usuarios (5 usuarios)

1. Abre **Migration Notification** > **Enviar a múltiples usuarios**
2. Modifica los emails y nombres según necesites
3. Click en **Send**

#### 📧 Opción 3: Lista Grande (20 usuarios)

1. Abre **Migration Notification** > **Enviar a lista grande**
2. Modifica los emails y nombres
3. Click en **Send**
4. ⏱️ Se procesarán en lotes de 10 con pausa de 1 segundo entre lotes

## 📊 Respuestas Esperadas

### ✅ Éxito Total
```json
{
  "success": 5,
  "failed": 0
}
```

### ⚠️ Éxito Parcial
```json
{
  "success": 3,
  "failed": 2,
  "errors": [
    "Error enviando a usuario@invalido.com: Invalid email address",
    "Error enviando a otro@error.com: Rate limit exceeded"
  ]
}
```

### ❌ Error de Autenticación
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### ❌ Error de Permisos
```json
{
  "statusCode": 403,
  "message": "No autorizado. Solo administradores pueden enviar notificaciones de migración."
}
```

## 💡 Tips

1. **Prueba primero con tu propio email** para verificar que el email se ve bien
2. **Usa lotes pequeños** al principio (5-10 usuarios) para verificar
3. **Revisa los logs** en la consola del backend para ver el progreso
4. **Verifica el spam** - algunos emails pueden caer en spam la primera vez

## 🔧 Troubleshooting

### "RESEND_API_KEY no está configurado"
- Verifica que tu `.env` tenga `RESEND_API_KEY` configurado
- Reinicia el servidor backend

### "No se pudo cargar el template de email"
- Verifica que existe el archivo `src/marketing/templates/migration-notification.html`
- Verifica los permisos de lectura del archivo

### Token expirado
- Vuelve a ejecutar **Login Admin** para obtener un nuevo token

## 📝 Ejemplo Real

```json
{
  "recipients": [
    {
      "email": "carlos@example.com",
      "name": "Carlos Carvajal"
    },
    {
      "email": "maria@example.com",
      "name": "María López"
    },
    {
      "email": "jose@example.com",
      "name": "José Martínez"
    }
  ]
}
```

Este ejemplo enviará 3 emails personalizados con el nombre de cada usuario.
