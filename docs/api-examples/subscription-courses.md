# Ejemplo de Uso: Obtener Cursos con Contenido para Suscripción

## Endpoint

```
GET /courses/subscription
```

## Autenticación

Requiere token JWT en el header `Authorization`.

---

## Ejemplos de Uso

### 1. JavaScript/TypeScript (Fetch API)

```typescript
// Tipos TypeScript
interface ContentResource {
  id: string;
  title: string;
  description: string | null;
  resourceUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface Content {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  contentType: string; // 'video' | 'image' | 'pdf' | 'document' | 'audio' | 'link' | 'text'
  unlockValue: number;
  unlockType: string; // 'immediate' | 'day' | 'week' | 'month' | 'year'
  contentUrl: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  sortOrder: number;
  availabilityType: string; // 'none' | 'month' | 'day' | 'week'
  resources: ContentResource[];
  isPreview: boolean;
  isActive: boolean;
  course: {
    id: string;
    title: string;
    slug: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface CourseWithContent {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  trailerUrl: string | null;
  level: string | null; // 'beginner' | 'intermediate' | 'advanced'
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
  content: Content[];
}

// Función para obtener cursos
async function getSubscriptionCourses(token: string): Promise<CourseWithContent[]> {
  try {
    const response = await fetch('http://localhost:3000/courses/subscription', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
      }
      if (response.status === 403) {
        throw new Error('No tienes una suscripción activa.');
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const courses: CourseWithContent[] = await response.json();
    return courses;
  } catch (error) {
    console.error('Error al obtener cursos:', error);
    throw error;
  }
}

// Uso
const token = localStorage.getItem('authToken'); // o donde guardes el token
getSubscriptionCourses(token)
  .then(courses => {
    console.log('Cursos obtenidos:', courses);
    // Procesar los cursos...
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

---

### 2. React Hook (Custom Hook)

```typescript
import { useState, useEffect } from 'react';

interface CourseWithContent {
  // ... (mismos tipos de arriba)
}

