# 📱 Guía de Integración Frontend - Sistema de Suscripciones

Esta guía te ayudará a integrar el sistema de suscripciones con Mercado Pago en tu frontend.

## 📋 Tabla de Contenidos

1. [Configuración Inicial](#configuración-inicial)
2. [Endpoints Disponibles](#endpoints-disponibles)
3. [Flujo Completo de Suscripción](#flujo-completo-de-suscripción)
4. [Ejemplos de Código](#ejemplos-de-código)
5. [Manejo de Errores](#manejo-de-errores)
6. [Estados y Validaciones](#estados-y-validaciones)

---

## 🔧 Configuración Inicial

### Variables de Entorno

Crea un archivo `.env` en tu proyecto frontend:

```env
VITE_API_URL=http://localhost:3000
# o
REACT_APP_API_URL=http://localhost:3000
```

### Instalación de Dependencias (si usas fetch nativo, no necesitas nada)

```bash
# Si usas axios
npm install axios

# Si usas fetch nativo (incluido en navegadores modernos), no necesitas instalar nada
```

---

## 🌐 Endpoints Disponibles

### Base URL
```
http://localhost:3000  # Desarrollo
https://tu-dominio.com # Producción
```

### Endpoints

| Método | Endpoint | Autenticación | Descripción |
|--------|----------|---------------|-------------|
| GET | `/subscriptions/plans` | ❌ Público | Obtener planes disponibles |
| POST | `/subscriptions/subscribe` | ✅ Requerida | Crear suscripción |
| GET | `/auth/me` | ✅ Requerida | Obtener perfil del usuario (incluye suscripción) |
| POST | `/subscriptions/cancel` | ✅ Requerida | Cancelar suscripción |
| GET | `/subscriptions/payments` | ✅ Requerida | Obtener historial de pagos |
| POST | `/subscriptions/webhook` | ❌ Público | Webhook (solo Mercado Pago) |

---

## 🔄 Flujo Completo de Suscripción

```
1. Usuario ve planes disponibles
   ↓
2. Usuario selecciona plan y ciclo de facturación
   ↓
3. Usuario hace clic en "Suscribirse"
   ↓
4. Frontend llama a POST /subscriptions/subscribe
   ↓
5. Backend retorna initPoint de Mercado Pago
   ↓
6. Frontend redirige al usuario a initPoint
   ↓
7. Usuario autoriza pago en Mercado Pago
   ↓
8. Mercado Pago redirige de vuelta (backUrl)
   ↓
9. Frontend verifica estado de suscripción (GET /auth/me)
   ↓
10. Usuario puede gestionar su suscripción
```

---

## 💻 Ejemplos de Código

### 1. Servicio API (Cliente HTTP)

#### Con Fetch API (Nativo)

```typescript
// services/api.ts
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(error.message || `Error ${response.status}`);
    }

    return response.json();
  }

  // Obtener planes disponibles
  async getPlans() {
    return this.request<{ plans: SubscriptionPlan[] }>('/subscriptions/plans');
  }

  // Crear suscripción
  async createSubscription(data: CreateSubscriptionDto) {
    return this.request<SubscriptionResponse>('/subscriptions/subscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Obtener perfil del usuario (incluye suscripción)
  async getProfile() {
    return this.request<{ 
      id: string;
      email: string;
      name: string;
      role: string;
      subscription: UserSubscription | null;
      // ... otros campos del usuario
    }>('/auth/me');
  }

  // Cancelar suscripción
  async cancelSubscription(reason?: string) {
    return this.request<CancelSubscriptionResponse>('/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Obtener pagos
  async getPayments() {
    return this.request<{ payments: SubscriptionPayment[] }>('/subscriptions/payments');
  }
}

export const apiService = new ApiService();
```

#### Con Axios

```typescript
// services/api.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message;
    throw new Error(message);
  }
);

export const subscriptionApi = {
  getPlans: () => apiClient.get<{ plans: SubscriptionPlan[] }>('/subscriptions/plans'),
  
  createSubscription: (data: CreateSubscriptionDto) =>
    apiClient.post<SubscriptionResponse>('/subscriptions/subscribe', data),
  
  getProfile: () =>
    apiClient.get<{ 
      id: string;
      email: string;
      name: string;
      role: string;
      subscription: UserSubscription | null;
      // ... otros campos del usuario
    }>('/auth/me'),
  
  cancelSubscription: (reason?: string) =>
    apiClient.post<CancelSubscriptionResponse>('/subscriptions/cancel', { reason }),
  
  getPayments: () =>
    apiClient.get<{ payments: SubscriptionPayment[] }>('/subscriptions/payments'),
};
```

### 2. Tipos TypeScript

```typescript
// types/subscription.ts

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  features: string[];
  prices: SubscriptionPrice[];
}

export interface SubscriptionPrice {
  id: string;
  currency: string;
  amount: number;
  billingCycle: BillingCycle;
}

export interface BillingCycle {
  id: string;
  name: string;
  slug: string;
  intervalType: 'day' | 'week' | 'month' | 'year';
  intervalCount: number;
}

export interface CreateSubscriptionDto {
  planId: string;
  billingCycleId: string;
  currency?: string;
  payerEmail?: string;
  payerFirstName?: string;
  payerLastName?: string;
  payerIdentificationType?: string;
  payerIdentificationNumber?: string;
  backUrl?: string;
}

export interface SubscriptionResponse {
  id: string;
  status: 'active' | 'cancelled' | 'expired' | 'paused' | 'payment_failed';
  mercadoPagoSubscriptionId: string;
  initPoint: string;
  message: string;
}

export interface UserSubscription {
  id: string;
  status: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  autoRenew: boolean;
  cancellationReason?: string;
  mercadoPagoSubscriptionId?: string;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPayment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod?: string;
  paymentProvider?: string;
  transactionId?: string;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
  createdAt: string;
}
```

### 3. Componente React - Lista de Planes

```tsx
// components/SubscriptionPlans.tsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { SubscriptionPlan } from '../types/subscription';

export function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPlans();
      setPlans(response.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar planes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string, billingCycleId: string, currency: string) => {
    try {
      const response = await apiService.createSubscription({
        planId,
        billingCycleId,
        currency,
        backUrl: `${window.location.origin}/subscription/success`,
      });

      // Redirigir al usuario a Mercado Pago
      if (response.initPoint) {
        window.location.href = response.initPoint;
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear suscripción');
    }
  };

  if (loading) return <div>Cargando planes...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="plans-container">
      {plans.map((plan) => (
        <div key={plan.id} className="plan-card">
          <h2>{plan.name}</h2>
          <p>{plan.description}</p>
          
          <ul>
            {plan.features.map((feature, index) => (
              <li key={index}>{feature}</li>
            ))}
          </ul>

          <div className="prices">
            {plan.prices.map((price) => (
              <div key={price.id} className="price-option">
                <div className="amount">
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: price.currency,
                  }).format(price.amount)}
                </div>
                <div className="billing-cycle">{price.billingCycle.name}</div>
                <button
                  onClick={() => handleSubscribe(plan.id, price.billingCycle.id, price.currency)}
                >
                  Suscribirse
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### 4. Componente React - Mi Suscripción

```tsx
// components/MySubscription.tsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { UserSubscription } from '../types/subscription';

export function MySubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      // Obtener perfil del usuario que incluye la suscripción
      const response = await apiService.getProfile();
      setSubscription(response.subscription);
    } catch (err) {
      console.error('Error al cargar suscripción:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar tu suscripción?')) {
      return;
    }

    const reason = prompt('Motivo de cancelación (opcional):');

    try {
      setCancelling(true);
      await apiService.cancelSubscription(reason || undefined);
      await loadSubscription(); // Recargar para ver el estado actualizado
      alert('Suscripción cancelada exitosamente');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cancelar suscripción');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div>Cargando...</div>;
  if (!subscription) return <div>No tienes una suscripción activa</div>;

  const isActive = subscription.status === 'active';
  const isCancelled = subscription.status === 'cancelled';

  return (
    <div className="subscription-details">
      <h2>Mi Suscripción</h2>
      
      <div className="subscription-info">
        <div>
          <strong>Plan:</strong> {subscription.plan.name}
        </div>
        <div>
          <strong>Estado:</strong> 
          <span className={`status status-${subscription.status}`}>
            {subscription.status}
          </span>
        </div>
        <div>
          <strong>Ciclo de facturación:</strong> {subscription.billingCycle.name}
        </div>
        <div>
          <strong>Período actual:</strong>
          <br />
          Desde: {new Date(subscription.currentPeriodStart).toLocaleDateString()}
          <br />
          Hasta: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </div>
        {subscription.cancelledAt && (
          <div>
            <strong>Cancelada el:</strong>{' '}
            {new Date(subscription.cancelledAt).toLocaleDateString()}
          </div>
        )}
      </div>

      {isActive && (
        <button onClick={handleCancel} disabled={cancelling}>
          {cancelling ? 'Cancelando...' : 'Cancelar Suscripción'}
        </button>
      )}

      {isCancelled && (
        <div className="alert alert-info">
          Tu suscripción ha sido cancelada. Podrás seguir usando el servicio hasta el final del período actual.
        </div>
      )}
    </div>
  );
}
```

### 5. Componente React - Historial de Pagos

```tsx
// components/PaymentHistory.tsx
import { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { SubscriptionPayment } from '../types/subscription';

export function PaymentHistory() {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await apiService.getPayments();
      setPayments(response.payments);
    } catch (err) {
      console.error('Error al cargar pagos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Cargando pagos...</div>;

  return (
    <div className="payment-history">
      <h2>Historial de Pagos</h2>
      
      {payments.length === 0 ? (
        <p>No hay pagos registrados</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Período</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  {payment.paidAt
                    ? new Date(payment.paidAt).toLocaleDateString()
                    : new Date(payment.createdAt).toLocaleDateString()}
                </td>
                <td>
                  {new Intl.NumberFormat('es-CL', {
                    style: 'currency',
                    currency: payment.currency,
                  }).format(payment.amount)}
                </td>
                <td>
                  <span className={`status status-${payment.status}`}>
                    {payment.status}
                  </span>
                </td>
                <td>
                  {new Date(payment.periodStart).toLocaleDateString()} -{' '}
                  {new Date(payment.periodEnd).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

### 6. Página de Éxito (Callback de Mercado Pago)

```tsx
// pages/SubscriptionSuccess.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import { UserSubscription } from '../types/subscription';

export function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSubscriptionStatus();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      // Esperar un momento para que el webhook procese la notificación
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Obtener perfil del usuario que incluye la suscripción
      const response = await apiService.getProfile();
      setSubscription(response.subscription);
    } catch (err) {
      console.error('Error al verificar suscripción:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="success-page">
        <h2>Procesando tu suscripción...</h2>
        <p>Por favor espera un momento mientras verificamos el estado de tu pago.</p>
      </div>
    );
  }

  const isActive = subscription?.status === 'active';
  const isPending = subscription?.status === 'payment_failed';

  return (
    <div className="success-page">
      {isActive ? (
        <>
          <h2>¡Suscripción Activada! 🎉</h2>
          <p>Tu suscripción ha sido activada exitosamente.</p>
          <button onClick={() => navigate('/subscription')}>
            Ver Mi Suscripción
          </button>
        </>
      ) : isPending ? (
        <>
          <h2>Pago Pendiente</h2>
          <p>Tu suscripción está pendiente de autorización. Recibirás una notificación cuando se procese.</p>
          <button onClick={() => navigate('/subscription')}>
            Ver Estado
          </button>
        </>
      ) : (
        <>
          <h2>Error en el Pago</h2>
          <p>Hubo un problema al procesar tu pago. Por favor intenta nuevamente.</p>
          <button onClick={() => navigate('/plans')}>
            Volver a Planes
          </button>
        </>
      )}
    </div>
  );
}
```

### 7. Hook Personalizado (React)

```tsx
// hooks/useSubscription.ts
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { UserSubscription, SubscriptionPlan } from '../types/subscription';

export function useSubscription() {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      // Obtener perfil del usuario que incluye la suscripción
      const response = await apiService.getProfile();
      setSubscription(response.subscription);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar suscripción');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const cancelSubscription = async (reason?: string) => {
    try {
      await apiService.cancelSubscription(reason);
      await loadSubscription();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar suscripción');
      return false;
    }
  };

  return {
    subscription,
    loading,
    error,
    reload: loadSubscription,
    cancel: cancelSubscription,
    isActive: subscription?.status === 'active',
    isCancelled: subscription?.status === 'cancelled',
  };
}
```

---

## ⚠️ Manejo de Errores

### Códigos de Error Comunes

```typescript
// utils/errorHandler.ts
export function handleSubscriptionError(error: any): string {
  if (error.response) {
    // Error de respuesta del servidor
    const status = error.response.status;
    const message = error.response.data?.message || 'Error desconocido';

    switch (status) {
      case 400:
        return `Error en la solicitud: ${message}`;
      case 401:
        return 'No estás autenticado. Por favor inicia sesión.';
      case 404:
        return 'Recurso no encontrado';
      case 409:
        return 'Ya tienes una suscripción activa';
      case 500:
        return 'Error del servidor. Por favor intenta más tarde.';
      default:
        return message;
    }
  } else if (error.request) {
    // Error de red
    return 'Error de conexión. Verifica tu internet.';
  } else {
    // Otro error
    return error.message || 'Error desconocido';
  }
}
```

---

## 📊 Estados y Validaciones

### Estados de Suscripción

```typescript
type SubscriptionStatus = 
  | 'active'           // Suscripción activa
  | 'cancelled'        // Cancelada por el usuario
  | 'expired'          // Expirada
  | 'paused'           // Pausada
  | 'payment_failed';  // Fallo en el pago
```

### Validaciones en el Frontend

```typescript
// utils/validation.ts
export function validateSubscriptionData(data: CreateSubscriptionDto): string | null {
  if (!data.planId) {
    return 'Debes seleccionar un plan';
  }
  
  if (!data.billingCycleId) {
    return 'Debes seleccionar un ciclo de facturación';
  }

  if (data.payerEmail && !isValidEmail(data.payerEmail)) {
    return 'Email inválido';
  }

  return null;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

---

## 🎨 Ejemplo de Estilos CSS

```css
/* styles/subscription.css */
.plans-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem;
}

.plan-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1.5rem;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.plan-card h2 {
  margin-top: 0;
  color: #333;
}

.price-option {
  margin: 1rem 0;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
}

.price-option .amount {
  font-size: 2rem;
  font-weight: bold;
  color: #007bff;
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: bold;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-cancelled {
  background: #f8d7da;
  color: #721c24;
}

.status-payment_failed {
  background: #fff3cd;
  color: #856404;
}
```

---

## 🔐 Autenticación

Asegúrate de tener el token de autenticación guardado:

```typescript
// Después de login
localStorage.setItem('access_token', response.accessToken);

// Al hacer logout
localStorage.removeItem('access_token');
```

---

## 📝 Checklist de Implementación

- [ ] Configurar variables de entorno
- [ ] Crear servicio API
- [ ] Definir tipos TypeScript
- [ ] Implementar componente de planes
- [ ] Implementar componente de suscripción
- [ ] Implementar página de éxito/callback
- [ ] Agregar manejo de errores
- [ ] Agregar validaciones
- [ ] Implementar estilos
- [ ] Probar flujo completo

---

## 🚀 Ejemplo de Uso Completo

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SubscriptionPlans } from './components/SubscriptionPlans';
import { MySubscription } from './components/MySubscription';
import { PaymentHistory } from './components/PaymentHistory';
import { SubscriptionSuccess } from './pages/SubscriptionSuccess';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/plans" element={<SubscriptionPlans />} />
        <Route path="/subscription" element={<MySubscription />} />
        <Route path="/payments" element={<PaymentHistory />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 📞 Soporte

Si tienes problemas con la integración, verifica:

1. ✅ El token de autenticación está guardado correctamente
2. ✅ La URL de la API es correcta
3. ✅ Los headers están configurados correctamente
4. ✅ El webhook está configurado en Mercado Pago
5. ✅ La `backUrl` apunta a tu dominio

¡Listo! Con esta guía puedes integrar completamente el sistema de suscripciones en tu frontend. 🎉

