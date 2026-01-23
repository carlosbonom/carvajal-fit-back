import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SendEmailDto, EmailRecipientDto } from './dto/send-email.dto';

@Injectable()
export class MarketingService implements OnModuleInit {
  private resend: Resend;

  constructor(
    @InjectRepository(EmailTemplate)
    private emailTemplateRepository: Repository<EmailTemplate>,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      console.warn('RESEND_API_KEY no está configurado. El envío de emails no funcionará.');
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  async onModuleInit() {
    await this.seedWelcomeTemplate();
  }

  private async seedWelcomeTemplate() {
    try {
      const welcomeTemplate = await this.emailTemplateRepository.findOne({
        where: { isLocked: true, name: 'Bienvenida (Protegida)' },
      });

      if (!welcomeTemplate) {
        console.log('Sembrando plantilla de bienvenida predeterminada...');
        const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';

        const defaultHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido al Club Carvajal Fit!</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00b2de 0%, #00a0c8 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: bold;">
                ¡Bienvenido al Club! 🎉
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">
                Hola {{nombre}},
              </h2>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ¡Estamos emocionados de darte la bienvenida al <strong>Club Carvajal Fit</strong>!
              </p>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Tu suscripción al plan <strong>{{plan}}</strong> ha sido activada exitosamente. 
                Ahora tienes acceso completo a todo el contenido exclusivo del club.
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #00b2de; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0; font-weight: bold;">
                  ¿Qué puedes hacer ahora?
                </p>
                <ul style="color: #666666; font-size: 15px; line-height: 1.8; margin: 15px 0 0 0; padding-left: 20px;">
                  <li>Acceder a todos los planes de entrenamiento exclusivos</li>
                  <li>Ver videos de ejercicios y rutinas personalizadas</li>
                  <li>Descargar guías nutricionales y recetas</li>
                  <li>Unirte a la comunidad de WhatsApp</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="{{app_url}}/club" style="display: inline-block; background-color: #00b2de; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background-color 0.3s;">
                      Entrar al Club
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Si tienes alguna pregunta o necesitas ayuda, no dudes en contactarnos.
              </p>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                ¡A por tus objetivos! 💪
              </p>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                El equipo de <strong>Club Carvajal Fit</strong>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1a1a1a; padding: 30px; text-align: center;">
              <p style="color: #999999; font-size: 12px; margin: 0 0 10px 0;">
                © {{año}} Club Carvajal Fit. Todos los derechos reservados.
              </p>
              <p style="color: #666666; font-size: 12px; margin: 0;">
                Este es un email automático, por favor no respondas a este mensaje.
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

        await this.emailTemplateRepository.save({
          name: 'Bienvenida (Protegida)',
          subject: '¡Bienvenido al Club Carvajal Fit! 🎉',
          htmlContent: defaultHtml,
          isLocked: true,
          design: null, // Se puede editar luego en Unlayer
        });
        console.log('Plantilla de bienvenida sembrada exitosamente');
      }
    } catch (error) {
      console.error('Error al sembrar plantilla de bienvenida:', error);
    }
  }

  async findAll(): Promise<EmailTemplate[]> {
    return this.emailTemplateRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<EmailTemplate> {
    const template = await this.emailTemplateRepository.findOne({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Plantilla con ID ${id} no encontrada`);
    }

    return template;
  }

  async create(createDto: CreateEmailTemplateDto): Promise<EmailTemplate> {
    const template = this.emailTemplateRepository.create(createDto);
    return this.emailTemplateRepository.save(template);
  }

  async update(id: string, updateDto: UpdateEmailTemplateDto): Promise<EmailTemplate> {
    const template = await this.findOne(id);

    Object.assign(template, updateDto);
    return this.emailTemplateRepository.save(template);
  }

  async remove(id: string): Promise<void> {
    const template = await this.findOne(id);
    if (template.isLocked) {
      throw new BadRequestException('Esta plantilla está protegida y no puede ser eliminada');
    }
    await this.emailTemplateRepository.remove(template);
  }

  /**
   * Reemplaza las variables en el contenido HTML usando el formato {{variable}}
   */
  private replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    return result;
  }

  /**
   * Envía emails masivos usando Resend
   */
  async sendBulkEmails(sendDto: SendEmailDto): Promise<{ success: number; failed: number; errors?: string[] }> {
    if (!this.resend) {
      throw new BadRequestException('RESEND_API_KEY no está configurado');
    }

    const template = await this.findOne(sendDto.templateId);
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Procesar emails en lotes para evitar rate limits
    const batchSize = 10;
    for (let i = 0; i < sendDto.recipients.length; i += batchSize) {
      const batch = sendDto.recipients.slice(i, i + batchSize);

      const promises = batch.map(async (recipient: EmailRecipientDto) => {
        try {
          // Preparar variables para reemplazo
          // Primero el spread para incluir todos los campos, luego normalizamos campos específicos
          const variables: Record<string, any> = {
            ...recipient, // Incluir todos los campos adicionales del Excel
            email: recipient.email, // Asegurar que email esté presente
            nombre: recipient.name || recipient.nombre || '', // Normalizar nombre
          };

          // Reemplazar variables en el contenido y subject
          const htmlContent = this.replaceVariables(template.htmlContent, variables);
          const subject = sendDto.subject
            ? this.replaceVariables(sendDto.subject, variables)
            : this.replaceVariables(template.subject, variables);

          // Enviar email usando Resend
          await this.resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: recipient.email,
            subject: subject,
            html: htmlContent,
          });

          success++;
        } catch (error: any) {
          failed++;
          const errorMessage = `Error enviando a ${recipient.email}: ${error.message || 'Error desconocido'}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      });

      await Promise.all(promises);

      // Pequeña pausa entre lotes para evitar rate limits
      if (i + batchSize < sendDto.recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Envía un email de bienvenida al club cuando se activa una suscripción
   */
  async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    planName: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    if (!this.resend) {
      console.warn('RESEND_API_KEY no está configurado. No se enviará el email de bienvenida.');
      return;
    }

    try {
      // Buscar la plantilla de bienvenida protegida
      const template = await this.emailTemplateRepository.findOne({
        where: { isLocked: true, name: 'Bienvenida (Protegida)' },
      });

      const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
      const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';
      const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';

      const variables = {
        nombre: userName || 'Miembro',
        plan: planName,
        app_url: appUrl,
        año: new Date().getFullYear().toString(),
      };

      let htmlContent: string;
      let subject: string;

      if (template) {
        htmlContent = this.replaceVariables(template.htmlContent, variables);
        subject = this.replaceVariables(template.subject, variables);
      } else {
        // Fallback en caso de que la búsqueda falle por alguna razón
        console.warn('Usando fallback para el email de bienvenida (plantilla no encontrada)');
        htmlContent = this.getFallbackWelcomeHtml(variables);
        subject = '¡Bienvenido al Club Carvajal Fit! 🎉';
      }

      const emailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: userEmail,
        subject,
        html: htmlContent,
      };

      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
        }));
      }

