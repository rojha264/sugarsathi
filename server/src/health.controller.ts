import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from './common/auth.decorators';
import { PrismaService } from './common/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @Public()
  @Get()
  async ok() {
    await this.db.$queryRaw`select 1`;
    return { ok: true, time: new Date().toISOString() };
  }
}
