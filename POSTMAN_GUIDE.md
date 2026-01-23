# 🚀 Guía de Uso de la API en Postman

Esta guía te muestra cómo probar todos los endpoints de autenticación en Postman.

## 📋 Configuración Inicial

### 1. Variables de Entorno en Postman

Crea un entorno en Postman y agrega estas variables:

| Variable | Valor Inicial | Descripción |
|----------|---------------|-------------|
| `base_url` | `https://carvajalfit.com` | URL base de la API |
| `access_token` | (vacío) | Se llenará automáticamente después del login |
| `refresh_token` | (vacío) | Se llenará automáticamente después del login |

**Cómo configurar:**
1. Click en el ícono de engranaje (⚙️) arriba a la derecha
2. Click en "Add" para crear un nuevo entorno
3. Agrega las variables de la tabla
4. Selecciona el entorno creado en el dropdown

---

## 🔐 Endpoints de Autenticación

### 1. POST /auth/register - Registrar Usuario

**Configuración:**
- **Método:** `POST`
- **URL:** `{{base_url}}/auth/register`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "email": "usuario@example.com",
    "password": "password123",
    "name": "Juan Pérez",
    "phone": "+56912345678",
    "countryCode": "CL",
    "preferredCurrency": "CLP",
    "role": "customer"
  }
  ```
  
  **Nota:** 
  - Todos los campos excepto `email` y `password` son opcionales.
  - El campo `role` solo puede ser `"customer"` en el registro público. Los roles `"admin"` y `"support"` solo pueden ser asignados por administradores.
  - Si no se especifica `role`, se asignará automáticamente `"customer"`.

**Ejemplo de Respuesta (201):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Script de Postman (Tests) - Guardar tokens automáticamente:**
```javascript
if (pm.response.code === 201) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.accessToken);
    pm.environment.set("refresh_token", jsonData.refreshToken);
    console.log("Tokens guardados automáticamente");
}
```

---

### 2. POST /auth/login - Iniciar Sesión

**Configuración:**
- **Método:** `POST`
- **URL:** `{{base_url}}/auth/login`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "email": "usuario@example.com",
    "password": "password123"
  }
  ```

**Ejemplo de Respuesta (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Script de Postman (Tests) - Guardar tokens automáticamente:**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.accessToken);
    pm.environment.set("refresh_token", jsonData.refreshToken);
    console.log("Tokens guardados automáticamente");
}
```

---

### 3. GET /auth/me - Obtener Perfil del Usuario

**Configuración:**
- **Método:** `GET`
- **URL:** `{{base_url}}/auth/me`
- **Headers:**
  ```
  Authorization: Bearer {{access_token}}
  ```

**Ejemplo de Respuesta (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "usuario@example.com",
  "name": "Juan Pérez",
  "phone": null,
  "countryCode": null,
  "preferredCurrency": "CLP",
  "role": "customer",
  "status": "active",
  "emailVerified": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "lastLoginAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. POST /auth/refresh - Renovar Access Token

**Configuración:**
- **Método:** `POST`
- **URL:** `{{base_url}}/auth/refresh`
- **Headers:**
  ```
  Content-Type: application/json
  ```
- **Body (raw JSON):**
  ```json
  {
    "refreshToken": "{{refresh_token}}"
  }
  ```

**Ejemplo de Respuesta (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Script de Postman (Tests) - Actualizar tokens automáticamente:**
```javascript
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("access_token", jsonData.accessToken);
    pm.environment.set("refresh_token", jsonData.refreshToken);
    console.log("Tokens renovados automáticamente");
}
```

---

### 5. POST /auth/logout - Cerrar Sesión

**Configuración:**
- **Método:** `POST`
- **URL:** `{{base_url}}/auth/logout`
- **Headers:**
  ```
  Authorization: Bearer {{access_token}}
  ```

**Ejemplo de Respuesta (200):**
```json
{
  "message": "Sesión cerrada exitosamente"
}
```

**Script de Postman (Tests) - Limpiar tokens:**
```javascript
if (pm.response.code === 200) {
    pm.environment.set("access_token", "");
    pm.environment.set("refresh_token", "");
    console.log("Tokens limpiados");
}
```

---

## 📝 Ejemplos de Errores

### Error de Validación (400)
```json
{
  "statusCode": 400,
  "message": [
    "El email debe ser válido",
    "La contraseña debe tener al menos 8 caracteres"
  ],
  "error": "Bad Request"
}
```

### Credenciales Inválidas (401)
```json
{
  "statusCode": 401,
  "message": "Credenciales inválidas",
  "error": "Unauthorized"
}
```

### Email Ya Registrado (409)
```json
{
  "statusCode": 409,
  "message": "El email ya está registrado",
  "error": "Conflict"
}
```

### Token Inválido o Expirado (401)
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

---

## 🎯 Colección de Postman Recomendada

### Estructura de Carpetas:

```
📁 Auth API
  📁 1. Public Endpoints
    📄 Register
    📄 Login
  📁 2. Protected Endpoints
    📄 Get Profile (Me)
    📄 Logout
  📁 3. Token Management
    📄 Refresh Token
```

---

## 💡 Tips y Trucos

### 1. Pre-request Script para Auto-autenticación

Si quieres que una petición se autentique automáticamente antes de ejecutarse, agrega esto en "Pre-request Script":

```javascript
// Verificar si el token existe y no está vacío
if (!pm.environment.get("access_token")) {
    console.log("No hay token, ejecutando login automático...");
    // Aquí podrías hacer una petición de login automático
}
```

### 2. Verificar Token Válido

En el tab "Tests" de cualquier petición protegida:

```javascript
pm.test("Token válido", function () {
    pm.response.to.have.status(200);
});

pm.test("Token inválido o expirado", function () {
    if (pm.response.code === 401) {
        console.log("Token expirado, necesitas hacer refresh o login");
    }
});
```

### 3. Auto-refresh cuando el token expire

En el tab "Tests" de peticiones protegidas:

```javascript
if (pm.response.code === 401) {
    // Intentar refresh automático
    pm.sendRequest({
        url: pm.environment.get("base_url") + "/auth/refresh",
        method: 'POST',
        header: {
            'Content-Type': 'application/json'
        },
        body: {
            mode: 'raw',
            raw: JSON.stringify({
                refreshToken: pm.environment.get("refresh_token")
            })
        }
    }, function (err, res) {
        if (res.code === 200) {
            const jsonData = res.json();
            pm.environment.set("access_token", jsonData.accessToken);
            pm.environment.set("refresh_token", jsonData.refreshToken);
            console.log("Token refrescado automáticamente, intenta la petición de nuevo");
        }
    });
}
```

---

## 🔄 Flujo de Trabajo Recomendado

1. **Registrar un usuario** → `POST /auth/register`
   - Los tokens se guardan automáticamente con el script

2. **Obtener perfil** → `GET /auth/me`
   - Usa el token guardado automáticamente

3. **Si el token expira** → `POST /auth/refresh`
   - Renueva los tokens automáticamente

4. **Cerrar sesión** → `POST /auth/logout`
   - Limpia los tokens

---

## 📦 Importar Colección de Postman

Puedes crear un archivo JSON de colección de Postman. Aquí tienes un ejemplo básico:

```json
{
  "info": {
    "name": "Carvajal Fit - Auth API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"usuario@example.com\",\n  \"password\": \"password123\",\n  \"name\": \"Juan Pérez\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/auth/register",
          "host": ["{{base_url}}"],
          "path": ["auth", "register"]
        }
      }
    }
  ]
}
```

---

¡Listo! Ahora puedes probar toda la API de autenticación en Postman. 🎉

