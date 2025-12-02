# 🗄️ Instrucciones de Migración - Campos de Mercado Pago

## ⚠️ Error Actual
```
column UserSubscription.mercado_pago_subscription_id does not exist
```

Este error ocurre porque las columnas necesarias no existen en la base de datos.

## 🔧 Solución: Ejecutar Migración SQL

### Opción 1: Desde el Dashboard de Render

1. **Accede a tu dashboard de Render:**
   - Ve a https://dashboard.render.com
   - Inicia sesión en tu cuenta

2. **Encuentra tu base de datos PostgreSQL:**
   - En el panel izquierdo, busca tu servicio de base de datos PostgreSQL
   - Haz clic en él

3. **Abre la consola SQL:**
   - Ve a la pestaña **"Connect"** o **"Shell"**
   - O busca la opción **"PSQL"** o **"Query"**

4. **Ejecuta los siguientes comandos SQL:**

```sql
-- Agregar columna mercado_pago_subscription_id
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS mercado_pago_subscription_id VARCHAR(255);

-- Agregar columna metadata (JSONB)
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB;
```

5. **Verifica que se agregaron correctamente:**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
    AND column_name IN ('mercado_pago_subscription_id', 'metadata')
ORDER BY column_name;
```

### Opción 2: Desde la línea de comandos (si tienes acceso)

Si tienes acceso SSH o puedes conectarte desde tu máquina local:

```bash
# Conecta a la base de datos de Render
psql "postgresql://usuario:password@host:puerto/database"

# Luego ejecuta:
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS mercado_pago_subscription_id VARCHAR(255);

ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB;
```

### Opción 3: Usar pgAdmin o DBeaver

1. Conecta a tu base de datos de Render usando las credenciales
2. Abre el editor SQL
3. Ejecuta los comandos ALTER TABLE

## ✅ Verificación

Después de ejecutar la migración, deberías poder ver:

```
column_name                    | data_type | is_nullable
-------------------------------+-----------+-------------
mercado_pago_subscription_id   | character varying(255) | YES
metadata                       | jsonb                  | YES
```

## 🔄 Después de la Migración

1. **Reinicia tu aplicación** en Render
2. El error debería desaparecer
3. El sistema de suscripciones funcionará correctamente

## 📝 Notas Importantes

- **IF NOT EXISTS**: Los comandos usan `IF NOT EXISTS` para evitar errores si las columnas ya existen
- **Sin pérdida de datos**: Esta migración solo agrega columnas, no modifica datos existentes
- **Producción**: Asegúrate de ejecutar esto en tu base de datos de producción

## 🆘 Si el error persiste

1. Verifica que ejecutaste los comandos SQL correctamente
2. Verifica que estás conectado a la base de datos correcta
3. Verifica que la tabla `user_subscriptions` existe
4. Reinicia la aplicación después de ejecutar la migración


