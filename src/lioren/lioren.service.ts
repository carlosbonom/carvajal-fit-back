import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface LiorenBoletaRequest {
  emisor: {
    rut: string; // Sin puntos ni guión
  };
  tipodoc: '33' | '34' | '39' | '41'; // 33: Factura, 39: Boleta
  folio?: number;
  fecha?: string; // Formato: YYYY-MM-DD
  receptor: {
    rut: string; // Sin puntos ni guión
    rs: string; // Razón Social
    giro?: string;
    direccion?: string;
    comuna?: string;
    ciudad?: string;
    email?: string;
    fono?: string; // Teléfono
  };
  detalles: Array<{
    nombre: string;
    cantidad: number;
    precio: number; // Neto para facturas, total para boletas
    exento?: boolean;
    codigo?: string;
  }>;
  expects?: 'pdf' | 'xml' | 'all';
}

export interface LiorenBoletaResponse {
  id?: number;
  folio: number;
  tipodoc: string;
  pdf?: string; // Base64 si se solicita
  xml?: string; // Base64 si se solicita
  status?: string;
  error?: any;
}

@Injectable()
export class LiorenService {
  private readonly logger = new Logger(LiorenService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly emisorRut: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('LIOREN_API_URL') || 'https://www.lioren.cl/api';
    this.apiKey = this.configService.get<string>('LIOREN_API_KEY') || '';
    this.emisorRut = this.configService.get<string>('LIOREN_EMISOR_RUT') || '';

    if (!this.apiKey) {
      this.logger.warn('LIOREN_API_KEY no está configurado. La emisión de boletas no funcionará.');
    }

    if (!this.emisorRut) {
      this.logger.warn('LIOREN_EMISOR_RUT no está configurado.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      timeout: 30000,
    });
  }

  /**
   * Emite una boleta o factura electrónica
   */
  async emitirBoleta(boletaData: Omit<LiorenBoletaRequest, 'emisor'>): Promise<LiorenBoletaResponse> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    if (!this.emisorRut) {
      throw new BadRequestException('LIOREN_EMISOR_RUT no está configurado');
    }

    try {
      this.logger.log(`Emitiendo documento para RUT receptor: ${boletaData.receptor.rut}`);

      const fullData: LiorenBoletaRequest = {
        ...boletaData,
        emisor: { rut: this.emisorRut },
      };

      // Limpiar RUTs (remover puntos y guiones)
      fullData.emisor.rut = fullData.emisor.rut.replace(/[.-]/g, '');
      fullData.receptor.rut = fullData.receptor.rut.replace(/[.-]/g, '');

      const endpoint = boletaData.tipodoc === '33' || boletaData.tipodoc === '34' ? '/dtes' : '/boletas';

      const response = await this.axiosInstance.post<LiorenBoletaResponse>(
        endpoint,
        fullData,
      );

      this.logger.log(`Documento emitido exitosamente. Folio: ${response.data.folio}, Tipo: ${boletaData.tipodoc}`);

      return {
        ...response.data,
        tipodoc: boletaData.tipodoc,
      };
    } catch (error: any) {
      this.logger.error('Error al emitir documento:', error.response?.data || error.message);

      if (error.response?.data) {
        throw new BadRequestException(
          `Error al emitir documento: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new BadRequestException(
        `Error al emitir documento: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene el PDF de un documento emitido
   */
  async obtenerPDF(folio: number, tipodoc: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    try {
      this.logger.log(`Obteniendo PDF para Documento - Folio: ${folio}, Tipo: ${tipodoc}`);

      const endpoint = tipodoc === '33' || tipodoc === '34' ? '/dtes' : '/boletas';

      const response = await this.axiosInstance.get<LiorenBoletaResponse>(endpoint, {
        params: {
          tipodoc,
          folio,
          expects: 'pdf',
        },
      });

      if (response.data.pdf) {
        return Buffer.from(response.data.pdf, 'base64');
      }

      throw new BadRequestException('No se recibió el PDF del documento');
    } catch (error: any) {
      this.logger.error('Error al obtener PDF:', error.response?.data || error.message);

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
   * Consulta un documento por su folio y tipo
   */
  async consultarDocumento(folio: number, tipodoc: string): Promise<LiorenBoletaResponse> {
    if (!this.apiKey) {
      throw new BadRequestException('LIOREN_API_KEY no está configurado');
    }

    try {
      this.logger.log(`Consultando documento - Folio: ${folio}, Tipo: ${tipodoc}`);

      const endpoint = tipodoc === '33' || tipodoc === '34' ? '/dtes' : '/boletas';

      const response = await this.axiosInstance.get<LiorenBoletaResponse>(endpoint, {
        params: {
          tipodoc,
          folio,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error('Error al consultar documento:', error.response?.data || error.message);

      if (error.response?.data) {
        throw new BadRequestException(
          `Error al consultar documento: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new BadRequestException(
        `Error al consultar documento: ${error.message}`,
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
    // Preparar datos de la boleta
    const boletaData: Omit<LiorenBoletaRequest, 'emisor'> = {
      tipodoc: '39', // Boleta Electrónica
      fecha: pago.fechaPago.toISOString().split('T')[0], // YYYY-MM-DD
      receptor: {
        rut: usuario.rut,
        rs: usuario.nombre,
        email: usuario.email,
        direccion: usuario.direccion,
        comuna: usuario.comuna,
        ciudad: usuario.ciudad || 'Santiago',
        fono: usuario.telefono,
      },
      detalles: [
        {
          nombre: pago.descripcion,
          cantidad: 1,
          precio: pago.monto,
          exento: false,
        },
      ],
      expects: 'pdf',
    };

    // Emitir la boleta
    const response = await this.emitirBoleta(boletaData);

    let pdf: Buffer;

    if (response.pdf) {
      pdf = Buffer.from(response.pdf, 'base64');
    } else {
      // Si no viene el PDF en la respuesta, lo solicitamos explícitamente
      pdf = await this.obtenerPDF(response.folio, '39');
    }

    return { boleta: response, pdf };
  }
}
