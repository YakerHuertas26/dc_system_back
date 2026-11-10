import 'reflect-metadata';
import {
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';
import {
  EnsureUserPasswordCapacity1794153600000,
  PasswordCapacityMigrationError,
} from '../1794153600000-EnsureUserPasswordCapacity';

describe('C2 password capacity migration without a database', () => {
  let migration: EnsureUserPasswordCapacity1794153600000;
  let table: Table | undefined;
  let metadata: Record<string, unknown>;
  let runner: {
    connection: { options: { type: string; database: string } };
    isReleased: boolean;
    isTransactionActive: boolean;
    getTable: jest.Mock;
    query: jest.Mock;
    changeColumn: jest.Mock;
    dropColumn: jest.Mock;
    addColumn: jest.Mock;
  };

  beforeEach(() => {
    migration = new EnsureUserPasswordCapacity1794153600000();
    table = new Table({
      name: 'users',
      database: 'synthetic_database',
      columns: [
        new TableColumn({
          name: 'password',
          type: 'varchar',
          length: '45',
          isNullable: false,
        }),
      ],
    });
    // MySQL's getTable omits charset/collation when inherited from the schema
    // and does not reliably populate engine. Supplementary metadata is needed.
    metadata = {
      dataType: 'varchar',
      columnType: 'varchar(45)',
      capacity: 45,
      nullable: 'NO',
      defaultValue: null,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      extra: '',
      comment: '',
      engine: 'InnoDB',
    };
    runner = {
      connection: {
        options: { type: 'mysql', database: 'synthetic_database' },
      },
      isReleased: false,
      isTransactionActive: false,
      getTable: jest.fn(() => Promise.resolve(table)),
      query: jest.fn((sql: string) => {
        if (sql.startsWith('ALTER TABLE')) {
          metadata = { ...metadata, capacity: 255, columnType: 'varchar(255)' };
          return Promise.resolve([]);
        }
        return Promise.resolve([{ ...metadata }]);
      }),
      changeColumn: jest.fn(),
      dropColumn: jest.fn(),
      addColumn: jest.fn(),
    };
  });

  function queryRunner() {
    return runner as unknown as QueryRunner;
  }

  function expectNoDdl() {
    const queries = runner.query.mock.calls as [string, unknown[]?][];
    expect(queries.every(([sql]) => sql.startsWith('SELECT '))).toBe(true);
    expect(runner.changeColumn).not.toHaveBeenCalled();
    expect(runner.dropColumn).not.toHaveBeenCalled();
    expect(runner.addColumn).not.toHaveBeenCalled();
  }

  async function expectRejected() {
    let failure: unknown;
    try {
      await migration.up(queryRunner());
    } catch (error) {
      failure = error;
    }
    expect(failure instanceof PasswordCapacityMigrationError).toBe(true);
    expect((failure as PasswordCapacityMigrationError).code).toBe(
      'PASSWORD_CAPACITY_PRECONDITION_FAILED',
    );
    expectNoDdl();
  }

  it.each([45, 60, 254])(
    'expands varchar(%i) without dropping or copying data',
    async (capacity) => {
      table!.columns[0].length = String(capacity);
      metadata.capacity = capacity;
      metadata.columnType = `varchar(${capacity})`;
      await migration.up(queryRunner());
      expect(runner.getTable).toHaveBeenCalledWith('users');
      expect(runner.query).toHaveBeenCalledWith(
        'ALTER TABLE `users` MODIFY COLUMN `password` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL',
      );
      const statements = runner.query.mock.calls as [string, unknown[]?][];
      expect(
        statements.filter(([sql]) => sql.startsWith('ALTER TABLE')),
      ).toHaveLength(1);
      expect(
        statements.every(
          ([sql]) => !/\b(?:DROP|ADD|INSERT|UPDATE|DELETE)\b/u.test(sql),
        ),
      ).toBe(true);
      expect(runner.changeColumn).not.toHaveBeenCalled();
      expect(runner.dropColumn).not.toHaveBeenCalled();
      expect(runner.addColumn).not.toHaveBeenCalled();
    },
  );

  it.each([255, 512])(
    'preserves existing capacity %i without DDL',
    async (capacity) => {
      table!.columns[0].length = String(capacity);
      metadata.capacity = capacity;
      metadata.columnType = `varchar(${capacity})`;
      await migration.up(queryRunner());
      expectNoDdl();
    },
  );

  it('parameterizes metadata lookup and never selects password values', async () => {
    await migration.up(queryRunner());
    const statements = runner.query.mock.calls as [string, unknown[]?][];
    const lookups = statements.filter(([sql]) => sql.startsWith('SELECT '));
    expect(lookups).toHaveLength(2);
    for (const [sql, parameters] of lookups) {
      expect(sql).toContain('information_schema.COLUMNS');
      expect(sql).toContain('information_schema.TABLES');
      expect(sql).toContain('DATABASE()');
      expect(parameters).toEqual(['users', 'password']);
      expect(sql).not.toMatch(/FROM\s+`?users`?/iu);
    }
  });

  it('preserves an explicit non-default charset and collation', async () => {
    table!.columns[0].charset = 'latin1';
    table!.columns[0].collation = 'latin1_bin';
    metadata.charset = 'latin1';
    metadata.collation = 'latin1_bin';
    await migration.up(queryRunner());
    expect(runner.query).toHaveBeenCalledWith(
      'ALTER TABLE `users` MODIFY COLUMN `password` VARCHAR(255) CHARACTER SET latin1 COLLATE latin1_bin NOT NULL',
    );
  });

  it('rejects a missing table', async () => {
    table = undefined;
    await expectRejected();
  });

  it('rejects a missing password column', async () => {
    table!.columns = [];
    await expectRejected();
  });

  it.each([
    ['type', 'text'],
    ['length', '0'],
    ['length', '45;DROP'],
    ['isNullable', true],
    ['default', 'synthetic-default'],
    ['isGenerated', true],
    ['isPrimary', true],
    ['isUnique', true],
    ['isArray', true],
    ['onUpdate', 'CURRENT_TIMESTAMP'],
    ['asExpression', 'synthetic-expression'],
    ['comment', 'unexpected-comment'],
    ['charset', 'utf8'],
    ['collation', 'utf8mb4_general_ci'],
  ])('rejects unexpected column metadata: %s', async (key, value) => {
    Object.assign(table!.columns[0], { [key]: value });
    await expectRejected();
  });

  it.each([
    ['engine', 'MyISAM'],
    ['dataType', 'text'],
    ['columnType', 'varchar(60)'],
    ['capacity', 0],
    ['nullable', 'YES'],
    ['defaultValue', 'synthetic-default'],
    ['charset', undefined],
    ['charset', 'utf8mb4;DROP'],
    ['collation', undefined],
    ['collation', 'utf8mb4_unicode_ci;DROP'],
    ['extra', 'INVISIBLE'],
    ['comment', 'unexpected-comment'],
  ])('rejects unexpected effective schema: %s', async (key, value) => {
    metadata[key] = value;
    await expectRejected();
  });

  it('rejects a password index', async () => {
    table!.indices.push(
      new TableIndex({ name: 'password_index', columnNames: ['password'] }),
    );
    await expectRejected();
  });

  it('rejects a password unique constraint', async () => {
    table!.uniques.push(new TableUnique({ columnNames: ['password'] }));
    await expectRejected();
  });

  it('rejects a password foreign key', async () => {
    table!.foreignKeys.push(
      new TableForeignKey({
        columnNames: ['password'],
        referencedTableName: 'unexpected',
        referencedColumnNames: ['value'],
      }),
    );
    await expectRejected();
  });

  it('rejects another database driver', async () => {
    runner.connection.options.type = 'postgres';
    await expectRejected();
  });

  it('rejects an existing transaction instead of implicitly committing it', async () => {
    runner.isTransactionActive = true;
    await expectRejected();
  });

  it('rejects a released connection', async () => {
    runner.isReleased = true;
    await expectRejected();
  });

  it('rejects a table returned from a different database', async () => {
    table!.database = 'another_database';
    await expectRejected();
  });

  it('fails verification if the DDL did not produce the expected capacity', async () => {
    runner.query.mockImplementation(() => Promise.resolve([{ ...metadata }]));
    await expect(migration.up(queryRunner())).rejects.toMatchObject({
      code: 'PASSWORD_CAPACITY_VERIFICATION_FAILED',
    });
  });

  it('never offers an automatic shrinking rollback', async () => {
    await expect(migration.down()).rejects.toMatchObject({
      code: 'PASSWORD_CAPACITY_DOWN_REFUSED',
    });
    expect(runner.query).not.toHaveBeenCalled();
  });
});
