import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';

import { OwnerController } from './admin/owner.controller';
import { AnalyticsController } from './analytics/analytics.controller';
import { PatientsController } from './admin/patients.controller';
import { PicksController } from './admin/picks.controller';
import { SubscriptionsController, SubscriptionService } from './admin/subscriptions.controller';
import { AdminProgramController, ProgramController } from './program/program.controller';
import { ProgramService } from './program/program.service';
import { AuthModule } from './auth/auth.module';
import { AdminChatController, ChatController } from './chat/chat.controller';
import { CatalogController } from './catalog/catalog.controller';
import { ReelsController } from './catalog/reels.controller';
import { AuditInterceptor } from './common/audit.interceptor';
import { FamilyController } from './family/family.controller';
import { AlertsService } from './notify/alerts.service';
import { LifecycleService } from './notify/lifecycle.service';
import { InboxController, NotificationsController, NotificationsService } from './notify/notifications.controller';
import { PushService } from './notify/push.service';
import { MyPlanController, PlansController } from './plans/plans.controller';
import { SyncController } from './sync/sync.controller';
import { AccessService } from './common/access.service';
import { AuthGuard } from './common/auth.guard';
import { PrismaModule } from './common/prisma.service';
import { HealthController } from './health.controller';
import { MeController } from './me/me.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.getOrThrow<string>('JWT_SECRET'), signOptions: { expiresIn: '1h' } }),
    }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [
    HealthController, MeController, SyncController, CatalogController, PatientsController, PlansController, MyPlanController,
    ReelsController, NotificationsController, InboxController, FamilyController, OwnerController, ChatController, AdminChatController, AnalyticsController, PicksController, ProgramController, AdminProgramController, SubscriptionsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    AccessService, PushService, AlertsService, NotificationsService, LifecycleService, ProgramService, SubscriptionService,
  ],
  exports: [AccessService],
})
export class AppModule {}
