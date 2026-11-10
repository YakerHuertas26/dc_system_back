import { PassThrough, Writable } from 'node:stream';
import type { WritableOptions } from 'node:stream';
import {
  BootstrapInputError,
  readBootstrapInput,
} from './bootstrap-admin.input';

class FakeTerminalInput extends PassThrough {
  isTTY = true;
  isRaw = false;
  setRawMode = jest.fn((mode: boolean) => {
    this.isRaw = mode;
    return this;
  });
}

class FakeTerminalOutput extends Writable {
  isTTY = true;
  text = '';

  constructor() {
    super({
      write: (chunk: Buffer, _encoding, done) => {
        this.text += chunk.toString('utf8');
        done();
      },
    } satisfies WritableOptions);
  }
}

describe('C3 hidden terminal input with fake streams only', () => {
  const password = 'Synthetic-Only-A9!';
  let input: FakeTerminalInput;
  let output: FakeTerminalOutput;

  beforeEach(() => {
    input = new FakeTerminalInput();
    output = new FakeTerminalOutput();
    input.pause();
  });

  function read() {
    return readBootstrapInput({ input, output });
  }

  function complete(secret = password, confirmation = secret) {
    for (const value of [
      'operator',
      'operator@example.invalid',
      secret,
      confirmation,
    ]) {
      input.emit('data', Buffer.from(`${value}\r\n`, 'utf8'));
    }
  }

  function expectRestored(raw = false, paused = true) {
    expect(input.isRaw).toBe(raw);
    expect(input.isPaused()).toBe(paused);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.listenerCount('end')).toBe(0);
    expect(input.listenerCount('close')).toBe(0);
    expect(input.listenerCount('error')).toBe(0);
    expect(output.listenerCount('error')).toBe(0);
  }

  it('collects individually submitted CRLF fields without echoing any supplied value', async () => {
    const result = read();
    complete();
    await expect(result).resolves.toEqual({
      name: 'operator',
      email: 'operator@example.invalid',
      password,
    });
    expect(output.text).toContain('Contraseña');
    expect(output.text).not.toContain(password);
    expect(output.text).not.toContain('operator');
    expect(output.text).not.toContain('example.invalid');
    expectRestored();
  });

  it('supports LF and CR as field delimiters without consuming the next field', async () => {
    const result = read();
    for (const value of [
      'operator\n',
      'operator@example.invalid\r',
      `${password}\n`,
      `${password}\r`,
    ]) {
      input.emit('data', value);
    }
    await expect(result).resolves.toMatchObject({ password });
    expectRestored();
  });

  it('preserves split UTF-8 characters and backspaces an entire character', async () => {
    const result = read();
    input.emit('data', Buffer.from('operX\x7fator\n', 'utf8'));
    input.emit('data', Buffer.from('operator@example.invalid\n', 'utf8'));
    const secret = 'Secure-A9!é';
    const bytes = Buffer.from(secret, 'utf8');
    input.emit('data', bytes.subarray(0, bytes.length - 1));
    input.emit('data', bytes.subarray(bytes.length - 1));
    input.emit('data', Buffer.from('\n', 'utf8'));
    input.emit('data', Buffer.from(`${secret}\n`, 'utf8'));
    await expect(result).resolves.toMatchObject({
      name: 'operator',
      password: secret,
    });
    expect(output.text).not.toContain(secret);
    expectRestored();
  });

  it('handles emoji backspace without leaving an unpaired surrogate', async () => {
    const result = read();
    input.emit('data', 'operator\n');
    input.emit('data', 'operator@example.invalid\n');
    input.emit('data', `${password}😀\x7f\n`);
    input.emit('data', `${password}\n`);
    await expect(result).resolves.toMatchObject({ password });
    expectRestored();
  });

  it('accepts a password of exactly 72 UTF-8 bytes without changing it', async () => {
    const secret = 'Aa1!' + 'é'.repeat(34);
    expect(Buffer.byteLength(secret, 'utf8')).toBe(72);
    const result = read();
    complete(secret);
    await expect(result).resolves.toMatchObject({ password: secret });
    expectRestored();
  });

  it('rejects more than 72 UTF-8 bytes instead of truncating', async () => {
    const secret = 'Aa1!' + 'é'.repeat(35);
    const result = read();
    complete(secret);
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_INVALID',
    });
    expect(output.text).not.toContain(secret);
    expectRestored();
  });

  it.each([' name', 'name ', ''])(
    'rejects an invalid name without normalizing it',
    async (name) => {
      const result = read();
      input.emit('data', `${name}\n`);
      await expect(result).rejects.toMatchObject({
        code: 'BOOTSTRAP_INPUT_INVALID',
      });
      expectRestored();
    },
  );

  it.each([` ${password}`, `${password} `])(
    'rejects password edges instead of trimming the secret',
    async (secret) => {
      const result = read();
      complete(secret);
      await expect(result).rejects.toMatchObject({
        code: 'BOOTSTRAP_INPUT_INVALID',
      });
      expect(output.text).not.toContain(secret);
      expectRestored();
    },
  );

  it('rejects a different confirmation without echoing either value', async () => {
    const result = read();
    complete(password, 'Different-Only-A9!');
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_PASSWORD_MISMATCH',
    });
    expect(output.text).not.toContain(password);
    expect(output.text).not.toContain('Different-Only-A9!');
    expectRestored();
  });

  it.each(['\x03', '\x04'])(
    'cancels safely on terminal interrupt/end-of-input',
    async (control) => {
      const result = read();
      input.emit(
        'data',
        `operator\noperator@example.invalid\n${password}${control}`,
      );
      await expect(result).rejects.toMatchObject({
        code: 'BOOTSTRAP_CANCELLED',
      });
      expect(output.text).not.toContain(password);
      expectRestored();
    },
  );

  it.each(['end', 'close'])(
    'cancels on stream %s and restores the terminal',
    async (event) => {
      const result = read();
      input.emit('data', 'operator\n');
      input.emit('data', 'operator@example.invalid\n');
      input.emit('data', 'partial-secret');
      input.emit(event);
      await expect(result).rejects.toMatchObject({
        code: 'BOOTSTRAP_CANCELLED',
      });
      expect(output.text).not.toContain('partial-secret');
      expectRestored();
    },
  );

  it('sanitizes input errors without printing their private payload', async () => {
    const result = read();
    input.emit('error', new Error('Synthetic-private-input-error'));
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(output.text).not.toContain('Synthetic-private-input-error');
    expectRestored();
  });

  it('restores input when output emits an error', async () => {
    const result = read();
    output.emit('error', new Error('Synthetic-private-output-error'));
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(output.text).not.toContain('Synthetic-private-output-error');
    expectRestored();
  });

  it('restores an already-raw, previously flowing terminal', async () => {
    input.isRaw = true;
    input.resume();
    const result = read();
    complete();
    await expect(result).resolves.toBeDefined();
    expectRestored(true, false);
  });

  it('preserves unrelated existing end/error listeners', async () => {
    const priorEnd = jest.fn();
    const priorError = jest.fn();
    input.on('end', priorEnd);
    output.on('error', priorError);
    const result = read();
    complete();
    await expect(result).resolves.toBeDefined();
    expect(input.listeners('end')).toEqual([priorEnd]);
    expect(output.listeners('error')).toEqual([priorError]);
    expect(input.listenerCount('data')).toBe(0);
    expect(input.isRaw).toBe(false);
    expect(input.isPaused()).toBe(true);
  });

  it.each(['input', 'output'] as const)(
    'rejects non-TTY %s before prompting or raw mode',
    async (stream) => {
      ({ input, output })[stream].isTTY = false;
      await expect(read()).rejects.toMatchObject({
        code: 'BOOTSTRAP_TTY_REQUIRED',
      });
      expect(output.text).toBe('');
      expect(input.setRawMode).not.toHaveBeenCalled();
    },
  );

  it('rejects an input stream already observed by another data consumer', async () => {
    const priorData = jest.fn();
    input.on('data', priorData);
    await expect(read()).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_BUSY',
    });
    expect(output.text).toBe('');
    expect(input.setRawMode).not.toHaveBeenCalled();
    expect(input.listeners('data')).toEqual([priorData]);
  });

  it.each(['\x00', '\x1b', '\t'])(
    'rejects unexpected terminal controls without echo',
    async (control) => {
      const result = read();
      input.emit('data', 'operator\n');
      input.emit('data', 'operator@example.invalid\n');
      input.emit('data', `${password}${control}`);
      await expect(result).rejects.toMatchObject({
        code: 'BOOTSTRAP_INPUT_INVALID',
      });
      expect(output.text).not.toContain(password);
      expectRestored();
    },
  );

  it('rejects malformed UTF-8 instead of silently replacing bytes', async () => {
    const result = read();
    input.emit('data', Buffer.from([0xc3, 0x28]));
    await expect(result).rejects.toBeInstanceOf(BootstrapInputError);
    expectRestored();
  });

  it('restores state even when enabling raw mode fails', async () => {
    input.setRawMode.mockImplementationOnce(() => {
      throw new Error('Synthetic-private-raw-error');
    });
    await expect(read()).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    expectRestored();
  });

  it('reports unsuccessful raw-mode restoration instead of returning a successful input', async () => {
    input.setRawMode
      .mockImplementationOnce((mode) => {
        input.isRaw = mode;
        return input;
      })
      .mockImplementationOnce(() => {
        throw new Error('Synthetic-private-restore-error');
      });
    const result = read();
    complete();
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(input.listenerCount('data')).toBe(0);
    expect(input.isPaused()).toBe(true);
  });

  it('rejects multiline paste without submitting another prompt automatically', async () => {
    const result = read();
    input.emit(
      'data',
      `operator\noperator@example.invalid\n${password}\n${password}\n`,
    );
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_INVALID',
    });
    expect(output.text).not.toContain(password);
    expect(output.text).not.toContain('Correo electrónico');
    expectRestored();
  });

  it('clears the current field on Ctrl-U without echoing discarded content', async () => {
    const result = read();
    input.emit('data', 'discarded\x15operator\n');
    input.emit('data', 'operator@example.invalid\n');
    input.emit('data', `discarded-secret\x15${password}\n`);
    input.emit('data', `${password}\n`);
    await expect(result).resolves.toMatchObject({ name: 'operator', password });
    expect(output.text).not.toContain('discarded');
    expectRestored();
  });

  it('leaves a previously untouched input paused instead of keeping stdin alive', async () => {
    input = new FakeTerminalInput();
    expect(input.readableFlowing).toBe(null);
    const result = read();
    complete();
    await expect(result).resolves.toBeDefined();
    expectRestored();
  });

  it('rejects ineffectual raw-mode activation before prompting or accepting input', async () => {
    input.setRawMode.mockImplementationOnce(() => input);
    const result = read();
    complete();
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(output.text).toBe('');
    expectRestored();
  });

  it('rejects ineffectual raw-mode restoration instead of returning input', async () => {
    input.setRawMode
      .mockImplementationOnce((mode) => {
        input.isRaw = mode;
        return input;
      })
      .mockImplementationOnce(() => input);
    const result = read();
    complete();
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(input.listenerCount('data')).toBe(0);
    expect(input.isPaused()).toBe(true);
  });

  it('rejects ineffectual paused-state restoration instead of returning input', async () => {
    jest.spyOn(input, 'pause').mockImplementation(() => input);
    const result = read();
    complete();
    await expect(result).rejects.toMatchObject({
      code: 'BOOTSTRAP_INPUT_FAILED',
    });
    expect(input.listenerCount('data')).toBe(0);
    expect(input.isRaw).toBe(false);
  });

  it('rejects already-ended input before prompting or changing its mode', async () => {
    Object.defineProperty(input, 'readableEnded', { value: true });
    const result = read();
    complete();
    await expect(result).rejects.toMatchObject({ code: 'BOOTSTRAP_CANCELLED' });
    expect(output.text).toBe('');
    expect(input.setRawMode).not.toHaveBeenCalled();
  });

  it('cancels an incomplete final UTF-8 sequence on EOF without replacement or hanging', async () => {
    const result = read();
    input.emit('data', Buffer.from([0xc3]));
    input.emit('end');
    await expect(result).rejects.toMatchObject({ code: 'BOOTSTRAP_CANCELLED' });
    expectRestored();
  });
});
