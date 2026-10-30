import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

import { PrismaService } from '../common/prisma.service';

const OTP_TTL_MIN = 10;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;
const TEST_CODE = '123456';

/**
 * Phone OTP.
 * OTP_MODE=dev (local testing, no SMS): every number uses one fixed code, DEV_OTP_CODE (default 123456).
 *   Refused when NODE_ENV=production, so a fixed code can never reach real users.
 * OTP_MODE=msg91: the code is sent by SMS through MSG91 (DLT-registered template); numbers in
 *   DEV_TEST_PHONES (exact, or prefix*) still use 123456 without an SMS, e.g. for app-store reviewers.
 */
@Injectable()
export class OtpService {
  private readonly log = new Logger('OTP');
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Test numbers (exact, or a prefix ending in *) always use 123456 and never get an SMS. */
  private isTestPhone(phone: string) {
    return (this.config.get<string>('DEV_TEST_PHONES') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .some((t) => (t.endsWith('*') ? phone.startsWith(t.slice(0, -1)) : phone === t));
  }

  /** Dev mode: no SMS, one fixed code for every number. */
  get devMode() {
    const dev = (this.config.get<string>('OTP_MODE') ?? 'dev') === 'dev';
    if (dev && process.env.NODE_ENV === 'production') throw new HttpException('otp_dev_mode_in_production', HttpStatus.SERVICE_UNAVAILABLE);
    return dev;
  }

  /** The code for this number when no SMS is sent (dev mode or a test number), else null. */
  private fixedCode(phone: string) {
    if (this.devMode) return this.config.get<string>('DEV_OTP_CODE') || TEST_CODE;
    return this.isTestPhone(phone) ? TEST_CODE : null;
  }

  /** Sends the code. Returns it only when no SMS is involved (dev / test numbers), so the app can show a test hint. */
  async send(phone: string): Promise<string | null> {
    const since = new Date(Date.now() - 3600_000);
    const recent = await this.db.otpRequest.count({ where: { phone, createdAt: { gte: since } } });
    if (recent >= MAX_PER_HOUR) throw new HttpException('too_many_requests', HttpStatus.TOO_MANY_REQUESTS);

    const fixed = this.fixedCode(phone);
    const code = fixed ?? String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db.otpRequest.create({
      data: { phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + OTP_TTL_MIN * 60_000) },
    });
    if (fixed) {
      this.log.log(`OTP for ${phone}: ${code} (no SMS: ${this.devMode ? 'dev mode' : 'test number'})`);
      return fixed;
    }
    await this.sendMsg91(phone, code);
    return null;
  }

  /** True when the code matches the latest live request; each request allows a few attempts. */
  async verify(phone: string, code: string): Promise<boolean> {
    const req = await this.db.otpRequest.findFirst({
      where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!req || req.attempts >= MAX_ATTEMPTS) return false;
    const ok = await bcrypt.compare(code, req.codeHash);
    await this.db.otpRequest.update({ where: { id: req.id }, data: ok ? { usedAt: new Date() } : { attempts: { increment: 1 } } });
    return ok;
  }

  private async sendMsg91(phone: string, code: string) {
    const key = this.config.get<string>('MSG91_AUTH_KEY');
    const template = this.config.get<string>('MSG91_TEMPLATE_ID');
    if (!key || !template) throw new HttpException('sms_not_configured', HttpStatus.SERVICE_UNAVAILABLE);
    const url = `https://control.msg91.com/api/v5/otp?template_id=${template}&mobile=${phone.replace('+', '')}&otp=${code}`;
    const res = await fetch(url, { method: 'POST', headers: { authkey: key, 'Content-Type': 'application/json' } });
    if (!res.ok) throw new HttpException('sms_failed', HttpStatus.BAD_GATEWAY);
  }
}
