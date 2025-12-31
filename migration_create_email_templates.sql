-- ============================================
-- MIGRACIÓN: Crear tabla email_templates
-- ============================================
-- Esta migración crea la tabla para almacenar plantillas de email
-- para el sistema de marketing.

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por nombre
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(name);

-- Índice para ordenar por fecha de creación
CREATE INDEX IF NOT EXISTS idx_email_templates_created_at ON email_templates(created_at DESC);

-- Comentarios en la tabla y columnas
COMMENT ON TABLE email_templates IS 'Almacena plantillas de email para marketing masivo';
COMMENT ON COLUMN email_templates.id IS 'Identificador único de la plantilla';
COMMENT ON COLUMN email_templates.name IS 'Nombre descriptivo de la plantilla';
COMMENT ON COLUMN email_templates.subject IS 'Asunto del email (puede contener variables {{variable}})';
COMMENT ON COLUMN email_templates.html_content IS 'Contenido HTML del email (puede contener variables {{variable}})';
COMMENT ON COLUMN email_templates.created_at IS 'Fecha de creación de la plantilla';
COMMENT ON COLUMN email_templates.updated_at IS 'Fecha de última actualización de la plantilla';







