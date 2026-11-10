import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

type MigrationFailureCode =
  | 'PASSWORD_CAPACITY_PRECONDITION_FAILED'
  | 'PASSWORD_CAPACITY_VERIFICATION_FAILED'
  | 'PASSWORD_CAPACITY_MIGRATION_FAILED'
  | 'PASSWORD_CAPACITY_DOWN_REFUSED';

interface EffectiveColumn {
  capacity: number;
  charset: string;
  collation: string;
  engine: string;
}

const metadataQuery = [
  'SELECT c.DATA_TYPE AS dataType, c.COLUMN_TYPE AS columnType,',
  'c.CHARACTER_MAXIMUM_LENGTH AS capacity, c.IS_NULLABLE AS nullable,',
  'c.COLUMN_DEFAULT AS defaultValue, c.CHARACTER_SET_NAME AS charset,',
  'c.COLLATION_NAME AS collation, c.EXTRA AS extra,',
  'c.COLUMN_COMMENT AS comment, t.ENGINE AS engine',
  'FROM information_schema.COLUMNS c',
  'INNER JOIN information_schema.TABLES t',
  'ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME',
  'WHERE c.TABLE_SCHEMA = DATABASE() AND c.TABLE_NAME = ? AND c.COLUMN_NAME = ?',
].join(' ');

export class PasswordCapacityMigrationError extends Error {
  constructor(readonly code: MigrationFailureCode) {
    super(code);
    this.name = 'PasswordCapacityMigrationError';
  }
}

export class EnsureUserPasswordCapacity1794153600000 implements MigrationInterface {
  readonly name = 'EnsureUserPasswordCapacity1794153600000';
  readonly transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    try {
      if (
        queryRunner.connection.options.type !== 'mysql' ||
        queryRunner.isReleased ||
        queryRunner.isTransactionActive
      ) {
        throw new PasswordCapacityMigrationError(
          'PASSWORD_CAPACITY_PRECONDITION_FAILED',
        );
      }
      const table = await queryRunner.getTable('users');
      const column = table?.columns.find((entry) => entry.name === 'password');
      const before = await this.readEffectiveColumn(queryRunner);
      this.validateTable(table, column, before, queryRunner);
      if (before.capacity >= 255) return;

      // The installed MySQL changeColumn implementation drops/recreates columns
      // when length changes. Never call it here: keep the same column and data.
      // Identifiers users/password are fixed; charset/collation are constrained
      // identifiers obtained from metadata, never command-line or user input.
      await queryRunner.query(
        `ALTER TABLE \`users\` MODIFY COLUMN \`password\` VARCHAR(255) CHARACTER SET ${before.charset} COLLATE ${before.collation} NOT NULL`,
      );
      const after = await this.readEffectiveColumn(
        queryRunner,
        'PASSWORD_CAPACITY_VERIFICATION_FAILED',
      );
      if (
        after.capacity !== 255 ||
        after.charset !== before.charset ||
        after.collation !== before.collation ||
        after.engine !== before.engine
      ) {
        throw new PasswordCapacityMigrationError(
          'PASSWORD_CAPACITY_VERIFICATION_FAILED',
        );
      }
    } catch (error) {
      if (error instanceof PasswordCapacityMigrationError) throw error;
      // Do not retain driver errors, SQL payloads, values or causes.
      throw new PasswordCapacityMigrationError(
        'PASSWORD_CAPACITY_MIGRATION_FAILED',
      );
    }
  }

  down(): Promise<void> {
    // MySQL DDL is not reversed by DML rollback. In particular, VARCHAR(45)
    // cannot hold existing bcrypt hashes: application rollback keeps capacity.
    return Promise.reject(
      new PasswordCapacityMigrationError('PASSWORD_CAPACITY_DOWN_REFUSED'),
    );
  }

  private async readEffectiveColumn(
    queryRunner: QueryRunner,
    code: MigrationFailureCode = 'PASSWORD_CAPACITY_PRECONDITION_FAILED',
  ): Promise<EffectiveColumn> {
    const rows: unknown = await queryRunner.query(metadataQuery, [
      'users',
      'password',
    ]);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new PasswordCapacityMigrationError(code);
    }
    const value: unknown = rows[0];
    if (!value || typeof value !== 'object') {
      throw new PasswordCapacityMigrationError(code);
    }
    const row = value as Record<string, unknown>;
    const capacity = this.capacity(row.capacity);
    if (
      row.dataType !== 'varchar' ||
      row.columnType !== `varchar(${capacity})` ||
      capacity === undefined ||
      row.nullable !== 'NO' ||
      row.defaultValue !== null ||
      !this.isIdentifier(row.charset) ||
      !this.isIdentifier(row.collation) ||
      !row.collation.startsWith(`${row.charset}_`) ||
      row.extra !== '' ||
      row.comment !== '' ||
      typeof row.engine !== 'string' ||
      row.engine.toLowerCase() !== 'innodb'
    ) {
      throw new PasswordCapacityMigrationError(code);
    }
    return {
      capacity,
      charset: row.charset,
      collation: row.collation,
      engine: row.engine,
    };
  }

  private validateTable(
    table: Table | undefined,
    column: TableColumn | undefined,
    effective: EffectiveColumn,
    runner: QueryRunner,
  ): void {
    if (
      !table ||
      table.name !== 'users' ||
      (table.database !== undefined &&
        table.database !== runner.connection.options.database) ||
      (table.engine !== undefined && table.engine.toLowerCase() !== 'innodb') ||
      !column ||
      column.type !== 'varchar' ||
      this.capacity(column.length) !== effective.capacity ||
      column.isNullable ||
      column.default !== undefined ||
      column.isGenerated ||
      column.isPrimary ||
      column.isUnique ||
      column.isArray ||
      column.unsigned ||
      column.zerofill ||
      column.onUpdate !== undefined ||
      column.asExpression !== undefined ||
      column.generatedType !== undefined ||
      column.generationStrategy !== undefined ||
      (column.comment !== undefined && column.comment !== '') ||
      (column.charset !== undefined && column.charset !== effective.charset) ||
      (column.collation !== undefined &&
        column.collation !== effective.collation) ||
      table.indices.some((index) => index.columnNames.includes('password')) ||
      table.uniques.some((unique) => unique.columnNames.includes('password')) ||
      table.foreignKeys.some((key) => key.columnNames.includes('password')) ||
      table.checks.length !== 0 ||
      table.exclusions.length !== 0
    ) {
      throw new PasswordCapacityMigrationError(
        'PASSWORD_CAPACITY_PRECONDITION_FAILED',
      );
    }
  }

  private capacity(value: unknown): number | undefined {
    if (
      typeof value !== 'number' &&
      (typeof value !== 'string' ||
        !/^[0-9]+$/u.test(value) ||
        /\s/u.test(value))
    ) {
      return undefined;
    }
    const result = Number(value);
    return Number.isSafeInteger(result) && result > 0 && result <= 65535
      ? result
      : undefined;
  }

  private isIdentifier(value: unknown): value is string {
    return (
      typeof value === 'string' &&
      /^[a-z][a-z0-9_]{0,63}$/u.test(value) &&
      !/\s/u.test(value)
    );
  }
}
