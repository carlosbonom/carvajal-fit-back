import { Injectable } from "@nestjs/common";
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from "@nestjs/typeorm";
import 'dotenv/config'; 

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory{
    
    createTypeOrmOptions(): TypeOrmModuleOptions{
        const shouldSync = process.env.TYPEORM_SYNC === 'true';
        const shouldLog = process.env.TYPEORM_LOG === 'true';

        return {
            type:'postgres',
            host:process.env.DATABASE_HOST,
            port:Number(process.env.DATABASE_PORT),
            database:process.env.DATABASE_NAME,
            username:process.env.DATABASE_USER,
            password:process.env.DATABASE_PASSWORD,
            entities:['dist/**/*.entity.{ts,js}'],
            logger:'advanced-console',
            synchronize:shouldSync, //descomentar nueva tabla
            logging:shouldLog, //debuggin in dev
            ssl: true
        }
    }
}