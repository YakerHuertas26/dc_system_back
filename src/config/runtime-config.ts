type ConfigurationInput = Record<string, unknown>;
type DatabaseKey = 'DB_HOST' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME';
type ConfigurationKey =
  | DatabaseKey
  | 'DB_PORT'
  | 'JWT_SECRET'
  | 'JWT_EXPIRATION';

export class ConfigurationError extends Error {
  readonly code = 'INVALID_CONFIGURATION';

  constructor(readonly variable: ConfigurationKey) {
    super(`Configuracion invalida: ${variable}`);
    this.name = 'ConfigurationError';
  }
}

export interface DatabaseRuntimeConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function containsControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function requiredString(input: ConfigurationInput, key: DatabaseKey): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConfigurationError(key);
  }
  return value;
}

export function validateDatabaseConfig(
  input: ConfigurationInput,
): DatabaseRuntimeConfig {
  const host = requiredString(input, 'DB_HOST');
  // Reject connection URIs and control characters before driver diagnostics.
  if (
    /[\s/@?#\\]/u.test(host) ||
    containsControlCharacters(host) ||
    host.includes('://')
  ) {
    throw new ConfigurationError('DB_HOST');
  }
  const username = requiredString(input, 'DB_USER');
  const password = requiredString(input, 'DB_PASSWORD');
  const database = requiredString(input, 'DB_NAME');
  const rawPort = input.DB_PORT;
  let port = 3306;
  if (rawPort !== undefined) {
    if (
      typeof rawPort !== 'number' &&
      (typeof rawPort !== 'string' ||
        !/^[0-9]+$/u.test(rawPort) ||
        /\s/u.test(rawPort))
    ) {
      throw new ConfigurationError('DB_PORT');
    }
    port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ConfigurationError('DB_PORT');
    }
  }
  return { host, port, username, password, database };
}

export function validateJwtSecret(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    Buffer.byteLength(value, 'utf8') < 32 ||
    containsControlCharacters(value) ||
    /^(.)\1*$/u.test(value) ||
    /change[-_ ]?me|replace[-_ ]?me|your[-_ ]?(?:jwt[-_ ]?)?secret|placeholder|example/iu.test(
      value,
    )
  ) {
    throw new ConfigurationError('JWT_SECRET');
  }
  return value;
}

export function validateJwtConfig(input: ConfigurationInput): {
  secret: string;
  expiresIn: number;
} {
  const secret = validateJwtSecret(input.JWT_SECRET);
  const duration = input.JWT_EXPIRATION;
  if (typeof duration !== 'string' || /\s/u.test(duration)) {
    throw new ConfigurationError('JWT_EXPIRATION');
  }
  const match = /^([1-9][0-9]*)([smhd])$/u.exec(duration);
  if (!match || match[0] !== duration) {
    throw new ConfigurationError('JWT_EXPIRATION');
  }
  const unitSeconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  const expiresIn = Number(match[1]) * unitSeconds[match[2]];
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 1 || expiresIn > 86400) {
    throw new ConfigurationError('JWT_EXPIRATION');
  }
  return { secret, expiresIn };
}

export function validateRuntimeConfig(
  input: ConfigurationInput,
): ConfigurationInput {
  const database = validateDatabaseConfig(input);
  validateJwtConfig(input);
  // Preserve secret bytes and the raw duration. Only signing options convert it.
  return { ...input, DB_PORT: database.port };
}
