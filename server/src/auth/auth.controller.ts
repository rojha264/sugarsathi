import { BadRequestException, Body, Controller, HttpCode, HttpException, HttpStatus, Ip, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

import { Public } from '../common/auth.decorators';
import { normalizePhone } from '../common/phone';
import { PrismaService } from '../common/prisma.service';
import { OtpService } from './otp.service';
import { TokensService } from './tokens.service';

class OtpRequestDto {
  @IsString() phone: string;
}
class OtpVerifyDto {
  @IsString() phone: string;
  @IsString() @Length(6, 6) code: string;
}
class RefreshDto {
  @IsString() refreshToken: string;
}
class StaffLoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

const publicUser = (u: { id: string; phone: string | null; email: string | null; name: string; role: string; lang: string }) => ({
  id: u.id, phone: u.phone, email: u.email, name: u.name, role: u.role, lang: u.lang,
});

/**
 * Codes one IP address may request per 10 minutes, across all numbers (stops SMS-pumping fraud).
 * Generous because mobile networks put many users behind one IP; each number has its own hourly limit too.
 */
const otpPerIp = () => Number(process.env.OTP_IP_LIMIT) || 30;
const IP_WINDOW_MS = 10 * 60_000;
const otpByIp = new Map<string, number[]>();
function allowIp(ip: string, now = Date.now()) {
  const recent = (otpByIp.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (recent.length >= otpPerIp()) return false;
  recent.push(now);
  otpByIp.set(ip, recent);
  if (otpByIp.size > 50_000) otpByIp.clear();
  return true;
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly tokens: TokensService,
    private readonly db: PrismaService,
  ) {}

  /** Sends a 6-digit code to the phone. */
  @Post('otp/request')
  @HttpCode(200)
  async request(@Body() dto: OtpRequestDto, @Ip() ip: string) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('bad_phone');
    if (!allowIp(ip)) throw new HttpException('too_many_requests', HttpStatus.TOO_MANY_REQUESTS);
    const fixed = await this.otp.send(phone);
    // Test mode only (no SMS sent): tell the app the code so testers are not stuck waiting for an SMS.
    return { phone, sent: true, ...(fixed ? { testCode: fixed } : {}) };
  }

  /** Checks the code; creates the account on first login. */
  @Post('otp/verify')
  @HttpCode(200)
  async verify(@Body() dto: OtpVerifyDto) {
    const phone = normalizePhone(dto.phone);
    if (!phone) throw new BadRequestException('bad_phone');
    if (!(await this.otp.verify(phone, dto.code))) throw new UnauthorizedException('wrong_code');
    let user = await this.db.user.findUnique({ where: { phone } });
    const isNew = !user;
    if (!user) user = await this.db.user.create({ data: { phone, role: 'USER', patient: { create: {} } } });
    if (!user.active) throw new UnauthorizedException('account_disabled');
    return { ...(await this.tokens.issue(user)), user: publicUser(user), isNew };
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.tokens.rotate(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.revoke(dto.refreshToken);
    return { ok: true };
  }

  /** Dietitians and the owner sign in to the admin panel with email and password. */
  @Post('staff/login')
  @HttpCode(200)
  async staffLogin(@Body() dto: StaffLoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user?.passwordHash || user.role === 'USER' || !user.active || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('wrong_login');
    }
    return { ...(await this.tokens.issue(user)), user: publicUser(user) };
  }
}
