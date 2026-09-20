import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { AssetsModule } from './assets/assets.module';
import { TransfersModule } from './transfers/transfers.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { RequestsModule } from './requests/requests.module';
import { AuditsModule } from './audits/audits.module';
import { CommonModule } from './common/common.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { RepairsModule } from './repairs/repairs.module';
import { WriteOffsModule } from './write-offs/write-offs.module';
import { SystemAuditModule } from './system-audit/system-audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuotasModule } from './quotas/quotas.module';
import { DocumentStampsModule } from './document-stamps/document-stamps.module';
import { SigningSessionsModule } from './signing-sessions/signing-sessions.module';
import { DocumentArchivesModule } from './document-archives/document-archives.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { BackupsModule } from './backups/backups.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadsModule } from './uploads/uploads.module';
import { DepreciationModule } from './depreciation/depreciation.module';
import { ReportsModule } from './reports/reports.module';
import { InboxModule } from './inbox/inbox.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestContextMiddleware } from './common/context/request-context.middleware';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    CommonModule,
    SystemAuditModule,
    NotificationsModule,
    QuotasModule,
    DocumentStampsModule,
    SigningSessionsModule,
    DocumentArchivesModule,
    IntegrationsModule,
    BackupsModule,
    UsersModule,
    AuthModule,
    OrganizationModule,
    AssetsModule,
    TransfersModule,
    WarehouseModule,
    RequestsModule,
    AuditsModule,
    SuppliersModule,
    RepairsModule,
    WriteOffsModule,
    DashboardModule,
    UploadsModule,
    DepreciationModule,
    ReportsModule,
    InboxModule,
    SearchModule,
    HealthModule,
    IdempotencyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware, RequestIdMiddleware).forRoutes('*');
  }
}
