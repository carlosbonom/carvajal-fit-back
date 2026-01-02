-- ============================================
-- MIGRACIÓN: Crear tabla course_categories y agregar relación a courses
-- ============================================
-- Esta migración crea la tabla para categorías de cursos y agrega la relación opcional

-- Crear tabla course_categories
CREATE TABLE IF NOT EXISTS course_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_course_categories_slug ON course_categories(slug);

-- Agregar columna category_id a courses (opcional, puede ser NULL)
ALTER TABLE courses 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES course_categories(id) ON DELETE SET NULL;

-- Crear índice para la relación
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id);

-- Comentarios en la tabla y columnas
COMMENT ON TABLE course_categories IS 'Categorías para organizar cursos';
COMMENT ON COLUMN course_categories.id IS 'Identificador único de la categoría';
COMMENT ON COLUMN course_categories.name IS 'Nombre de la categoría';
COMMENT ON COLUMN course_categories.slug IS 'Slug único de la categoría';
COMMENT ON COLUMN course_categories.description IS 'Descripción de la categoría';
COMMENT ON COLUMN course_categories.sort_order IS 'Orden de visualización';
COMMENT ON COLUMN course_categories.is_active IS 'Indica si la categoría está activa';
COMMENT ON COLUMN courses.category_id IS 'Relación opcional con la categoría del curso';