      await this.resend.emails.send(emailOptions);
      console.log(`Email de bienvenida enviado a ${userEmail}`);
    } catch (error: any) {
      console.error(`Error al enviar email de bienvenida a ${userEmail}:`, error);
    }
  }

  /**
   * Proporciona un HTML de respaldo para el email de bienvenida
   */
  private getFallbackWelcomeHtml(v: any): string {
    return `
      <h1>¡Bienvenido al Club! 🎉</h1>
      <p>Hola ${v.nombre}, estamos felices de verte por aquí.</p>
      <p>Tu plan <strong>${v.plan}</strong> ya está activo.</p>
      <p><a href="${v.app_url}/club">Ir al Club</a></p>
    `;
  }

  /**
   * Envía un email genérico usando Resend
   */
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      console.warn('RESEND_API_KEY no está configurado. No se enviará el email.');
      return;
    }

    try {
      const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
      const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

      await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject,
        html,
      });

      console.log(`Email enviado exitosamente a ${to}`);
    } catch (error: any) {
      console.error(`Error al enviar email a ${to}:`, error);
      throw error;
    }
  }
  /**
   * Envía un email de migración con enlace para restablecer contraseña
   */
  async sendMigrationEmail(
    email: string,
    name: string,
    resetCode: string,
  ): Promise<void> {
    if (!this.resend) {
      console.warn('RESEND_API_KEY no está configurado. No se enviará el email de migración.');
      return;
    }

    const appUrl = this.configService.get<string>('APP_URL') || 'https://carvajalfit.com';
    const resetLink = `${appUrl}/recuperar-password?email=${encodeURIComponent(email)}&code=${resetCode}&mode=verify`;
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    try {
      await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: 'Importante: Actualización de tu cuenta Club Carvajal Fit',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Actualización de cuenta</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #00b2de 0%, #00a0c8 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                 ¡Mejoramos para ti! 🚀
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">
                Hola ${name || 'Miembro'},
              </h2>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Hemos actualizado nuestra plataforma para ofrecerte una mejor experiencia en el <strong>Club Carvajal Fit</strong>.
              </p>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Tu suscripción sigue activa, pero por seguridad necesitamos que configures una nueva contraseña para acceder a la nueva plataforma.
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background-color: #00b2de; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background-color 0.3s;">
                      Configurar Contraseña e Ingresar
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
              </p>
              <p style="color: #00b2de; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0; word-break: break-all;">
                ${resetLink}
              </p>
              
              <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                Tu código de verificación es: <strong>${resetCode}</strong> (ya incluido en el enlace).
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
        `
      });
      console.log(`Email de migración enviado a ${email}`);
    } catch (error) {
      console.error(`Error enviando email de migración a ${email}:`, error);
    }
  }

  /**
   * Envía notificaciones de migración masivas a múltiples usuarios
   * Informa sobre la nueva página y les pide que recuperen su contraseña
   */
  async sendMigrationNotificationBulk(
    recipients: Array<{ email: string; name: string }>,
  ): Promise<{ success: number; failed: number; errors?: string[] }> {
    if (!this.resend) {
      throw new BadRequestException('RESEND_API_KEY no está configurado');
    }

    const loginUrl = 'https://carvajalfit.com/login';
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    // Leer el template HTML desde el archivo
    const fs = require('fs');
    const path = require('path');
    const templatePath = path.join(__dirname, 'templates', 'migration-notification.html');
    let htmlTemplate: string;

    try {
      htmlTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch (error) {
      console.error('Error leyendo template de migración:', error);
      throw new BadRequestException('No se pudo cargar el template de email');
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    // Procesar emails en lotes para evitar rate limits
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);

      const promises = batch.map(async (recipient) => {
        try {
          // Reemplazar variables en el template
          const variables = {
            name: recipient.name || 'Miembro',
            email: recipient.email,
            loginUrl: loginUrl,
            year: new Date().getFullYear().toString(),
          };

          const htmlContent = this.replaceVariables(htmlTemplate, variables);

          await this.resend.emails.send({
            from: `${fromName} <${fromEmail}>`,
            to: recipient.email,
            subject: '¡Importante! Nueva página de Club Carvajal Fit 🚀',
            html: htmlContent,
          });

          success++;
          console.log(`Email de notificación de migración enviado a ${recipient.email}`);
        } catch (error: any) {
          failed++;
          const errorMessage = `Error enviando a ${recipient.email}: ${error.message || 'Error desconocido'}`;
          errors.push(errorMessage);
          console.error(errorMessage, error);
        }
      });

      await Promise.all(promises);

      // Pequeña pausa entre lotes para evitar rate limits
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Envía un email con el producto digital comprado
   */
  async sendDigitalProductEmail(
    email: string,
    userName: string,
    productName: string,
    productLink: string,
    orderNumber: string,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    if (!this.resend) return;

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    try {
      const emailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: `Tu compra: ${productName} 📥`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tu producto digital</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #00b2de 0%, #00a0c8 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">¡Aquí está tu pedido! 📦</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin-top: 0;">Hola ${userName},</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Gracias por tu compra. Aquí tienes el acceso a tu producto digital <strong>${productName}</strong>.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${productLink}" style="background-color: #00b2de; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Acceder al Contenido
                </a>
              </div>

              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #00b2de;">
                <p style="margin: 0; font-size: 14px; color: #666;">
                  <strong>Orden:</strong> ${orderNumber}<br>
                  Si tienes problemas para acceder, responde a este correo.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      };

      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
        }));
      }

      await this.resend.emails.send(emailOptions);
      console.log(`Email de producto digital enviado a ${email}`);
    } catch (error) {
      console.error(`Error enviando email de producto digital a ${email}:`, error);
    }
  }

  /**
   * Envía confirmación de compra general
   */
  async sendPurchaseConfirmationEmail(
    email: string,
    userName: string,
    orderNumber: string,
    items: { name: string; quantity: number; price: number }[],
    total: number,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    if (!this.resend) return;

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    const itemsList = items.map(item => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 0; color: #333;">${item.name} x${item.quantity}</td>
        <td style="padding: 10px 0; text-align: right; color: #333;">$${item.price.toLocaleString('es-CL')}</td>
      </tr>
    `).join('');

    try {
      const emailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: `Confirmación de compra #${orderNumber} ✅`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Confirmación de Compra</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">¡Compra Exitosa! 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin-top: 0;">Hola ${userName},</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Hemos recibido tu pedido correctamente. A continuación los detalles de tu compra:
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr style="border-bottom: 2px solid #eee;">
                  <th align="left" style="padding: 10px 0; color: #666;">Producto</th>
                  <th align="right" style="padding: 10px 0; color: #666;">Precio</th>
                </tr>
                ${itemsList}
                <tr style="border-top: 2px solid #333;">
                  <td style="padding: 15px 0; font-weight: bold; color: #333;">Total</td>
                  <td style="padding: 15px 0; text-align: right; font-weight: bold; color: #333;">$${total.toLocaleString('es-CL')}</td>
                </tr>
              </table>

              <p style="color: #666; font-size: 14px;">
                Orden: <strong>${orderNumber}</strong><br>
                Fecha: ${new Date().toLocaleDateString('es-CL')}<br>
                Nos pondremos en contacto contigo pronto si hay productos físicos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      };

      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
        }));
      }

      await this.resend.emails.send(emailOptions);
      console.log(`Email de confirmación enviado a ${email}`);
    } catch (error) {
      console.error(`Error enviando confirmación a ${email}:`, error);
    }
  }

  /**
   * Envía notificación de pago de suscripción exitoso
   */
  async sendSubscriptionPaymentSuccessEmail(
    email: string,
    userName: string,
    planName: string,
    amount: number,
    nextPaymentDate: Date,
    attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>,
  ): Promise<void> {
    if (!this.resend) return;

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';
    const dateFormatted = new Date().toLocaleDateString('es-CL');
    const nextDateFormatted = nextPaymentDate.toLocaleDateString('es-CL');

    try {
      const emailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: `¡Pago Recibido! Tu suscripción sigue activa ✅`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pago Exitoso</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Pago Procesado con Éxito 🎉</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin-top: 0;">Hola ${userName},</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Hemos procesado correctamente el pago de tu suscripción <strong>${planName}</strong>.
                Tu acceso a todo el contenido exclusivo del Club Carvajal Fit sigue activo.
              </p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0; background-color: #f8f9fa; border-radius: 8px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 10px; color: #666;">Fecha de pago:</td>
                        <td style="padding-bottom: 10px; text-align: right; color: #333; font-weight: bold;">${dateFormatted}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 10px; color: #666;">Monto:</td>
                        <td style="padding-bottom: 10px; text-align: right; color: #333; font-weight: bold;">$${amount.toLocaleString('es-CL')}</td>
                      </tr>
                      <tr>
                        <td style="color: #666;">Próximo cobro:</td>
                        <td style="text-align: right; color: #333; font-weight: bold;">${nextDateFormatted}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="color: #999; font-size: 14px; text-align: center;">
                Gracias por mantenerte activo con nosotros.<br>
                ¡A seguir entrenando! 💪
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      };

      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
        }));
      }

      await this.resend.emails.send(emailOptions);
      console.log(`Email de pago exitoso enviado a ${email}`);
    } catch (error) {
      console.error(`Error enviando email de pago exitoso a ${email}:`, error);
    }
  }

  /**
   * Envía notificación de fallo de pago de suscripción
   */
  async sendSubscriptionPaymentFailedEmail(
    email: string,
    userName: string,
    planName: string,
    retryLink: string,
  ): Promise<void> {
    if (!this.resend) return;

    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
    const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';

    try {
      await this.resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: `Problema con tu pago de suscripción ⚠️`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Pago Fallido</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">No pudimos procesar tu pago ⚠️</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #333; margin-top: 0;">Hola ${userName},</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Tuvimos un problema al intentar procesar la renovación de tu suscripción <strong>${planName}</strong>.
              </p>
              
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Esto puede deberse a fondos insuficientes, tarjeta vencida o un bloqueo temporal del banco.
                Para evitar la suspensión de tu acceso, por favor actualiza tu método de pago lo antes posible.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${retryLink}" style="background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Actualizar Método de Pago
                </a>
              </div>

              <p style="color: #999; font-size: 14px; text-align: center;">
                Intentaremos procesar el pago nuevamente en unos días.<br>
                Si ya actualizaste tus datos, ignora este mensaje.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      });
      console.log(`Email de pago fallido enviado a ${email}`);
    } catch (error) {
      console.error(`Error enviando email de pago fallido a ${email}:`, error);
    }
  }
}

