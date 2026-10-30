import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

import { leastLoadedDietitian } from '../analytics/analytics.controller';
import { CurrentUser, type AuthUser } from '../common/auth.decorators';
import { PrismaService } from '../common/prisma.service';
import { ProgramService } from '../program/program.service';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Onboarding / settings answers from the app. Every field is optional. */
export class UpdateMeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(['en', 'hi']) lang?: string;
  @IsOptional() @IsIn(['type2', 'type1', 'gdm', 'pre', 'care']) type?: string;
  @IsOptional() @IsIn(['child', 'adult', 'senior']) ageGroup?: string;
  @IsOptional() @IsIn(['veg', 'egg', 'nonveg']) diet?: string;
  @IsOptional() @IsIn(['male', 'female', 'other']) sex?: string;
  @IsOptional() @IsInt() @Min(50) @Max(250) heightCm?: number;
  @IsOptional() @IsNumber() @Min(10) @Max(300) weightKg?: number;
  @IsOptional() @IsString() sugarEvery?: string;
  @IsOptional() @Matches(HHMM) remindWalk?: string;
  @IsOptional() @Matches(HHMM) remindMed?: string;
  @IsOptional() @Matches(HHMM) remindSugar?: string;
  @IsOptional() @Matches(HHMM) remindAfter?: string;
  @IsOptional() @IsInt() consentVer?: number;
  @IsOptional() @IsIn(['north', 'south', 'east', 'west', 'northeast']) region?: string;
  @IsOptional() @IsIn(['none', 'tablets', 'insulin']) meds?: string;
  @IsOptional() @IsArray() @IsIn(['pregnant', 'kidney'], { each: true }) flags?: string[];
  @IsOptional() @IsInt() @Min(1920) @Max(2025) birthYear?: number;
  @IsOptional() @IsString() tz?: string;
}

class DeviceDto {
  @IsString() token: string;
  @IsIn(['ios', 'android', 'web']) platform: string;
}

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly db: PrismaService,
    private readonly program: ProgramService,
  ) {}

  @Get()
  async me(@CurrentUser() u: AuthUser) {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: u.id },
      select: {
        id: true, phone: true, email: true, name: true, role: true, lang: true,
        patient: { include: { assignedDietitian: { select: { id: true, name: true } } } },
      },
    });
    return user;
  }

  @Patch()
  async update(@CurrentUser() u: AuthUser, @Body() dto: UpdateMeDto) {
    const { name, lang, consentVer, birthYear, ...rest } = dto;
    const patient = { ...rest, ...(birthYear ? { dob: new Date(Date.UTC(birthYear, 6, 1)) } : {}) };
    await this.db.user.update({
      where: { id: u.id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(lang ? { lang } : {}),
        patient: {
          upsert: {
            create: { ...patient, ...(consentVer ? { consentVer, consentAt: new Date() } : {}) },
            update: { ...patient, ...(consentVer ? { consentVer, consentAt: new Date() } : {}) },
          },
        },
      },
    });
    // Finishing onboarding: a dietitian to watch over them, and the 14-day Kickstart plan.
    if (consentVer) {
      const p = await this.db.patient.findUnique({ where: { userId: u.id }, select: { type: true, assignedDietitianId: true } });
      const pick = p && p.type !== 'care' && !p.assignedDietitianId ? await leastLoadedDietitian(this.db) : null;
      if (pick) await this.db.patient.update({ where: { userId: u.id }, data: { assignedDietitianId: pick } });
      if (p && p.type !== 'care') await this.program.enroll(u.id);
    }
    // The app sends the whole profile on every change (consent included), so check after every save:
    // a new risk during the 14-day plan alerts the dietitian (no-op when nothing new).
    if (dto.meds !== undefined || dto.flags !== undefined || dto.type !== undefined || dto.birthYear !== undefined || dto.diet !== undefined) await this.program.profileChanged(u.id);
    return this.me(u);
  }

  /** Expo push token for this phone (one user per device). */
  @Post('devices')
  @HttpCode(200)
  async device(@CurrentUser() u: AuthUser, @Body() dto: DeviceDto) {
    await this.db.device.upsert({ where: { token: dto.token }, create: { ...dto, userId: u.id }, update: { userId: u.id, platform: dto.platform } });
    return { ok: true };
  }

  /** Everything stored about the user (data portability, DPDP Act). */
  @Get('export')
  export(@CurrentUser() u: AuthUser) {
    return this.db.user.findUniqueOrThrow({
      where: { id: u.id },
      select: {
        phone: true, name: true, lang: true, createdAt: true,
        patient: { include: { meals: true, readings: true, medications: true, doses: true, activity: true, events: true, checkups: true, dietPlans: { include: { items: true } } } },
      },
    });
  }

  /** Deletes the account and every log (right to erasure). */
  @Delete()
  async remove(@CurrentUser() u: AuthUser) {
    await this.db.user.delete({ where: { id: u.id } });
    return { deleted: true };
  }
}
