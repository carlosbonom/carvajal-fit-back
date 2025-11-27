-- ============================================
-- Migración: Agregar campos de Mercado Pago a user_subscriptions
-- ============================================
-- Ejecuta este script en tu base de datos para agregar los campos necesarios

-- Agregar columna mercado_pago_subscription_id
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS mercado_pago_subscription_id VARCHAR(255);

-- Agregar columna metadata (JSONB)
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Agregar comentarios a las columnas (opcional, pero útil para documentación)
COMMENT ON COLUMN user_subscriptions.mercado_pago_subscription_id IS 'ID de la suscripción en Mercado Pago';
COMMENT ON COLUMN user_subscriptions.metadata IS 'Metadatos adicionales de la suscripción (estado de MP, initPoint, etc.)';

-- Verificar que las columnas se agregaron correctamente
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
    AND column_name IN ('mercado_pago_subscription_id', 'metadata')
ORDER BY column_name;

