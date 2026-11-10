import {
  AdminBootstrapError,
  bootstrapFirstAdmin,
} from '../modules/users/admin-bootstrap.service';
import type {
  AdminBootstrapInput,
  AdminBootstrapResult,
} from '../modules/users/admin-bootstrap.service';
import {
  ConfigurationError,
  validateDatabaseConfig,
} from '../config/runtime-config';
import {
  BootstrapInputError,
  readBootstrapInput,
} from './bootstrap-admin.input';

const allowedErrorCodes = new Set([
  'BOOTSTRAP_INPUT_INVALID',
  'BOOTSTRAP_CONFIGURATION_INVALID',
  'BOOTSTRAP_ALREADY_INITIALIZED',
  'BOOTSTRAP_IDENTITY_EXISTS',
  'BOOTSTRAP_ROLES_INCONSISTENT',
  'BOOTSTRAP_SCHEMA_UNSUPPORTED',
  'BOOTSTRAP_IN_PROGRESS',
  'BOOTSTRAP_LOCK_FAILED',
  'BOOTSTRAP_FAILED',
  'BOOTSTRAP_COMMIT_UNCERTAIN',
  'BOOTSTRAP_CLEANUP_UNCERTAIN',
  'BOOTSTRAP_TTY_REQUIRED',
  'BOOTSTRAP_INPUT_BUSY',
  'BOOTSTRAP_CANCELLED',
  'BOOTSTRAP_PASSWORD_MISMATCH',
  'BOOTSTRAP_INPUT_FAILED',
]);

export interface BootstrapAdminOutput {
  out: (message: string) => void;
  err: (message: string) => void;
}

export interface BootstrapAdminDependencies {
  argv?: readonly string[];
  readInput?: () => Promise<AdminBootstrapInput>;
  bootstrap?: (
    identity: AdminBootstrapInput,
    configuration: Record<string, unknown>,
  ) => Promise<AdminBootstrapResult>;
  output?: BootstrapAdminOutput;
}

function safeErrorCode(error: unknown): string {
  try {
    if (error instanceof ConfigurationError)
      return 'BOOTSTRAP_CONFIGURATION_INVALID';
    if (
      !(error instanceof AdminBootstrapError) &&
      !(error instanceof BootstrapInputError)
    ) {
      return 'BOOTSTRAP_FAILED';
    }
    // Read only an own data property; never invoke a getter or inspect the
    // original error's message, stack, cause or SQL payload.
    const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
    const code: unknown = descriptor?.value;
    return typeof code === 'string' && allowedErrorCodes.has(code)
      ? code
      : 'BOOTSTRAP_FAILED';
  } catch {
    return 'BOOTSTRAP_FAILED';
  }
}

function writeSafely(
  writer: (message: string) => void,
  message: string,
): boolean {
  try {
    writer(message);
    return true;
  } catch {
    return false;
  }
}

export async function runBootstrapAdmin(
  configuration: Record<string, unknown>,
  dependencies: BootstrapAdminDependencies = {},
): Promise<number> {
  const output = dependencies.output ?? {
    out: (message: string) => {
      process.stdout.write(`${message}\n`);
    },
    err: (message: string) => {
      process.stderr.write(`${message}\n`);
    },
  };
  if ((dependencies.argv ?? []).length !== 0) {
    writeSafely(output.err, 'BOOTSTRAP_ARGUMENTS_INVALID');
    return 1;
  }
  try {
    validateDatabaseConfig(configuration);
    const identity = await (dependencies.readInput ?? readBootstrapInput)();
    const result = await (dependencies.bootstrap ?? bootstrapFirstAdmin)(
      identity,
      configuration,
    );
    if (!Number.isSafeInteger(result?.userId) || result.userId <= 0) {
      writeSafely(output.err, 'BOOTSTRAP_FAILED');
      return 1;
    }
    if (!writeSafely(output.out, `BOOTSTRAP_ADMIN_CREATED:${result.userId}`)) {
      writeSafely(output.err, 'BOOTSTRAP_OUTPUT_FAILED');
      return 1;
    }
    return 0;
  } catch (error) {
    writeSafely(output.err, safeErrorCode(error));
    return 1;
  }
}

// Importing this module never reads configuration/stdin or opens a datasource.
// Entry execution still requires the separately authorized operational window.
if (require.main === module) {
  void runBootstrapAdmin(process.env, { argv: process.argv.slice(2) }).then(
    (status) => {
      process.exitCode = status;
    },
  );
}
