import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';

@Module({
  imports: [
    
   // permite leer globalmete las variables de entorno
    ConfigModule.forRoot({
    isGlobal:true
    }),

    // acceder a la configuracion de typeorm de manera asincrona y usando el servicio de configuracion para obtener las variables de entorno(configService)
    TypeOrmModule.forRootAsync({
      useFactory: typeOrmConfig,
      inject: [ConfigService]
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
