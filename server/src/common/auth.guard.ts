import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';

import { IS_PUBLIC, ROLES, type AuthUser } from './auth.decorators';
import { PrismaService } from './prisma.service';

/** Global guard: every route needs a valid access token unless marked @Public; @Roles narrows it further. */
@Injectable()
export class AuthGuard implements CanActivate {
  /** Last time each user's activity was written, so presence costs at most one write a minute. */
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly db: PrismaService,
  ) {}

  private touch(userId: string) {
    const now = Date.now();
    if (now - (this.seen.get(userId) ?? 0) < 60_000) return;
    this.seen.set(userId, now);
    this.db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } }).catch(() => {});
  }

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('login_required');
    try {
      const payload = this.jwt.verify<{ sub: string; role: Role }>(header.slice(7));
      req.user = { id: payload.sub, role: payload.role } satisfies AuthUser;
      this.touch(payload.sub);
    } catch {
      throw new UnauthorizedException('token_expired');
    }
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, targets);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('not_allowed');
    return true;
  }
}
