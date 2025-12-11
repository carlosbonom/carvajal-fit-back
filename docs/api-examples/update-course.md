# Ejemplo de Uso: Editar un Curso

## Endpoint

```
PATCH /courses/:id
```

## Autenticación

Requiere token JWT en el header `Authorization`.

---

## Parámetros

### Path Parameters

- **id** (string, requerido): ID único del curso (UUID)

### Body Parameters (todos opcionales)

- **title** (string, opcional): Título del curso (1-300 caracteres)
- **slug** (string, opcional): Slug único del curso (solo letras minúsculas, números y guiones)
- **description** (string, opcional): Descripción del curso
- **thumbnailUrl** (string, opcional): URL de la imagen miniatura (máx. 500 caracteres)
- **trailerUrl** (string, opcional): URL del trailer (máx. 500 caracteres)
- **level** (string, opcional): Nivel del curso (`beginner`, `intermediate`, `advanced` o `null`)
- **durationMinutes** (number, opcional): Duración en minutos (≥ 0)
- **isPublished** (boolean, opcional): Estado de publicación
- **sortOrder** (number, opcional): Orden de visualización (≥ 0)
- **creatorId** (string, opcional): ID del creador (puede ser `null` para eliminar la relación)
- **metadata** (object, opcional): Objeto JSON con metadatos adicionales

---

## Ejemplos de Uso

### 1. JavaScript/TypeScript (Fetch API)

```typescript
// Tipos TypeScript
interface UpdateCourseDto {
  title?: string;
  slug?: string;
  description?: string;
  thumbnailUrl?: string;
  trailerUrl?: string;
  level?: 'beginner' | 'intermediate' | 'advanced' | null;
  durationMinutes?: number | null;
  isPublished?: boolean;
  sortOrder?: number | null;
  creatorId?: string | null;
  metadata?: Record<string, any>;
}

interface CourseResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
  level: string | null;
  durationMinutes: number | null;
  isPublished: boolean;
  publishedAt: string | null;
  sortOrder: number;
  metadata: Record<string, any> | null;
  creator: {
    id: string;
    name: string;
    slug: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Función para actualizar un curso
async function updateCourse(
  courseId: string,
  updates: UpdateCourseDto,
  token: string
): Promise<CourseResponse> {
  try {
    const response = await fetch(`http://localhost:3000/courses/${courseId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
      }
      if (response.status === 404) {
        throw new Error('Curso no encontrado.');
      }
      if (response.status === 400) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error de validación');
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const course: CourseResponse = await response.json();
    return course;
  } catch (error) {
    console.error('Error al actualizar curso:', error);
    throw error;
  }
}

// Ejemplo 1: Actualización parcial (solo algunos campos)
const token = localStorage.getItem('authToken');
updateCourse('course-uuid-123', {
  title: 'Curso de Fitness Avanzado',
  description: 'Aprende técnicas avanzadas de fitness y entrenamiento.',
  isPublished: true,
}, token)
  .then(course => {
    console.log('Curso actualizado:', course);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Ejemplo 2: Actualización con metadata
updateCourse('course-uuid-123', {
  title: 'Curso de Yoga para Principiantes',
  level: 'beginner',
  durationMinutes: 120,
  metadata: {
    tags: ['yoga', 'bienestar', 'principiante'],
    difficulty: 'fácil',
    instructor: 'María González',
    language: 'es',
    requirements: ['colchoneta', 'ropa cómoda'],
  },
}, token)
  .then(course => {
    console.log('Curso actualizado con metadata:', course);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Ejemplo 3: Cambiar el creador del curso
updateCourse('course-uuid-123', {
  creatorId: 'creator-uuid-456',
}, token)
  .then(course => {
    console.log('Creador actualizado:', course.creator);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Ejemplo 4: Publicar un curso
updateCourse('course-uuid-123', {
  isPublished: true,
}, token)
  .then(course => {
    console.log('Curso publicado:', course);
    console.log('Fecha de publicación:', course.publishedAt);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });

// Ejemplo 5: Actualizar slug (debe ser único)
updateCourse('course-uuid-123', {
  slug: 'nuevo-slug-del-curso',
}, token)
  .then(course => {
    console.log('Slug actualizado:', course.slug);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

---

### 2. React Hook (Custom Hook)

```typescript
import { useState } from 'react';

interface UpdateCourseDto {
  // ... (mismos tipos de arriba)
}

interface CourseResponse {
  // ... (mismos tipos de arriba)
}

interface UseUpdateCourseResult {
  updateCourse: (courseId: string, updates: UpdateCourseDto) => Promise<void>;
  loading: boolean;
  error: string | null;
  success: boolean;
}

export function useUpdateCourse(token: string | null): UseUpdateCourseResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const updateCourse = async (courseId: string, updates: UpdateCourseDto) => {
    if (!token) {
      setError('No hay token de autenticación');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await fetch(`http://localhost:3000/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        if (response.status === 404) {
          throw new Error('Curso no encontrado.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el curso');
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    updateCourse,
    loading,
    error,
    success,
  };
}

// Uso en componente
function EditCourseForm({ courseId }: { courseId: string }) {
  const token = localStorage.getItem('authToken');
  const { updateCourse, loading, error, success } = useUpdateCourse(token);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    level: 'beginner' as const,
    isPublished: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateCourse(courseId, formData);
  };

  if (success) {
    return <div className="success">¡Curso actualizado exitosamente!</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <div>
        <label>
          Título:
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </label>
      </div>

      <div>
        <label>
          Descripción:
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </label>
      </div>

      <div>
        <label>
          Nivel:
          <select
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value as any })}
          >
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.isPublished}
            onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
          />
          Publicado
        </label>
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Guardar Cambios'}
      </button>
    </form>
  );
}
```

---

### 3. Axios

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Función para actualizar un curso
async function updateCourse(
  courseId: string,
  updates: {
    title?: string;
    slug?: string;
    description?: string;
    thumbnailUrl?: string;
    trailerUrl?: string;
    level?: 'beginner' | 'intermediate' | 'advanced' | null;
    durationMinutes?: number | null;
    isPublished?: boolean;
    sortOrder?: number | null;
    creatorId?: string | null;
    metadata?: Record<string, any>;
  }
) {
  try {
    const response = await api.patch(`/courses/${courseId}`, updates);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
      }
      if (error.response?.status === 404) {
        throw new Error('Curso no encontrado.');
      }
      if (error.response?.status === 400) {
        throw new Error(error.response.data.message || 'Error de validación');
      }
      throw new Error(error.response?.data?.message || 'Error al actualizar el curso');
    }
    throw error;
  }
}

// Uso
updateCourse('course-uuid-123', {
  title: 'Nuevo Título del Curso',
  description: 'Nueva descripción',
  isPublished: true,
  metadata: {
    tags: ['fitness', 'salud'],
  },
})
  .then(course => {
    console.log('Curso actualizado:', course);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

---

### 4. cURL

```bash
# Ejemplo 1: Actualización parcial básica
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Curso de Fitness Avanzado",
    "description": "Aprende técnicas avanzadas de fitness y entrenamiento.",
    "isPublished": true
  }'

