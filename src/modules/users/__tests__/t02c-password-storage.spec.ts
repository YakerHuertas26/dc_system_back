import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { HttpException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntityManager, getMetadataArgsStorage, Repository } from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { RolesService } from '../../roles/roles.service';
import { AuthService } from '../../auth/auth.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';

const originalPassword = 'Synthetic1!Original';

function createInput(password: unknown = 'Synthetic1!New'): CreateUserDto {
  return {
    name: 'synthetic-new',
    email: 'new@example.invalid',
    roleId: 2,
    password,
  } as CreateUserDto;
}

async function storageFixture(replayListeners = false) {
  const admin = Object.assign(new Role(), { roleId: 1, name: 'Admin' });
  const seller = Object.assign(new Role(), { roleId: 2, name: 'Vendedor' });
  let persisted = Object.assign(new User(), {
    userId: 3,
    name: 'synthetic-existing',
    email: 'existing@example.invalid',
    roleId: 2,
    role: seller,
    state: true,
    password: await bcrypt.hash(originalPassword, 4),
  });
  const copy = (value: User) => Object.assign(new User(), value);
  const created = new WeakSet<User>();
  const repository = {
    exists: jest.fn().mockResolvedValue(false),
    findOne: jest.fn(() => Promise.resolve(copy(persisted))),
    findAndCount: jest.fn(() => Promise.resolve([[copy(persisted)], 1])),
    create: jest.fn((input: Partial<User>) => {
      const value = Object.assign(new User(), input, {
        userId: 4,
        state: true,
      });
      created.add(value);
      return value;
    }),
    // No lifecycle behavior is assumed by default: the new approved contract
    // requires UsersService to hash a new password before persistence.
    save: jest.fn(async (value: User) => {
      if (replayListeners) {
        const operation = created.has(value)
          ? 'before-insert'
          : 'before-update';
        for (const listener of getMetadataArgsStorage().entityListeners) {
          if (listener.target === User && listener.type === operation) {
            const callback = Reflect.get(value, listener.propertyName) as
              | (() => Promise<void>)
              | undefined;
            if (typeof callback === 'function') await callback.call(value);
          }
        }
      }
      persisted = copy(value);
      return copy(value);
    }),
  };
  const manager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity !== User) throw new Error('Unexpected entity');
      return repository;
    }),
  } as unknown as EntityManager;
  const roles = {
    withAdminTransaction: jest.fn(
      async (
        actorId: number | undefined,
        action: (manager: EntityManager, adminRole: Role) => Promise<unknown>,
      ) => {
        if (actorId !== 1) throw new UnauthorizedException();
        return action(manager, admin);
      },
    ),
    findAssignableRole: jest.fn((roleId: number) =>
      Promise.resolve(roleId === 1 ? admin : seller),
    ),
  };
  return {
    repository,
    roles,
    service: new UsersService(
      repository as unknown as Repository<User>,
      roles as unknown as RolesService,
    ),
    persisted: () => persisted,
  };
}

async function expectBadPassword(action: Promise<unknown>) {
  let failure: unknown;
  try {
    await action;
  } catch (error) {
    failure = error;
  }
  expect(failure instanceof HttpException).toBe(true);
  expect((failure as HttpException).getStatus()).toBe(400);
}

