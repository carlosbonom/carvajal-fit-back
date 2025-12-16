import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../database/entities/users.entity';

@Controller('marketing')
@UseGuards(JwtAuthGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('templates')
  findAll() {
    return this.marketingService.findAll();
  }

  @Get('templates/:id')
  findOne(@Param('id') id: string) {
    return this.marketingService.findOne(id);
  }

  @Post('templates')
  create(@Body() createDto: CreateEmailTemplateDto) {
    return this.marketingService.create(createDto);
  }

  @Patch('templates/:id')
  update(@Param('id') id: string, @Body() updateDto: UpdateEmailTemplateDto) {
    return this.marketingService.update(id, updateDto);
  }

  @Delete('templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.marketingService.remove(id);
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  sendBulkEmails(@Body() sendDto: SendEmailDto, @CurrentUser() user: User) {
    // Solo admins pueden enviar emails masivos
    if (user.role !== 'admin') {
      throw new ForbiddenException('No autorizado. Solo administradores pueden enviar emails masivos.');
    }
    return this.marketingService.sendBulkEmails(sendDto);
  }
}

