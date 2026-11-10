import type { Readable, Writable } from 'node:stream';
import { TextDecoder } from 'node:util';
import type { AdminBootstrapInput } from '../modules/users/admin-bootstrap.service';

export type BootstrapInputCode =
  | 'BOOTSTRAP_TTY_REQUIRED'
  | 'BOOTSTRAP_INPUT_BUSY'
  | 'BOOTSTRAP_CANCELLED'
  | 'BOOTSTRAP_INPUT_INVALID'
  | 'BOOTSTRAP_PASSWORD_MISMATCH'
  | 'BOOTSTRAP_INPUT_FAILED';

export class BootstrapInputError extends Error {
  constructor(readonly code: BootstrapInputCode) {
    super(code);
    this.name = 'BootstrapInputError';
  }
}

export interface BootstrapInputStream extends Readable {
  isTTY?: boolean;
  isRaw?: boolean;
  setRawMode: (mode: boolean) => unknown;
}

export interface BootstrapOutputStream extends Writable {
  isTTY?: boolean;
}

export interface BootstrapTerminal {
  input: BootstrapInputStream;
  output: BootstrapOutputStream;
}

export async function readBootstrapInput(
  terminal: BootstrapTerminal = {
    input: process.stdin,
    output: process.stdout,
  },
): Promise<AdminBootstrapInput> {
  const { input, output } = terminal;
  if (
    input.isTTY !== true ||
    output.isTTY !== true ||
    typeof input.setRawMode !== 'function'
  ) {
    throw new BootstrapInputError('BOOTSTRAP_TTY_REQUIRED');
  }
  if (
    input.readableEnded ||
    input.destroyed ||
    output.writableEnded ||
    output.destroyed
  ) {
    throw new BootstrapInputError('BOOTSTRAP_CANCELLED');
  }
  // An unrelated observer must not receive the secret via a second listener.
  if (
    input.listenerCount('data') !== 0 ||
    input.listenerCount('readable') !== 0
  ) {
    throw new BootstrapInputError('BOOTSTRAP_INPUT_BUSY');
  }
  const previousRaw = input.isRaw === true;
  const wasFlowing = input.readableFlowing === true;
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const prompts = [
    'Nombre del nuevo administrador: ',
    'Correo electrónico: ',
    'Contraseña: ',
    'Confirmar contraseña: ',
  ];
  const values: string[] = [];
  let characters: string[] = [];
  let skipNextLf = false;
  let settled = false;
  let result: AdminBootstrapInput | undefined;
  let failure: BootstrapInputError | undefined;
  let resolveInput: (value: AdminBootstrapInput) => void = () => undefined;
  let rejectInput: (error: BootstrapInputError) => void = () => undefined;

  const fail = (code: BootstrapInputCode) => {
    if (settled) return;
    settled = true;
    rejectInput(new BootstrapInputError(code));
  };
  const onEnd = () => fail('BOOTSTRAP_CANCELLED');
  const onError = () => fail('BOOTSTRAP_INPUT_FAILED');
  const submit = () => {
    const value = characters.join('');
    if (value.length === 0 || value !== value.trim()) {
      fail('BOOTSTRAP_INPUT_INVALID');
      return;
    }
    values.push(value);
    characters = [];
    output.write('\n');
    if (values.length < 4) {
      output.write(prompts[values.length]);
      return;
    }
    if (values[2] !== values[3]) {
      fail('BOOTSTRAP_PASSWORD_MISMATCH');
      return;
    }
    settled = true;
    resolveInput({ name: values[0], email: values[1], password: values[2] });
  };
  const onData = (chunk: unknown) => {
    if (settled) return;
    try {
      let text: string;
      if (typeof chunk === 'string') text = chunk;
      else if (Buffer.isBuffer(chunk))
        text = decoder.decode(chunk, { stream: true });
      else {
        fail('BOOTSTRAP_INPUT_INVALID');
        return;
      }
      if (text.length === 0) return;
      if (text.includes('\x03') || text.includes('\x04')) {
        fail('BOOTSTRAP_CANCELLED');
        return;
      }
      if (skipNextLf) {
        skipNextLf = false;
        if (text.startsWith('\n')) text = text.slice(1);
      }
      // Permit paste of one field, never automatic multiline submission of
      // another prompt. CRLF is one terminator, including across chunks.
      const delimiter = text.search(/[\r\n]/u);
      if (
        delimiter !== -1 &&
        !['\r', '\n', '\r\n'].includes(text.slice(delimiter))
      ) {
        fail('BOOTSTRAP_INPUT_INVALID');
        return;
      }
      for (const character of text) {
        if (settled) break;
        if (character === '\r' || character === '\n') {
          if (character === '\n' && skipNextLf) {
            skipNextLf = false;
            continue;
          }
          submit();
          skipNextLf = character === '\r';
          continue;
        }
        if (character === '\x08' || character === '\x7f') {
          characters.pop();
          continue;
        }
        if (character === '\x15') {
          characters = [];
          continue;
        }
        const code = character.codePointAt(0)!;
        if (code < 32 || code === 127 || (code >= 0xd800 && code <= 0xdfff)) {
          fail('BOOTSTRAP_INPUT_INVALID');
          return;
        }
        characters.push(character);
        const limit = values.length === 0 ? 25 : values.length === 1 ? 50 : 72;
        if (
          characters.length > limit ||
          (values.length >= 2 &&
            Buffer.byteLength(characters.join(''), 'utf8') > 72)
        ) {
          fail('BOOTSTRAP_INPUT_INVALID');
          return;
        }
      }
    } catch {
      fail('BOOTSTRAP_INPUT_INVALID');
    }
  };

  try {
    result = await new Promise<AdminBootstrapInput>((resolve, reject) => {
      resolveInput = resolve;
      rejectInput = reject;
      input.pause();
      input.setRawMode(true);
      if (input.isRaw !== true) {
        throw new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
      }
      input.on('data', onData);
      input.on('end', onEnd);
      input.on('close', onEnd);
      input.on('error', onError);
      output.on('error', onError);
      output.write(prompts[0]);
      input.resume();
    });
  } catch (error) {
    failure =
      error instanceof BootstrapInputError
        ? error
        : new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
  } finally {
    input.removeListener('data', onData);
    input.removeListener('end', onEnd);
    input.removeListener('close', onEnd);
    input.removeListener('error', onError);
    output.removeListener('error', onError);
    try {
      input.setRawMode(previousRaw);
      if (input.isRaw !== previousRaw) {
        failure = new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
      }
    } catch {
      failure = new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
    }
    // A previously untouched stream has flowing=null; leave it paused rather
    // than keep stdin active after this command. Only an already flowing input
    // is resumed. Public stream APIs cannot restore the original null exactly.
    try {
      if (wasFlowing) input.resume();
      else input.pause();
      if (input.isPaused() !== !wasFlowing) {
        failure = new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
      }
    } catch {
      failure = new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
    }
    // These references are released; JavaScript cannot promise erasure of all
    // copies of immutable strings. Nothing is written to a temporary file.
    characters = [];
    values.fill('');
  }
  if (failure) throw failure;
  if (!result) throw new BootstrapInputError('BOOTSTRAP_INPUT_FAILED');
  return result;
}
