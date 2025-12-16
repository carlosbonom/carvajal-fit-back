import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EmailTemplate } from '../database/entities/email-template.entity';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SendEmailDto, EmailRecipientDto } from './dto/send-email.dto';

@Injectable()
export class MarketingService {
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
      const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL') || 'noreply@carvajalfit.com';
      const fromName = this.configService.get<string>('RESEND_FROM_NAME') || 'Club Carvajal Fit';
      const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3000';

      const htmlContent = `
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
                Hola ${userName || 'Miembro'},
              </h2>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                ¡Estamos emocionados de darte la bienvenida al <strong>Club Carvajal Fit</strong>!
              </p>
              
              <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Tu suscripción al plan <strong>${planName}</strong> ha sido activada exitosamente. 
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
                    <a href="${appUrl}/club" style="display: inline-block; background-color: #00b2de; color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; transition: background-color 0.3s;">
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
                © ${new Date().getFullYear()} Club Carvajal Fit. Todos los derechos reservados.
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

      const emailOptions: any = {
        from: `${fromName} <${fromEmail}>`,
        to: userEmail,
        subject: `¡Bienvenido al Club Carvajal Fit! 🎉`,
        html: htmlContent,
      };

      // Agregar adjuntos si existen
      // Resend acepta adjuntos como Buffer o base64 string
      if (attachments && attachments.length > 0) {
        emailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content, // Buffer se puede pasar directamente
        }));
      }

      await this.resend.emails.send(emailOptions);

      console.log(`Email de bienvenida enviado a ${userEmail}`);
    } catch (error: any) {
      console.error(`Error al enviar email de bienvenida a ${userEmail}:`, error);
      // No lanzamos error para no interrumpir el flujo de activación de suscripción
    }
  }
}

