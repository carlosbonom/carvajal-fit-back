-- ============================================
-- INSERT para Plan de Suscripción: CLUB CARVAJAL FIT
-- ============================================

-- 1. Primero, asegurarse de que existan los billing cycles (mensual y anual)
-- Si ya existen, estos INSERTs fallarán pero no afectarán los siguientes

-- Billing Cycle Mensual
INSERT INTO billing_cycles (name, slug, interval_type, interval_count, is_active, created_at)
VALUES (
  'Mensual',
  'mensual',
  'month',
  1,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO NOTHING;

-- Billing Cycle Anual
INSERT INTO billing_cycles (name, slug, interval_type, interval_count, is_active, created_at)
VALUES (
  'Anual',
  'anual',
  'year',
  1,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Insertar el Plan de Suscripción
INSERT INTO subscription_plans (
  name,
  slug,
  description,
  is_active,
  features,
  sort_order,
  created_at,
  updated_at
)
VALUES (
  'CLUB CARVAJAL FIT',
  'club-carvajal-fit',
  'Transforma tu cuerpo con una ruta clara y efectiva. Sin errores, sin tiempo perdido.',
  true,
  '[
    "Ruta de entrenamiento estructurada por fases (definición, mantenimiento, volumen)",
    "Guía completa de cardio optimizada",
    "Zoom grupal en vivo todos los viernes",
    "Grupo privado de WhatsApp con mensaje diario 5:00 AM",
    "Tabla Excel profesional de progreso con gráficos automáticos",
    "Acceso inmediato a todos los planes PDF disponibles"
  ]'::jsonb,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  updated_at = CURRENT_TIMESTAMP;

-- 3. Insertar los Precios del Plan
-- Nota: Necesitarás obtener los IDs del plan y los billing cycles después de insertarlos
-- O puedes usar subconsultas para obtenerlos por slug

-- Precio Mensual en CLP
INSERT INTO subscription_prices (
  plan_id,
  billing_cycle_id,
  currency,
  amount,
  is_active,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM subscription_plans WHERE slug = 'club-carvajal-fit'),
  (SELECT id FROM billing_cycles WHERE slug = 'mensual'),
  'CLP',
  49990.00,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (plan_id, billing_cycle_id, currency) DO UPDATE
SET
  amount = EXCLUDED.amount,
  updated_at = CURRENT_TIMESTAMP;

-- Precio Mensual en USD
INSERT INTO subscription_prices (
  plan_id,
  billing_cycle_id,
  currency,
  amount,
  is_active,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM subscription_plans WHERE slug = 'club-carvajal-fit'),
  (SELECT id FROM billing_cycles WHERE slug = 'mensual'),
  'USD',
  50.00,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (plan_id, billing_cycle_id, currency) DO UPDATE
SET
  amount = EXCLUDED.amount,
  updated_at = CURRENT_TIMESTAMP;

-- Precio Anual en COP (ajusta el monto según corresponda)
-- Ejemplo: 10 meses de precio mensual = 499900.00
INSERT INTO subscription_prices (
  plan_id,
  billing_cycle_id,
  currency,
  amount,
  is_active,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM subscription_plans WHERE slug = 'club-carvajal-fit'),
  (SELECT id FROM billing_cycles WHERE slug = 'anual'),
  'CLP',
  599880.00,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (plan_id, billing_cycle_id, currency) DO UPDATE
SET
  amount = EXCLUDED.amount,
  updated_at = CURRENT_TIMESTAMP;

-- Precio Anual en USD (ajusta el monto según corresponda)
-- Ejemplo: 10 meses de precio mensual = 500.00
INSERT INTO subscription_prices (
  plan_id,
  billing_cycle_id,
  currency,
  amount,
  is_active,
  created_at,
  updated_at
)
VALUES (
  (SELECT id FROM subscription_plans WHERE slug = 'club-carvajal-fit'),
  (SELECT id FROM billing_cycles WHERE slug = 'anual'),
  'USD',
  600.00,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT (plan_id, billing_cycle_id, currency) DO UPDATE
SET
  amount = EXCLUDED.amount,
  updated_at = CURRENT_TIMESTAMP;

