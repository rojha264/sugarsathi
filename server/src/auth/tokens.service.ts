import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../common/prisma.service';

const REFRESH_DAYS = 60;
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Short-lived access JWT plus a long-lived refresh token (stored hashed, rotated on use). */
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
  ) {}

  async issue(user: { id: string; role: Role }) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.db.refreshToken.create({
      data: { userId: user.id, tokenHash: sha(refreshToken), expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400_000) },
    });
    return { accessToken: this.jwt.sign({ sub: user.id, role: user.role }), refreshToken };
  }

  async rotate(refreshToken: string) {
    const row = await this.db.refreshToken.findUnique({ where: { tokenHash: sha(refreshToken) }, include: { user: true } });
    if (!row || row.expiresAt < new Date() || !row.user.active) throw new UnauthorizedException('refresh_invalid');
    await this.db.refreshToken.delete({ where: { id: row.id } });
    return this.issue(row.user);
  }

  async revoke(refreshToken: string) {
    await this.db.refreshToken.deleteMany({ where: { tokenHash: sha(refreshToken) } });
  }
}
