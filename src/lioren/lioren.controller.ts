import { Controller, Get, Query, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LiorenService } from './lioren.service';

@Controller('lioren')
export class LiorenController {
    constructor(private readonly liorenService: LiorenService) { }

    @Get('test-boleta')
    async testBoleta(
        @Query('rut') rut: string = '1-9',
        @Query('monto') monto: number = 1000,
        @Query('comuna') comuna: number = 1,
        @Query('ciudad') ciudad: number = 1,
        @Query('tipodoc') tipodoc: '33' | '34' | '39' | '41' = '39',
    ) {
        try {
            const result = await this.liorenService.generarBoletaMembresia(
                {
                    rut,
                    nombre: 'Usuario de Prueba',
                    email: 'test@example.com',
                    comuna: Number(comuna),
                    ciudad: Number(ciudad),
                },
                {
                    monto: Number(monto),
                    descripcion: 'Prueba de integración API Lioren',
                    fechaPago: new Date(),
                },
                tipodoc,
            );

            return {
                success: true,
                message: 'Boleta emitida exitosamente (en teoría)',
                folio: result.boleta.folio,
                pdf_length: result.pdf.length,
            };
        } catch (error: any) {
            throw new BadRequestException({
                success: false,
                message: error.message,
                error: error.response?.data || error,
            });
        }
    }

    @Get('check-auth')
    async checkAuth() {
        // Note: this should use a whoami endpoint if it exists in service
        // For now, just a basic check or expose something else
        return { message: 'Lioren Controller is active' };
    }

    @Get('pdf')
    async downloadPdf(
        @Query('folio') folio: number,
        @Query('tipodoc') tipodoc: string,
        @Res() res: Response,
    ) {
        try {
            if (!folio || !tipodoc) {
                throw new BadRequestException('Folio y tipodoc son requeridos');
            }

            const pdfBuffer = await this.liorenService.obtenerPDF(Number(folio), tipodoc);

            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=documento_${folio}.pdf`,
                'Content-Length': pdfBuffer.length,
            });

            res.end(pdfBuffer);
        } catch (error: any) {
            res.status(400).json({
                success: false,
                message: error.message,
                error: error.response?.data || error,
            });
        }
    }
}
