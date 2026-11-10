import { DataSource } from 'typeorm';
import { createMaintenanceDataSource } from '../config/maintenance-data-source';
import { EnsureUserPasswordCapacity1794153600000 } from '../migrations/1794153600000-EnsureUserPasswordCapacity';

type SourceFactory = (input: Record<string, unknown>) => DataSource;
interface MigrationOutput {
  out: (message: string) => void;
  err: (message: string) => void;
}

export class SecurityMigrationError extends Error {
  constructor(
    readonly code:
      | 'SECURITY_MIGRATION_ARGUMENTS_INVALID'
      | 'SECURITY_MIGRATION_FAILED'
      | 'SECURITY_MIGRATION_CLEANUP_FAILED',
  ) {
    super(code);
    this.name = 'SecurityMigrationError';
  }
}

export async function runSecurityMigration(
  input: Record<string, unknown>,
  factory: SourceFactory = createMaintenanceDataSource,
  argv: readonly string[] = [],
): Promise<void> {
  // Reject flags (including passwords and down) before constructing any source.
  if (argv.length !== 0) {
    throw new SecurityMigrationError('SECURITY_MIGRATION_ARGUMENTS_INVALID');
  }
  let source: DataSource | undefined;
  let owned = false;
  let failure: SecurityMigrationError | undefined;
  try {
    source = factory(input);
    if (source.isInitialized) throw new Error();
    owned = true;
    if (
      source.options.type !== 'mysql' ||
      source.options.synchronize !== false ||
      source.options.migrationsRun !== false ||
      source.options.dropSchema !== false ||
      source.options.logging !== false
    ) {
      throw new Error();
    }
    await source.initialize();
    if (
      !source.isInitialized ||
      source.migrations.length !== 1 ||
      !(source.migrations[0] instanceof EnsureUserPasswordCapacity1794153600000)
    ) {
      throw new Error();
    }
    // The reviewed datasource registers one migration only. TypeORM may create
    // its migration-history table during this future explicitly invoked step.
    // MySQL DDL must never be advertised as transactionally reversible.
    await source.runMigrations({ transaction: 'none' });
  } catch {
    // Do not inspect, retain, serialize or print the original error.
    failure = new SecurityMigrationError('SECURITY_MIGRATION_FAILED');
  } finally {
    try {
      if (owned && source?.isInitialized) {
        await source.destroy();
        if (source.isInitialized) {
          failure = new SecurityMigrationError(
            'SECURITY_MIGRATION_CLEANUP_FAILED',
          );
        }
      }
    } catch {
      failure = new SecurityMigrationError('SECURITY_MIGRATION_CLEANUP_FAILED');
    }
  }
  if (failure) throw failure;
}

export async function runSecurityMigrationCli(
  input: Record<string, unknown>,
  argv: readonly string[],
  factory: SourceFactory,
  output: MigrationOutput,
): Promise<number> {
  try {
    await runSecurityMigration(input, factory, argv);
    output.out('SECURITY_MIGRATION_COMPLETE');
    return 0;
  } catch (error) {
    output.err(
      error instanceof SecurityMigrationError
        ? error.code
        : 'SECURITY_MIGRATION_FAILED',
    );
    return 1;
  }
}

// No initialization, environment read or command execution occurs on import.
// This entry point is for a separately authorized maintenance execution only.
if (require.main === module) {
  void runSecurityMigrationCli(
    process.env,
    process.argv.slice(2),
    createMaintenanceDataSource,
    {
      out: (message) => {
        process.stdout.write(`${message}\n`);
      },
      err: (message) => {
        process.stderr.write(`${message}\n`);
      },
    },
  ).then((code) => {
    process.exitCode = code;
  });
}
