import bcrypt from 'bcrypt';
import { HttpException } from '@nestjs/common';
import { hashNewPassword } from './password-hasher';

async function passwordFailure(value: unknown): Promise<HttpException> {
  let failure: unknown;
  try {
    await hashNewPassword(value);
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof HttpException).toBe(true);
  return failure as HttpException;
}

describe('C2 new password hashing contract', () => {
  it('produces a full bcrypt hash with the existing cost and verifies only the supplied password', async () => {
    const value = 'Synthetic1!Password';
    const hash = await hashNewPassword(value);
    expect(hash.length).toBe(60);
    expect(hash === value).toBe(false);
    expect(bcrypt.getRounds(hash)).toBe(10);
    expect(await bcrypt.compare(value, hash)).toBe(true);
    expect(await bcrypt.compare('Synthetic2!Different', hash)).toBe(false);
  });

  it('uses a fresh salt instead of deterministic or shared hashes', async () => {
    const value = 'Synthetic1!Password';
    const first = await hashNewPassword(value);
    const second = await hashNewPassword(value);
    expect(first === second).toBe(false);
    expect(await bcrypt.compare(value, first)).toBe(true);
    expect(await bcrypt.compare(value, second)).toBe(true);
  });

  it.each(['$2a$', '$2b$'])(
    'does not trust a supplied bcrypt-looking prefix case %#',
    async (prefix) => {
      const value = `${prefix}Synthetic1!Plaintext`;
      const hash = await hashNewPassword(value);
      expect(hash === value).toBe(false);
      expect(hash.length).toBe(60);
      expect(await bcrypt.compare(value, hash)).toBe(true);
    },
  );

  it('preserves raw helper input without silently trimming whitespace', async () => {
    const value = 'Synthetic1! trailing ';
    const hash = await hashNewPassword(value);
    expect(await bcrypt.compare(value, hash)).toBe(true);
    expect(await bcrypt.compare(value.trim(), hash)).toBe(false);
  });

  it.each([
    undefined,
    null,
    42,
    {},
    ['Synthetic1!Value'],
    '',
    'Ab1!xyz',
    'synthetic1!lowercase',
    'SYNTHETIC1!UPPERCASE',
    'Synthetic!NoDigits',
    'Synthetic1NoSpecial',
  ])('rejects invalid new password inputs with 400 case %#', async (value) => {
    const error = await passwordFailure(value);
    expect(error.getStatus()).toBe(400);
    const response = JSON.stringify(error.getResponse());
    if (typeof value === 'string' && value.length > 0) {
      expect(response.includes(value)).toBe(false);
    }
  });

  it('accepts exactly 72 UTF-8 bytes without truncating or prehashing', async () => {
    const value = `Ab1!${'x'.repeat(68)}`;
    expect(Buffer.byteLength(value, 'utf8')).toBe(72);
    const hash = await hashNewPassword(value);
    expect(await bcrypt.compare(value, hash)).toBe(true);
    expect(hash.length).toBe(60);
  });

  it('rejects 73 ASCII bytes before bcrypt can silently truncate them', async () => {
    const value = `Ab1!${'x'.repeat(69)}`;
    expect(Buffer.byteLength(value, 'utf8')).toBe(73);
    expect((await passwordFailure(value)).getStatus()).toBe(400);
  });

  it('accepts a multibyte password at exactly 72 UTF-8 bytes', async () => {
    const value = `Ab1!${'\u00e9'.repeat(34)}`;
    expect(Buffer.byteLength(value, 'utf8')).toBe(72);
    expect(Array.from(value).length < 72).toBe(true);
    const hash = await hashNewPassword(value);
    expect(await bcrypt.compare(value, hash)).toBe(true);
  });

  it('rejects a multibyte password exceeding 72 bytes even when its character count is small', async () => {
    const value = `Ab1!${'\u00e9'.repeat(34)}x`;
    expect(Buffer.byteLength(value, 'utf8')).toBe(73);
    expect(Array.from(value).length < 72).toBe(true);
    expect((await passwordFailure(value)).getStatus()).toBe(400);
  });

  it('measures the minimum length in Unicode code points rather than UTF-16 units', async () => {
    const tooShort = 'Ab1!\u{1f600}\u{1f600}';
    expect(tooShort.length).toBe(8);
    expect(Array.from(tooShort).length).toBe(6);
    expect((await passwordFailure(tooShort)).getStatus()).toBe(400);
    const valid = 'Ab1!\u{1f600}\u{1f600}\u{1f600}\u{1f600}';
    const hash = await hashNewPassword(valid);
    expect(await bcrypt.compare(valid, hash)).toBe(true);
  });

  it('sanitizes an asynchronous crypto failure as 500 without exposing input or underlying details', async () => {
    const value = 'Synthetic1!PrivateInput';
    const cryptoMessage = 'SYNTHETIC-crypto-private-detail';
    // This typed view references the same bcrypt export object and selects the
    // two-argument Promise overload used by the production helper.
    const promiseHasher: {
      hash(
        data: string | Buffer,
        saltOrRounds: string | number,
      ): Promise<string>;
    } = bcrypt;
    const hash = jest
      .spyOn(promiseHasher, 'hash')
      .mockRejectedValue(new Error(cryptoMessage));
    try {
      const error = await passwordFailure(value);
      expect(error.getStatus()).toBe(500);
      const output = `${String(error)} ${JSON.stringify(error.getResponse())} ${error.stack ?? ''}`;
      expect(output.includes(value)).toBe(false);
      expect(output.includes(cryptoMessage)).toBe(false);
      expect('cause' in error).toBe(false);
    } finally {
      hash.mockRestore();
    }
  });
});
