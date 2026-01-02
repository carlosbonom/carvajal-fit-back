import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmConfigService } from './database/typeorm/typeorm.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { CoursesModule } from './courses/courses.module';
import { MarketingModule } from './marketing/marketing.module';
import { SuccessStoriesModule } from './success-stories/success-stories.module';
import { ProductsModule } from './products/products.module';
import { LiorenModule } from './lioren/lioren.module';
import { MarketModule } from './market/market.module';
import { ClubConfigModule } from './club-config/club-config.module';
import { CommentsModule } from './comments/comments.module';
import { UserProgressModule } from './user-progress/user-progress.module';
import { CourseCategoriesModule } from './course-categories/course-categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    CoursesModule,
    MarketingModule,
    SuccessStoriesModule,
    ProductsModule,
    LiorenModule,
    MarketModule,
    ClubConfigModule,
    CommentsModule,
    UserProgressModule,
    CourseCategoriesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