# Ejemplo 2: Actualización con metadata
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Curso de Yoga para Principiantes",
    "level": "beginner",
    "durationMinutes": 120,
    "metadata": {
      "tags": ["yoga", "bienestar", "principiante"],
      "difficulty": "fácil",
      "instructor": "María González",
      "language": "es"
    }
  }'

# Ejemplo 3: Cambiar solo el nivel y publicar
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "intermediate",
    "isPublished": true
  }'

# Ejemplo 4: Actualizar slug
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "nuevo-slug-del-curso"
  }'

# Ejemplo 5: Cambiar el creador
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorId": "creator-uuid-456"
  }'

# Ejemplo 6: Eliminar la relación con el creador (establecer a null)
curl -X PATCH "http://localhost:3000/courses/course-uuid-123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "creatorId": null
  }'
```

---

## Respuestas

### Respuesta Exitosa (200 OK)

```json
{
  "id": "course-uuid-123",
  "title": "Curso de Fitness Avanzado",
  "slug": "curso-de-fitness-avanzado",
  "description": "Aprende técnicas avanzadas de fitness y entrenamiento.",
  "thumbnailUrl": "https://example.com/thumbnail.jpg",
  "trailerUrl": "https://example.com/trailer.mp4",
  "level": "intermediate",
  "durationMinutes": 180,
  "isPublished": true,
  "publishedAt": "2024-01-15T10:30:00.000Z",
  "sortOrder": 1,
  "metadata": {
    "tags": ["fitness", "salud"],
    "difficulty": "intermedio"
  },
  "creator": {
    "id": "creator-uuid-456",
    "name": "Juan Pérez",
    "slug": "juan-perez"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### Errores Comunes

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Curso con ID course-uuid-123 no encontrado"
}
```

#### 400 Bad Request - Slug duplicado
```json
{
  "statusCode": 400,
  "message": "Ya existe un curso con el slug \"slug-duplicado\""
}
```

#### 400 Bad Request - Validación
```json
{
  "statusCode": 400,
  "message": [
    "El título no puede estar vacío",
    "El slug debe contener solo letras minúsculas, números y guiones"
  ]
}
```

#### 404 Not Found - Creator no existe
```json
{
  "statusCode": 404,
  "message": "Creator con ID creator-uuid-999 no encontrado"
}
```

---

## Notas Importantes

1. **Actualización Parcial**: Solo necesitas enviar los campos que deseas actualizar. Los campos no incluidos en el body permanecerán sin cambios.

2. **Slug Único**: Si intentas cambiar el slug, debe ser único en toda la base de datos. Si ya existe otro curso con ese slug, recibirás un error 400.

3. **Publicación Automática**: Cuando estableces `isPublished: true` por primera vez, el sistema automáticamente establece `publishedAt` con la fecha actual. Si cambias `isPublished: false`, se limpia `publishedAt`.

4. **Creator**: Puedes cambiar el creador del curso enviando un `creatorId` válido, o eliminar la relación estableciendo `creatorId: null`.

5. **Metadata**: El campo `metadata` acepta cualquier objeto JSON válido. Puedes almacenar información adicional como tags, categorías, configuraciones personalizadas, etc.

6. **Validaciones**: Todos los campos tienen validaciones. Asegúrate de cumplir con los requisitos (longitud, formato, etc.) para evitar errores 400.

---

## Casos de Uso Comunes

### Publicar un curso
```json
{
  "isPublished": true
}
```

### Despublicar un curso
```json
{
  "isPublished": false
}
```

### Actualizar información básica
```json
{
  "title": "Nuevo Título",
  "description": "Nueva descripción",
  "level": "advanced"
}
```

### Actualizar URLs de medios
```json
{
  "thumbnailUrl": "https://example.com/nueva-thumbnail.jpg",
  "trailerUrl": "https://example.com/nuevo-trailer.mp4"
}
```

### Reordenar cursos
```json
{
  "sortOrder": 5
}
```

### Agregar metadata personalizada
```json
{
  "metadata": {
    "category": "fitness",
    "tags": ["cardio", "fuerza", "flexibilidad"],
    "certificate": true,
    "language": "es",
    "subtitles": ["es", "en"]
  }
}
```

