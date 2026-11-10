import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { validateDatabaseConfig } from './runtime-config';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'mysql',
  ...validateDatabaseConfig({
    DB_HOST: configService.get('DB_HOST'),
    DB_PORT: configService.get('DB_PORT'),
    DB_USER: configService.get('DB_USER'),
    DB_PASSWORD: configService.get('DB_PASSWORD'),
    DB_NAME: configService.get('DB_NAME'),
  }),
  autoLoadEntities: true,
  synchronize: false,
  logging: false,
});

// Nest retries print error.stack even with SQL logging disabled. Replace errors
// before the retry logger receives a driver's private payload.
export async function createDataSourceSafely(
  options?: DataSourceOptions,
  factory: (options: DataSourceOptions) => DataSource = (input) =>
    new DataSource(input),
): Promise<DataSource> {
  let source: DataSource | undefined;
  try {
    if (!options) throw new Error();
    source = factory(options);
    if (!source.isInitialized) await source.initialize();
    if (!source.isInitialized) throw new Error();
    return source;
  } catch {
    try {
      if (source?.isInitialized) await source.destroy();
    } catch {
      // Cleanup errors must not expose driver details either.
    }
    throw new Error('No se pudo inicializar la base de datos.');
  }
}
