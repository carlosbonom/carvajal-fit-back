import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubConfigController } from './club-config.controller';
import { ClubConfigService } from './club-config.service';
import { ClubConfig } from '../database/entities/club-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClubConfig])],
  controllers: [ClubConfigController],
  providers: [ClubConfigService],
  exports: [ClubConfigService],
})
export class ClubConfigModule {}

