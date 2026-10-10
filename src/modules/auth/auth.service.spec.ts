import { UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const findUnique = jest.fn();
  const service = new AuthService({
    user: { findUnique },
  } as unknown as PrismaService);
  const hash = bcrypt.hashSync('correct-password', 4);

  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns safe user data after verifying the stored password hash', async () => {
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
      passwordHash: hash,
      isActive: true,
    });
    await expect(
      service.validateUser('driver@example.com', 'correct-password'),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
    });
  });

  it('rejects unknown users, wrong passwords, and inactive users identically', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      service.validateUser('missing@example.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
      passwordHash: hash,
      isActive: true,
    });
    await expect(
      service.validateUser('driver@example.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'driver@example.com',
      name: 'Driver',
      passwordHash: hash,
      isActive: false,
    });
    await expect(
      service.validateUser('driver@example.com', 'correct-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
