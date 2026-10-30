import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';

import { Roles } from '../common/auth.decorators';
import { paging, type ListQuery } from '../common/list';
import { PrismaService } from '../common/prisma.service';

/** Owner-only: dietitians, subscription plans, audit log. */
@ApiTags('owner')
@ApiBearerAuth()
@Roles('OWNER')
@Controller('admin')
export class OwnerController {
  constructor(private readonly db: PrismaService) {}

  @Get('staff')
  async staff() {
    const data = await this.db.user.findMany({
      where: { role: { in: ['DIETITIAN', 'OWNER'] } }, orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, _count: { select: { assigned: true } } },
    });
    return { data: data.map(({ _count, ...s }) => ({ ...s, patients: _count.assigned })), total: data.length };
  }

  @Post('staff')
  async addStaff(@Body() b: { name: string; email: string; password: string; role?: 'DIETITIAN' | 'OWNER' }) {
    if (!b.email || !b.password || b.password.length < 8) throw new BadRequestException('email_and_8_char_password_required');
    return this.db.user.create({
      data: { name: b.name, email: b.email.toLowerCase(), passwordHash: await bcrypt.hash(b.password, 10), role: b.role ?? 'DIETITIAN' },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  @Patch('staff/:id')
  async updateStaff(@Param('id') id: string, @Body() b: { name?: string; active?: boolean; password?: string }) {
    return this.db.user.update({
      where: { id },
      data: { ...(b.name ? { name: b.name } : {}), ...(b.active !== undefined ? { active: b.active } : {}), ...(b.password ? { passwordHash: await bcrypt.hash(b.password, 10) } : {}) },
      select: { id: true, name: true, email: true, role: true, active: true },
    });
  }

  /** Dietitians read the plans too (to record a patient's payment); only the owner edits them. */
  @Roles('DIETITIAN', 'OWNER')
  @Get('subscription-plans')
  async plans() {
    const data = await this.db.subscriptionPlan.findMany({ orderBy: { priceInr: 'asc' }, include: { _count: { select: { subscriptions: { where: { status: 'active' } } } } } });
    return { data: data.map(({ _count, ...p }) => ({ ...p, active: p.active, subscribers: _count.subscriptions })), total: data.length };
  }

  @Put('subscription-plans/:id')
  savePlan(@Param('id') id: string, @Body() b: { name: string; nameHi?: string; priceInr: number; months?: number; features: string[]; featuresHi?: string[]; active?: boolean }) {
    const data = { name: b.name, nameHi: b.nameHi ?? '', priceInr: b.priceInr, months: b.months ?? 1, features: b.features ?? [], featuresHi: b.featuresHi ?? [], active: b.active ?? true };
    return this.db.subscriptionPlan.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  @Get('audit')
  async audit(@Query() q: ListQuery) {
    const [data, total] = await Promise.all([
      this.db.auditLog.findMany({ ...paging(q, ['at'], 'at'), orderBy: { at: 'desc' }, include: { actor: { select: { name: true, role: true } } } }),
      this.db.auditLog.count(),
    ]);
    return { data, total };
  }
}
