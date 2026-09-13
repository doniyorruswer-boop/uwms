import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationModule } from './organization/organization.module';
import { AssetsModule } from './assets/assets.module';
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
import { IntegrationsModule } from './integrations/integrations.module';
import { BackupsModule } from './backups/backups.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    IntegrationsModule,
    BackupsModule,
    UsersModule,
    AuthModule,
    OrganizationModule,
    AssetsModule,
    WarehouseModule,
    RequestsModule,
    AuditsModule,
    SuppliersModule,
    RepairsModule,
    WriteOffsModule,
    DashboardModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
