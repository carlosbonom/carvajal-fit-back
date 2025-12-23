# Integración con Lioren API

Este módulo integra la API de Lioren para la emisión automática de boletas electrónicas cuando se confirma un pago exitoso de membresía.

## Funcionalidades

- ✅ Emisión automática de boletas electrónicas al confirmar pagos
- ✅ Descarga de PDF de boletas emitidas
- ✅ Envío automático de boletas adjuntas en el correo de bienvenida
- ✅ Soporte para WebPay, PayPal y Mercado Pago

## Configuración

### Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# API Key de Lioren
LIOREN_API_KEY=tu_api_key_lioren

# URL de la API (opcional, por defecto: https://www.lioren.cl/api)
LIOREN_API_URL=https://www.lioren.cl/api

# RUT por defecto si el usuario no tiene RUT (opcional)
LIOREN_DEFAULT_RUT=111111111
```

### Obtener Credenciales

1. Regístrate en [Lioren](https://www.lioren.cl)
2. Suscribe el módulo de Integración API
3. Obtén tu certificado digital vigente
4. Accede al panel de Lioren → API → Genera tu token de autenticación
5. Copia el token en `LIOREN_API_KEY`

## Flujo de Integración

1. **Pago Exitoso**: Cuando un pago de membresía se marca como completado (WebPay, PayPal o Mercado Pago)
2. **Generación de Boleta**: Se genera automáticamente una boleta electrónica usando la API de Lioren
3. **Descarga de PDF**: Se descarga el PDF de la boleta emitida
4. **Envío de Email**: La boleta se adjunta al correo de bienvenida que se envía al usuario

## Datos del Usuario

La boleta se genera con la siguiente información:

- **RUT**: Se obtiene del metadata del pago o suscripción, o se usa `LIOREN_DEFAULT_RUT`
- **Nombre**: Nombre del usuario o email si no hay nombre
- **Email**: Email del usuario
- **Dirección/Comuna/Ciudad**: Del metadata del pago o suscripción (opcional)
- **Teléfono**: Teléfono del usuario (opcional)

### Importante sobre el RUT

**En producción, asegúrate de capturar el RUT del usuario durante el registro o checkout** y guardarlo en el metadata del pago o suscripción. Si el usuario no tiene RUT, se usará el valor de `LIOREN_DEFAULT_RUT` o un RUT genérico.

## Uso del Servicio

El servicio `LiorenService` se inyecta automáticamente en `SubscriptionsService` y se usa internamente. No necesitas llamarlo manualmente.

### Métodos Disponibles

```typescript
// Emitir una boleta
const boleta = await liorenService.emitirBoleta(boletaData);

// Obtener PDF de una boleta
const pdf = await liorenService.obtenerPDFBoleta(boletaId);

// Consultar una boleta
const boletaInfo = await liorenService.consultarBoleta(boletaId);

// Generar boleta para membresía (método helper)
const { boleta, pdf } = await liorenService.generarBoletaMembresia(usuario, pago);
```

## Manejo de Errores

Si hay un error al generar la boleta:
- El error se registra en los logs
- **No se interrumpe el flujo de activación de la suscripción**
- El correo de bienvenida se envía sin la boleta adjunta
- El usuario puede solicitar la boleta manualmente si es necesario

## Notas Importantes

1. **Certificado Digital**: Necesitas un certificado digital vigente del representante legal
2. **Situación Tributaria**: Tu empresa debe estar al día con el SII
3. **Entorno de Pruebas**: Lioren ofrece un entorno de pruebas gratuito
4. **RUT del Usuario**: Es importante capturar el RUT durante el registro/checkout

## Solución de Problemas

### Error: "LIOREN_API_KEY no está configurado"
- Verifica que la variable está en el archivo `.env`
- Reinicia el servidor después de agregar la variable

### Error al emitir boleta
- Verifica que el RUT del usuario es válido
- Verifica que tu certificado digital está vigente
- Revisa los logs para más detalles del error

### La boleta no se genera
- Verifica que `LIOREN_API_KEY` está configurado
- Verifica que tienes permisos para emitir boletas en Lioren
- Revisa los logs del servidor para ver el error específico

## Documentación Adicional

- [Documentación API de Lioren](https://www.lioren.cl/docs#/api-intro)
- [Solución de Facturación Electrónica](https://www.lioren.cl/soluciones/api-boleta-y-factura-electronica)





