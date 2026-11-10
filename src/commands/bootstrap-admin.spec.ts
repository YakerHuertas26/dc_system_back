import 'reflect-metadata';
import {
  AdminBootstrapError,
  AdminBootstrapCode,
} from '../modules/users/admin-bootstrap.service';
import { BootstrapInputError } from './bootstrap-admin.input';
import { runBootstrapAdmin } from './bootstrap-admin';

describe('C3 bootstrap command with injected input/service only', () => {
  const identity = {
    name: 'operator',
    email: 'operator@example.invalid',
    password: 'Synthetic-Only-A9!',
  };
  const configuration = {
    DB_HOST: '127.0.0.1',
    DB_USER: 'synthetic_operator',
    DB_PASSWORD: 'Synthetic-config-only-A9!',
    DB_NAME: 'synthetic_database',
  };
  let readInput: jest.Mock;
  let bootstrap: jest.Mock;
  let output: { out: jest.Mock; err: jest.Mock };

  beforeEach(() => {
    readInput = jest.fn().mockResolvedValue({ ...identity });
    bootstrap = jest.fn().mockResolvedValue({ userId: 17 });
    output = { out: jest.fn(), err: jest.fn() };
  });

  function execute(argv: readonly string[] = []) {
    return runBootstrapAdmin(configuration, {
      argv,
      readInput,
      bootstrap,
      output,
    });
  }

  it('collects input before invoking the service and prints only the created identifier', async () => {
    expect(await execute()).toBe(0);
    expect(readInput).toHaveBeenCalledTimes(1);
    expect(bootstrap).toHaveBeenCalledWith(identity, configuration);
    expect(readInput.mock.invocationCallOrder[0]).toBeLessThan(
      bootstrap.mock.invocationCallOrder[0],
    );
    expect(output.out).toHaveBeenCalledWith('BOOTSTRAP_ADMIN_CREATED:17');
    expect(output.err).not.toHaveBeenCalled();
  });

  it.each(['--password=synthetic-private', '--roleId=1', 'unexpected'])(
    'rejects every argument before input/service invocation',
    async (argument) => {
      expect(await execute([argument])).toBe(1);
      expect(readInput).not.toHaveBeenCalled();
      expect(bootstrap).not.toHaveBeenCalled();
      expect(output.out).not.toHaveBeenCalled();
      expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_ARGUMENTS_INVALID');
    },
  );

  it('rejects missing DB configuration before asking for a password', async () => {
    expect(await runBootstrapAdmin({}, { readInput, bootstrap, output })).toBe(
      1,
    );
    expect(readInput).not.toHaveBeenCalled();
    expect(bootstrap).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_CONFIGURATION_INVALID');
  });

  it('does not invoke the service when the operator cancels', async () => {
    readInput.mockRejectedValue(new BootstrapInputError('BOOTSTRAP_CANCELLED'));
    expect(await execute()).toBe(1);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_CANCELLED');
  });

  it('does not invoke the service when TTY input is unavailable', async () => {
    readInput.mockRejectedValue(
      new BootstrapInputError('BOOTSTRAP_TTY_REQUIRED'),
    );
    expect(await execute()).toBe(1);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_TTY_REQUIRED');
  });

  it.each<AdminBootstrapCode>([
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
  ])(
    'prints the reviewed service failure code %s without retrying',
    async (code) => {
      bootstrap.mockRejectedValue(new AdminBootstrapError(code));
      expect(await execute()).toBe(1);
      expect(bootstrap).toHaveBeenCalledTimes(1);
      expect(output.out).not.toHaveBeenCalled();
      expect(output.err).toHaveBeenCalledWith(code);
    },
  );

  it('does not inspect or print private original error fields', async () => {
    const privateError = new Error();
    for (const key of ['message', 'stack', 'cause', 'code']) {
      Object.defineProperty(privateError, key, {
        get: () => {
          throw new Error('Private field accessed');
        },
      });
    }
    bootstrap.mockRejectedValue(privateError);
    expect(await execute()).toBe(1);
    expect(output.out).not.toHaveBeenCalled();
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_FAILED');
  });

  it('does not forward an unreviewed code from a bootstrap error instance', async () => {
    const error = new AdminBootstrapError('BOOTSTRAP_FAILED');
    Object.defineProperty(error, 'code', { value: 'Synthetic-private-code' });
    bootstrap.mockRejectedValue(error);
    expect(await execute()).toBe(1);
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_FAILED');
  });

  it.each([0, -1, 17.5, Number.MAX_SAFE_INTEGER + 1, 'Synthetic-private-id'])(
    'does not print an invalid service result identifier',
    async (userId) => {
      bootstrap.mockResolvedValue({ userId });
      expect(await execute()).toBe(1);
      expect(output.out).not.toHaveBeenCalled();
      expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_FAILED');
    },
  );

  it('handles output failure without exposing errors or retrying committed work', async () => {
    output.out.mockImplementation(() => {
      throw new Error('Synthetic-private-output');
    });
    expect(await execute()).toBe(1);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(output.err).toHaveBeenCalledWith('BOOTSTRAP_OUTPUT_FAILED');
  });

  it('does not reject with a private error when stderr itself fails', async () => {
    readInput.mockRejectedValue(new BootstrapInputError('BOOTSTRAP_CANCELLED'));
    output.err.mockImplementation(() => {
      throw new Error('Synthetic-private-stderr');
    });
    await expect(execute()).resolves.toBe(1);
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('does not start input or bootstrap when imported as a module', () => {
    jest.isolateModules(() => {
      const service = jest.requireActual<
        typeof import('../modules/users/admin-bootstrap.service')
      >('../modules/users/admin-bootstrap.service');
      const operation = jest.spyOn(service, 'bootstrapFirstAdmin');
      const promptModule = jest.requireActual<
        typeof import('./bootstrap-admin.input')
      >('./bootstrap-admin.input');
      const prompt = jest.spyOn(promptModule, 'readBootstrapInput');
      const cli =
        jest.requireActual<typeof import('./bootstrap-admin')>(
          './bootstrap-admin',
        );
      expect(typeof cli.runBootstrapAdmin).toBe('function');
      expect(operation).not.toHaveBeenCalled();
      expect(prompt).not.toHaveBeenCalled();
      operation.mockRestore();
      prompt.mockRestore();
    });
  });
});
