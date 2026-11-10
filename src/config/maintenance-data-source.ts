import { DataSource } from 'typeorm';
import { EnsureUserPasswordCapacity1794153600000 } from '../migrations/1794153600000-EnsureUserPasswordCapacity';
import { Role } from '../modules/roles/entities/role.entity';
import { User } from '../modules/users/entities/user.entity';
import { validateDatabaseConfig } from './runtime-config';

// Construction is inert. Only explicitly invoked maintenance commands initialize
// this private datasource; importing it never loads .env or connects to MySQL.
export function createMaintenanceDataSource(
  input: Record<string, unknown>,
): DataSource {
  return new DataSource({
    type: 'mysql',
    ...validateDatabaseConfig(input),
    entities: [User, Role],
    migrations: [EnsureUserPasswordCapacity1794153600000],
    migrationsTransactionMode: 'none',
    synchronize: false,
    migrationsRun: false,
    dropSchema: false,
    logging: false,
    poolSize: 1,
  });
}
