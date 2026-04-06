import { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";

export const typeOrmConfig = (configService: ConfigService):TypeOrmModuleOptions => ({
        type: 'mysql',
        host: configService.get('DB_HOST')|| 'localhost',
        port: configService.get('DB_PORT') || 3360,
        username: configService.get('DB_USER') || 'root',
        password: configService.get('DB_PASSWORD')||'' ,
        database: configService.get('DB_NAME') || 'dc_system',
        autoLoadEntities: true,
        // entities: [__dirname + '/../**/*.entity{.ts,.js}',],
        synchronize: false,
        logging: true,
});

