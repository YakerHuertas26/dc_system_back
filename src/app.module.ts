import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { typeOrmConfig } from './config/typeorm.config';
import { CategoriesModule } from './modules/categories/categories.module';
import { ProductStatesModule } from './modules/product_states/product_states.module';
import { ProductsModule } from './modules/products/products.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';


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

    CategoriesModule,

    ProductStatesModule,

    ProductsModule,

    RolesModule,

    UsersModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