interface UseSubscriptionCoursesResult {
  courses: CourseWithContent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSubscriptionCourses(token: string | null): UseSubscriptionCoursesResult {
  const [courses, setCourses] = useState<CourseWithContent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = async () => {
    if (!token) {
      setError('No hay token de autenticación');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:3000/courses/subscription', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        if (response.status === 403) {
          throw new Error('No tienes una suscripción activa.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}`);
      }

      const data: CourseWithContent[] = await response.json();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los cursos');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [token]);

  return {
    courses,
    loading,
    error,
    refetch: fetchCourses,
  };
}

// Uso en componente
function CoursesPage() {
  const token = localStorage.getItem('authToken');
  const { courses, loading, error, refetch } = useSubscriptionCourses(token);

  if (loading) {
    return <div>Cargando cursos...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error: {error}</p>
        <button onClick={refetch}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Mis Cursos</h1>
      {courses.map(course => (
        <div key={course.id}>
          <h2>{course.title}</h2>
          <p>{course.description}</p>
          <div>
            <h3>Contenido ({course.content.length})</h3>
            {course.content.map(content => (
              <div key={content.id}>
                <h4>{content.title}</h4>
                <p>Tipo: {content.contentType}</p>
                {content.contentUrl && (
                  <a href={content.contentUrl} target="_blank" rel="noopener noreferrer">
                    Ver contenido
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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

// Función para obtener cursos
export async function getSubscriptionCourses() {
  try {
    const response = await api.get<CourseWithContent[]>('/courses/subscription');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
      if (error.response?.status === 403) {
        throw new Error('No tienes una suscripción activa.');
      }
      throw new Error(error.response?.data?.message || 'Error al obtener cursos');
    }
    throw error;
  }
}

// Uso
getSubscriptionCourses()
  .then(courses => {
    console.log('Cursos:', courses);
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
```

---

### 4. cURL

```bash
curl -X GET "http://localhost:3000/courses/subscription" \
  -H "Authorization: Bearer TU_TOKEN_JWT_AQUI" \
  -H "Content-Type: application/json"
```

---

### 5. Postman/Insomnia

**Request:**
- Method: `GET`
- URL: `http://localhost:3000/courses/subscription`
- Headers:
  - `Authorization`: `Bearer TU_TOKEN_JWT_AQUI`
  - `Content-Type`: `application/json`

---

## Ejemplo de Respuesta Exitosa (200 OK)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Curso de Entrenamiento Funcional",
    "slug": "curso-entrenamiento-funcional",
    "description": "Aprende los fundamentos del entrenamiento funcional",
    "thumbnailUrl": "https://melli.fydeli.com/courses/thumbnail.jpg",
    "trailerUrl": "https://melli.fydeli.com/courses/trailer.mp4",
    "level": "beginner",
    "durationMinutes": 120,
    "isPublished": true,
    "publishedAt": "2024-01-15T10:00:00.000Z",
    "sortOrder": 1,
    "metadata": null,
    "creator": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Juan Pérez",
      "slug": "juan-perez"
    },
    "createdAt": "2024-01-10T08:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "content": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440002",
        "title": "Introducción al Entrenamiento Funcional",
        "slug": "introduccion-entrenamiento-funcional",
        "description": "Primera lección del curso",
        "contentType": "video",
        "unlockValue": 0,
        "unlockType": "immediate",
        "contentUrl": "https://melli.fydeli.com/courses/content/video1.mp4",
        "thumbnailUrl": "https://melli.fydeli.com/courses/content/thumb1.jpg",
        "durationSeconds": 1800,
        "sortOrder": 1,
        "availabilityType": "none",
        "resources": [
          {
            "id": "880e8400-e29b-41d4-a716-446655440003",
            "title": "Guía de ejercicios",
            "description": "PDF con ejercicios recomendados",
            "resourceUrl": "https://melli.fydeli.com/courses/resources/guia.pdf",
            "createdAt": "2024-01-15T10:00:00.000Z",
            "updatedAt": "2024-01-15T10:00:00.000Z"
          }
        ],
        "isPreview": false,
        "isActive": true,
        "course": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "title": "Curso de Entrenamiento Funcional",
          "slug": "curso-entrenamiento-funcional"
        },
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440004",
        "title": "Ejercicios Avanzados",
        "slug": "ejercicios-avanzados",
        "description": "Contenido desbloqueado después del primer mes",
        "contentType": "video",
        "unlockValue": 1,
        "unlockType": "month",
        "contentUrl": "https://melli.fydeli.com/courses/content/video2.mp4",
        "thumbnailUrl": "https://melli.fydeli.com/courses/content/thumb2.jpg",
        "durationSeconds": 2400,
        "sortOrder": 2,
        "availabilityType": "month",
        "resources": [],
        "isPreview": false,
        "isActive": true,
        "course": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "title": "Curso de Entrenamiento Funcional",
          "slug": "curso-entrenamiento-funcional"
        },
        "createdAt": "2024-01-15T10:00:00.000Z",
        "updatedAt": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
]
```

---

## Errores Posibles

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```
**Solución:** El token JWT es inválido o ha expirado. El usuario debe iniciar sesión nuevamente.

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "No tienes una suscripción activa"
}
```
**Solución:** El usuario no tiene una suscripción activa. Debe suscribirse primero.

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```
**Solución:** Error del servidor. Contactar al administrador.

---

## Notas Importantes

1. **Autenticación:** Siempre incluir el token JWT en el header `Authorization`.
2. **Roles:** Los usuarios con rol `admin` o `support` ven todo el contenido sin restricciones de desbloqueo.
3. **Filtros:** Todos los usuarios (incluidos admins) solo ven:
   - Cursos con `isPublished: true`
   - Contenido con `isActive: true`
4. **Desbloqueo:** El contenido se desbloquea según el mes de suscripción:
   - `immediate`: Disponible desde el inicio
   - `day`: Se convierte a meses (30 días = 1 mes)
   - `week`: Se convierte a meses (4 semanas = 1 mes)
   - `month`: Valor directo en meses
   - `year`: Se convierte a meses (1 año = 12 meses)