describe('C2 service password persistence boundary', () => {
  it('hashes a new account password before passing it to persistence', async () => {
    const { service, persisted, repository, roles } = await storageFixture();
    const input = createInput();
    const result = await service.create(input, 1);
    expect(await bcrypt.compare(input.password, persisted().password)).toBe(
      true,
    );
    expect(persisted().password === input.password).toBe(false);
    expect(bcrypt.getRounds(persisted().password)).toBe(10);
    expect(Object.prototype.hasOwnProperty.call(result, 'password')).toBe(
      false,
    );
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(roles.withAdminTransaction).toHaveBeenCalledWith(
      1,
      expect.any(Function),
    );
  });

  it('treats a new password starting with a bcrypt-looking prefix as untrusted plaintext', async () => {
    const { service, persisted } = await storageFixture(true);
    const password = '$2b$Synthetic1!Plaintext';
    const result = await service.update(3, { password }, 1);
    expect(await bcrypt.compare(password, persisted().password)).toBe(true);
    expect(persisted().password === password).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, 'password')).toBe(
      false,
    );
  });

  it('does not hash twice when actual entity listeners are replayed on insert', async () => {
    const { service, persisted } = await storageFixture(true);
    const input = createInput();
    await service.create(input, 1);
    expect(await bcrypt.compare(input.password, persisted().password)).toBe(
      true,
    );
  });

  it('stores a new update password as a fresh hash and redacts its response', async () => {
    const { service, persisted } = await storageFixture();
    const password = 'Synthetic1!Changed';
    const previous = persisted().password;
    const result = await service.update(3, { password }, 1);
    expect(await bcrypt.compare(password, persisted().password)).toBe(true);
    expect(await bcrypt.compare(originalPassword, persisted().password)).toBe(
      false,
    );
    expect(persisted().password === previous).toBe(false);
    expect(bcrypt.getRounds(persisted().password)).toBe(10);
    expect(Object.prototype.hasOwnProperty.call(result, 'password')).toBe(
      false,
    );
  });

  it.each([{}, { password: undefined }])(
    'preserves the existing hash when the password is omitted case %#',
    async (patch) => {
      const { service, persisted } = await storageFixture(true);
      const previous = persisted().password;
      const result = await service.update(
        3,
        { ...patch, name: 'synthetic-renamed' },
        1,
      );
      expect(persisted().password === previous).toBe(true);
      expect(await bcrypt.compare(originalPassword, persisted().password)).toBe(
        true,
      );
      expect(Object.prototype.hasOwnProperty.call(result, 'password')).toBe(
        false,
      );
    },
  );

  it.each([null, '', 42, {}, 'Ab1!'.concat('x'.repeat(69))])(
    'rejects a present invalid update password without writes case %#',
    async (value) => {
      const { service, persisted, repository } = await storageFixture();
      const previous = persisted().password;
      await expectBadPassword(
        service.update(3, { password: value } as UpdateUserDto, 1),
      );
      expect(repository.save).not.toHaveBeenCalled();
      expect(persisted().password === previous).toBe(true);
    },
  );

  it.each([null, '', 42, {}, 'Ab1!'.concat('x'.repeat(69))])(
    'rejects an invalid account password without writes case %#',
    async (value) => {
      const { service, repository } = await storageFixture();
      await expectBadPassword(service.create(createInput(value), 1));
      expect(repository.save).not.toHaveBeenCalled();
    },
  );

  it('does not expose a selected hash in the deactivation response', async () => {
    const { service, persisted } = await storageFixture();
    const previous = persisted().password;
    const result = await service.remove(3, 1);
    expect(persisted().state).toBe(false);
    expect(persisted().password === previous).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(result, 'password')).toBe(
      false,
    );
  });

  it('does not hash or persist through the service when actor authorization fails', async () => {
    const { service, repository } = await storageFixture();
    const hash = jest.spyOn(bcrypt, 'hash');
    try {
      await expect(
        service.create(createInput(), undefined),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(hash).not.toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    } finally {
      hash.mockRestore();
    }
  });
});

describe('C2 password capacity and serialization', () => {
  it('declares sufficient hash capacity without selecting passwords by default', () => {
    const column = getMetadataArgsStorage().columns.find(
      (entry) => entry.target === User && entry.propertyName === 'password',
    );
    expect(column?.options.length).toBe(255);
    expect(column?.options.select).toBe(false);
  });

  it('excludes a deliberately selected password during Nest-style serialization', async () => {
    const { persisted } = await storageFixture();
    const plain = instanceToPlain(persisted()) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(plain, 'password')).toBe(false);
    expect(plain.userId).toBe(3);
  });
});

describe('C2 legacy bcrypt compatibility', () => {
  it.each(['$2a$', '$2b$'])(
    'keeps an existing supported bcrypt format unchanged during unrelated updates case %#',
    async (prefix) => {
      const { service, persisted } = await storageFixture(true);
      const legacy = persisted().password.replace(/^\$2b\$/, prefix);
      persisted().password = legacy;
      await service.update(3, { name: 'synthetic-legacy-renamed' }, 1);
      expect(persisted().password === legacy).toBe(true);
      expect(await bcrypt.compare(originalPassword, persisted().password)).toBe(
        true,
      );
    },
  );

  it.each(['$2a$', '$2b$'])(
    'preserves login with an existing supported bcrypt format case %#',
    async (prefix) => {
      const { persisted } = await storageFixture();
      const user = persisted();
      user.password = user.password.replace(/^\$2b\$/, prefix);
      const repository = { findOne: jest.fn().mockResolvedValue(user) };
      const jwt = new JwtService({
        secret: randomBytes(32).toString('hex'),
        signOptions: { expiresIn: '5m' },
      });
      const auth = new AuthService(
        repository as unknown as Repository<User>,
        jwt,
        {} as RolesService,
      );
      const result = await auth.login({
        name: user.name,
        password: originalPassword,
      });
      expect(typeof result.accessToken === 'string').toBe(true);
      expect(jwt.verify<Record<string, unknown>>(result.accessToken).sub).toBe(
        3,
      );
      expect(
        Object.prototype.hasOwnProperty.call(result.userAutorised, 'password'),
      ).toBe(false);
    },
  );
});

describe('C2 DTO password input validation', () => {
  it.each([null, 42, {}, ['Synthetic1!Value']])(
    'validates invalid password types without a transformation TypeError case %#',
    async (value) => {
      const dto = plainToInstance(CreateUserDto, createInput(value));
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === 'password')).toBe(true);
    },
  );

  it('keeps the current string-trimming behavior at the DTO boundary', async () => {
    const dto = plainToInstance(
      CreateUserDto,
      createInput(' Synthetic1!Value '),
    );
    expect(dto.password === 'Synthetic1!Value').toBe(true);
    expect((await validate(dto)).length).toBe(0);
  });
});
