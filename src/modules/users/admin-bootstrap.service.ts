import * as bcrypt from 'bcrypt';
import { BadRequestException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { DataSource, QueryRunner } from 'typeorm';
import { createMaintenanceDataSource } from '../../config/maintenance-data-source';
import { validateDatabaseConfig } from '../../config/runtime-config';
import { Role } from '../roles/entities/role.entity';
import { User } from './entities/user.entity';
import { hashNewPassword } from './security/password-hasher';

export interface AdminBootstrapInput {
  name: string;
  email: string;
  password: string;
}

export interface AdminBootstrapResult {
  userId: number;
}

export type AdminBootstrapCode =
  | 'BOOTSTRAP_INPUT_INVALID'
  | 'BOOTSTRAP_CONFIGURATION_INVALID'
  | 'BOOTSTRAP_ALREADY_INITIALIZED'
  | 'BOOTSTRAP_IDENTITY_EXISTS'
  | 'BOOTSTRAP_ROLES_INCONSISTENT'
  | 'BOOTSTRAP_SCHEMA_UNSUPPORTED'
  | 'BOOTSTRAP_IN_PROGRESS'
  | 'BOOTSTRAP_LOCK_FAILED'
  | 'BOOTSTRAP_FAILED'
  | 'BOOTSTRAP_COMMIT_UNCERTAIN'
  | 'BOOTSTRAP_CLEANUP_UNCERTAIN';

export class AdminBootstrapError extends Error {
  constructor(readonly code: AdminBootstrapCode) {
    super(code);
    this.name = 'AdminBootstrapError';
  }
}

type SourceFactory = (input: Record<string, unknown>) => DataSource;
const bootstrapLock = 'dc-system.bootstrap-admin.v1';

function containsControls(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function validateIdentity(input: AdminBootstrapInput): void {
  if (
    !input ||
    typeof input.name !== 'string' ||
    input.name !== input.name.trim() ||
    Array.from(input.name).length < 1 ||
    Array.from(input.name).length > 25 ||
    containsControls(input.name) ||
    typeof input.email !== 'string' ||
    input.email !== input.email.trim() ||
    Array.from(input.email).length > 50 ||
    containsControls(input.email) ||
    !isEmail(input.email) ||
    typeof input.password !== 'string' ||
    input.password !== input.password.trim() ||
    containsControls(input.password)
  ) {
    throw new AdminBootstrapError('BOOTSTRAP_INPUT_INVALID');
  }
}

function scalarResult(rows: unknown, key: string): unknown {
  if (!Array.isArray(rows) || rows.length !== 1) return undefined;
  const row: unknown = rows[0];
  if (!row || typeof row !== 'object') return undefined;
  return (row as Record<string, unknown>)[key];
}

async function checkSchema(runner: QueryRunner): Promise<void> {
  // Metadata only: never select password contents during this schema gate.
  const tables: unknown = await runner.query(
    'SELECT TABLE_NAME AS tableName, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)',
    ['users', 'roles'],
  );
  if (!Array.isArray(tables) || tables.length !== 2) {
    throw new AdminBootstrapError('BOOTSTRAP_SCHEMA_UNSUPPORTED');
  }
  const names = new Set<string>();
  for (const value of tables as unknown[]) {
    if (!value || typeof value !== 'object') {
      throw new AdminBootstrapError('BOOTSTRAP_SCHEMA_UNSUPPORTED');
    }
    const row = value as Record<string, unknown>;
    if (
      (row.tableName !== 'users' && row.tableName !== 'roles') ||
      typeof row.engine !== 'string' ||
      row.engine.toLowerCase() !== 'innodb' ||
      names.has(row.tableName)
    ) {
      throw new AdminBootstrapError('BOOTSTRAP_SCHEMA_UNSUPPORTED');
    }
    names.add(row.tableName);
  }
  const columns: unknown = await runner.query(
    'SELECT DATA_TYPE AS dataType, CHARACTER_MAXIMUM_LENGTH AS capacity, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    ['users', 'password'],
  );
  const capacity = scalarResult(columns, 'capacity');
  const normalizedCapacity =
    typeof capacity === 'number'
      ? capacity
      : typeof capacity === 'string' &&
          /^[0-9]+$/u.test(capacity) &&
          !/\s/u.test(capacity)
        ? Number(capacity)
        : NaN;
  if (
    scalarResult(columns, 'dataType') !== 'varchar' ||
    scalarResult(columns, 'nullable') !== 'NO' ||
    !Number.isSafeInteger(normalizedCapacity) ||
    normalizedCapacity < 255 ||
    normalizedCapacity > 65535
  ) {
    throw new AdminBootstrapError('BOOTSTRAP_SCHEMA_UNSUPPORTED');
  }
}

/** Local maintenance only. It never imports Nest modules or starts HTTP. */
export async function bootstrapFirstAdmin(
  identity: AdminBootstrapInput,
  configuration: Record<string, unknown>,
  factory: SourceFactory = createMaintenanceDataSource,
): Promise<AdminBootstrapResult> {
  validateIdentity(identity);
  try {
    validateDatabaseConfig(configuration);
  } catch {
    throw new AdminBootstrapError('BOOTSTRAP_CONFIGURATION_INVALID');
  }
  let protectedPassword: string;
  try {
    protectedPassword = await hashNewPassword(identity.password);
  } catch (error) {
    throw new AdminBootstrapError(
      error instanceof BadRequestException
        ? 'BOOTSTRAP_INPUT_INVALID'
        : 'BOOTSTRAP_FAILED',
    );
  }

  let source: DataSource | undefined;
  let runner: QueryRunner | undefined;
  let owned = false;
  let lockHeld = false;
  let commitAttempted = false;
  let committed = false;
  let cleanupUncertain = false;
  let result: AdminBootstrapResult | undefined;
  let failure: AdminBootstrapError | undefined;
  try {
    source = factory(configuration);
    // Never borrow a running/shared pool, even when a caller supplies a factory.
    if (source.isInitialized) throw new Error();
    owned = true;
    if (
      source.options.type !== 'mysql' ||
      source.options.synchronize !== false ||
      source.options.migrationsRun !== false ||
      source.options.dropSchema !== false ||
      source.options.logging !== false ||
      source.options.poolSize !== 1
    ) {
      throw new Error();
    }
    await source.initialize();
    if (!source.isInitialized) throw new Error();
    runner = source.createQueryRunner('master');
    if (
      runner.connection !== source ||
      runner.isReleased ||
      runner.isTransactionActive
    ) {
      throw new Error();
    }
    await runner.connect();
    const acquired: unknown = await runner.query(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [bootstrapLock],
    );
    const lock = scalarResult(acquired, 'acquired');
    if (lock === 0) throw new AdminBootstrapError('BOOTSTRAP_IN_PROGRESS');
    if (lock !== 1) throw new AdminBootstrapError('BOOTSTRAP_LOCK_FAILED');
    lockHeld = true;
    await runner.startTransaction();
    if (!runner.isTransactionActive) throw new Error();
    await checkSchema(runner);

    const roles = runner.manager.getRepository(Role);
    const knownRoles = await roles
      .createQueryBuilder('role')
      .setLock('pessimistic_write')
      .getMany();
    const administrativeRoles = knownRoles.filter(
      (role) =>
        typeof role.name === 'string' &&
        role.name.trim().toLowerCase() === 'admin',
    );
    if (
      administrativeRoles.length > 1 ||
      administrativeRoles.some((role) => role.name !== 'Admin')
    ) {
      throw new AdminBootstrapError('BOOTSTRAP_ROLES_INCONSISTENT');
    }
    let admin = administrativeRoles[0];
    if (!admin) admin = await roles.save(roles.create({ name: 'Admin' }));
    if (
      !Number.isSafeInteger(admin.roleId) ||
      admin.roleId < 1 ||
      admin.name !== 'Admin'
    ) {
      throw new AdminBootstrapError('BOOTSTRAP_ROLES_INCONSISTENT');
    }

    const users = runner.manager.getRepository(User);
    // No state filter: an inactive administrator also forbids initialization.
    if (await users.exists({ where: { roleId: admin.roleId } })) {
      throw new AdminBootstrapError('BOOTSTRAP_ALREADY_INITIALIZED');
    }
    if (
      await users.exists({
        where: [{ name: identity.name }, { email: identity.email }],
      })
    ) {
      throw new AdminBootstrapError('BOOTSTRAP_IDENTITY_EXISTS');
    }
    const saved = await users.save(
      users.create({
        name: identity.name,
        email: identity.email,
        password: protectedPassword,
        roleId: admin.roleId,
        role: admin,
        state: true,
      }),
    );
    if (!Number.isSafeInteger(saved.userId) || saved.userId < 1)
      throw new Error();
    const stored = await users.findOne({
      where: { userId: saved.userId },
      select: ['userId', 'password'],
    });
    if (
      !stored ||
      stored.userId !== saved.userId ||
      typeof stored.password !== 'string' ||
      stored.password.length !== 60 ||
      stored.password !== protectedPassword ||
      !(await bcrypt.compare(identity.password, stored.password))
    ) {
      throw new Error();
    }
    commitAttempted = true;
    await runner.commitTransaction();
    if (runner.isTransactionActive) throw new Error();
    committed = true;
    result = { userId: saved.userId };
  } catch (error) {
    failure =
      commitAttempted && !committed
        ? new AdminBootstrapError('BOOTSTRAP_COMMIT_UNCERTAIN')
        : error instanceof AdminBootstrapError
          ? error
          : new AdminBootstrapError('BOOTSTRAP_FAILED');
  } finally {
    if (runner?.isTransactionActive && !committed) {
      try {
        await runner.rollbackTransaction();
        if (runner.isTransactionActive) cleanupUncertain = true;
      } catch {
        cleanupUncertain = true;
      }
    }
    if (runner && lockHeld && !cleanupUncertain) {
      try {
        const released: unknown = await runner.query(
          'SELECT RELEASE_LOCK(?) AS released',
          [bootstrapLock],
        );
        if (scalarResult(released, 'released') !== 1) cleanupUncertain = true;
      } catch {
        cleanupUncertain = true;
      }
    }
    // Never return a potentially locked connection to a live shared pool.
    // This source is owned and dedicated; close the whole pool in every case.
    if (runner && !cleanupUncertain) {
      try {
        await runner.release();
        if (!runner.isReleased) cleanupUncertain = true;
      } catch {
        cleanupUncertain = true;
      }
    }
    if (source && owned) {
      try {
        if (source.isInitialized) await source.destroy();
        if (source.isInitialized) cleanupUncertain = true;
      } catch {
        cleanupUncertain = true;
      }
    }
    if (cleanupUncertain && failure?.code !== 'BOOTSTRAP_COMMIT_UNCERTAIN') {
      failure = new AdminBootstrapError('BOOTSTRAP_CLEANUP_UNCERTAIN');
    }
  }
  if (failure) throw failure;
  if (!result) throw new AdminBootstrapError('BOOTSTRAP_FAILED');
  return result;
}
