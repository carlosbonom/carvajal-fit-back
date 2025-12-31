import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProgressController } from './user-progress.controller';
import { UserProgressService } from './user-progress.service';
import { UserWeightProgress } from '../database/entities/user-weight-progress.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserWeightProgress])],
  controllers: [UserProgressController],
  providers: [UserProgressService],
  exports: [UserProgressService],
})
export class UserProgressModule {}

