import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LiorenService } from './lioren.service';

@Controller('lioren')
export class LiorenController {
    constructor(private readonly liorenService: LiorenService) { }

    @Get('test-boleta')
    async testBoleta(
        @Query('rut') rut: string = '1-9',
        @Query('monto') monto: number = 1000,
    ) {
        try {
            const result = await this.liorenService.generarBoletaMembresia(
                {
                    rut,
                    nombre: 'Usuario de Prueba',
                    email: 'test@example.com',
                },
                {
                    monto: Number(monto),
                    descripcion: 'Prueba de integración API Lioren',
                    fechaPago: new Date(),
                },
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
}
