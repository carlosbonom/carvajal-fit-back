import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface LiorenBoletaRequest {
  tipo: 'boleta' | 'factura';
  folio?: number; // Opcional, si no se proporciona se auto-asigna
  fecha_emision: string; // Formato: YYYY-MM-DD
  fecha_vencimiento?: string; // Formato: YYYY-MM-DD
  receptor: {
    rut: string; // Sin puntos ni guión, ej: "123456789"
    razon_social: string;
    giro?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    email?: string;
    telefono?: string;
  };
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    descuento?: number;
    codigo?: string;
  }>;
  descuento_global?: number;
  referencia?: string;
  observaciones?: string;
}

export interface LiorenBoletaResponse {
  id: number;
  folio: number;
  tipo: string;
  estado: string;
  pdf_url?: string;
  xml_url?: string;
}

@Injectable()
export class LiorenService {
  private readonly logger = new Logger(LiorenService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('LIOREN_API_URL') || 'https://www.lioren.cl/api';
    this.apiKey = this.configService.get<string>('LIOREN_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('LIOREN_API_KEY no está configurado. La emisión de boletas no funcionará.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      timeout: 30000, // 30 segundos
    });
  }

  /**
   * Emite una boleta electrónica
   */
  async emitirBoleta(boletaData: LiorenBoletaRequest): Promise<LiorenBoletaResponse> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    try {
      this.logger.log(`Emitiendo boleta para RUT: ${boletaData.receptor.rut}`);

      const response = await this.axiosInstance.post<LiorenBoletaResponse>(
        '/boletas',
        boletaData,
      );

      this.logger.log(`Boleta emitida exitosamente. Folio: ${response.data.folio}, ID: ${response.data.id}`);

      return response.data;
    } catch (error: any) {
      this.logger.error('Error al emitir boleta:', error.response?.data || error.message);
      
      if (error.response?.data) {
        throw new BadRequestException(
          `Error al emitir boleta: ${JSON.stringify(error.response.data)}`,
        );
      }
      
      throw new BadRequestException(
        `Error al emitir boleta: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene el PDF de una boleta emitida
   */
  async obtenerPDFBoleta(boletaId: number): Promise<Buffer> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    try {
      this.logger.log(`Obteniendo PDF de boleta ID: ${boletaId}`);

      const response = await this.axiosInstance.get(`/boletas/${boletaId}/pdf`, {
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data, 'binary');
    } catch (error: any) {
      this.logger.error('Error al obtener PDF de boleta:', error.response?.data || error.message);
      
      if (error.response?.data) {
        throw new BadRequestException(
          `Error al obtener PDF: ${JSON.stringify(error.response.data)}`,
        );
      }
      
      throw new BadRequestException(
        `Error al obtener PDF: ${error.message}`,
      );
    }
  }

  /**
   * Consulta una boleta por su ID
   */
  async consultarBoleta(boletaId: number): Promise<LiorenBoletaResponse> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    try {
      this.logger.log(`Consultando boleta ID: ${boletaId}`);

      const response = await this.axiosInstance.get<LiorenBoletaResponse>(
        `/boletas/${boletaId}`,
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Error al consultar boleta:', error.response?.data || error.message);
      
      if (error.response?.data) {
        throw new BadRequestException(
          `Error al consultar boleta: ${JSON.stringify(error.response.data)}`,
        );
      }
      
      throw new BadRequestException(
        `Error al consultar boleta: ${error.message}`,
      );
    }
  }

  /**
   * Genera una boleta para una suscripción de membresía
   */
  async generarBoletaMembresia(
    usuario: {
      rut: string;
      nombre: string;
      email: string;
      direccion?: string;
      comuna?: string;
      ciudad?: string;
      telefono?: string;
    },
    pago: {
      monto: number;
      descripcion: string;
      fechaPago: Date;
      referencia?: string;
    },
  ): Promise<{ boleta: LiorenBoletaResponse; pdf: Buffer }> {
    // Formatear RUT (remover puntos y guiones)
    const rutLimpio = usuario.rut.replace(/[.-]/g, '');

    // Preparar datos de la boleta
    const boletaData: LiorenBoletaRequest = {
      tipo: 'boleta',
      fecha_emision: pago.fechaPago.toISOString().split('T')[0], // YYYY-MM-DD
      receptor: {
        rut: rutLimpio,
        razon_social: usuario.nombre,
        email: usuario.email,
        direccion: usuario.direccion,
        comuna: usuario.comuna,
        ciudad: usuario.ciudad || 'Santiago',
        telefono: usuario.telefono,
      },
      items: [
        {
          descripcion: pago.descripcion,
          cantidad: 1,
          precio_unitario: pago.monto,
        },
      ],
      referencia: pago.referencia,
      observaciones: 'Pago de membresía - Club Carvajal Fit',
    };

    // Emitir la boleta
    const boleta = await this.emitirBoleta(boletaData);

    // Esperar un momento para que la boleta se procese
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Obtener el PDF
    const pdf = await this.obtenerPDFBoleta(boleta.id);

    return { boleta, pdf };
  }
}

