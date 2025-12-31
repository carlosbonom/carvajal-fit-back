-- Migration: Create success_stories table
-- Description: Tabla para almacenar los casos de éxito que se muestran en la página principal

CREATE TABLE IF NOT EXISTS success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(500) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_success_stories_active ON success_stories(is_active);
CREATE INDEX IF NOT EXISTS idx_success_stories_order ON success_stories(sort_order);

-- Comentarios en la tabla y columnas
COMMENT ON TABLE success_stories IS 'Tabla para almacenar los casos de éxito que se muestran en la página principal';
COMMENT ON COLUMN success_stories.id IS 'Identificador único del caso de éxito';
COMMENT ON COLUMN success_stories.name IS 'Nombre de la persona del caso de éxito';
COMMENT ON COLUMN success_stories.description IS 'Descripción del caso de éxito';
COMMENT ON COLUMN success_stories.image_url IS 'URL de la imagen del caso de éxito';
COMMENT ON COLUMN success_stories.is_active IS 'Indica si el caso de éxito está activo y visible';
COMMENT ON COLUMN success_stories.sort_order IS 'Orden de visualización (menor número = primero)';
COMMENT ON COLUMN success_stories.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN success_stories.updated_at IS 'Fecha de última actualización del registro';







