export const getSubscriptionReminderTemplate = (
  userName: string,
  daysToWait: number,
  paymentLink: string,
  isExpired: boolean,
  isSuspended: boolean = false,
) => {
  let title = '';
  let message = '';
  let buttonLabel = 'Renovar Membresía';

  if (isSuspended) {
    title = 'Suscripción Suspendida 🚫';
    message = `Hola ${userName}, lamentamos informarte que tu suscripción ha sido suspendida debido a que no recibimos el pago tras varios intentos. Para recuperar el acceso, por favor realiza el pago en el siguiente enlace.`;
    buttonLabel = 'Reactivar Membresía';
  } else if (isExpired) {
    if (daysToWait === 0) {
      title = 'Tu suscripción vence hoy ⏳';
      message = `Hola ${userName}, hoy vence tu suscripción al Club Carvajal Fit. No pierdas tu progreso y renueva hoy mismo para seguir disfrutando del contenido exclusivo.`;
    } else {
      title = `Suscripción vencida hace ${daysToWait} día(s) ⚠️`;
      message = `Hola ${userName}, tu suscripción ha vencido. Te recordamos que tienes un plazo de gracia para realizar el pago antes de que el acceso sea suspendido. ¡No te quedes fuera!`;
    }
  } else {
    title = 'Tu suscripción vence mañana 🔔';
    message = `Hola ${userName}, te recordamos que tu suscripción al Club Carvajal Fit vencerá el día de mañana. Asegúrate de tener saldo en tu medio de pago o realiza la renovación manualmente.`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${isSuspended ? '#ff4b2b 0%, #ff416c' : '#00b2de 0%, #00a0c8'} 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                ${title}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ${message}
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${paymentLink}" style="display: inline-block; background-color: ${isSuspended ? '#ff4b2b' : '#00b2de'}; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background-color 0.3s;">
                      ${buttonLabel}
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Si ya realizaste el pago, por favor ignora este correo. El acceso se actualizará automáticamente.
              </p>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                El equipo de <strong>Club Carvajal Fit</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <p style="color: #666666; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Club Carvajal Fit. Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};
