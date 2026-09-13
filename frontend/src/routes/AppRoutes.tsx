import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/Login/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '../components/Layout/AppLayout';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { AssetsPage } from '../pages/Assets/AssetsPage';
import { WarehousePage } from '../pages/Warehouse/WarehousePage';
import { MovementsPage } from '../pages/Movements/MovementsPage';
import { RequestsPage } from '../pages/Requests/RequestsPage';
import { OrganizationPage } from '../pages/Organization/OrganizationPage';
import { AuditScannerPage } from '../pages/Audit/AuditScannerPage';
import { RepairsPage } from '../pages/Repairs/RepairsPage';
import { WriteOffPage } from '../pages/WriteOff/WriteOffPage';
import { QuotasPage } from '../pages/Quotas/QuotasPage';
import { SystemAuditPage } from '../pages/SystemAudit/SystemAuditPage';
import { IntegrationsPage } from '../pages/Integrations/IntegrationsPage';
import { PublicVerificationPage } from '../pages/PublicVerification/PublicVerificationPage';
import { BackupsPage } from '../pages/Backups/BackupsPage';
import { UsersPage } from '../pages/Users/UsersPage';
import { SuppliersPage } from '../pages/Suppliers/SuppliersPage';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public routes (no authentication required) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-doc/:docNumber" element={<PublicVerificationPage />} />

      {/* Protected Routes inside AppLayout */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/*"
          element={
            <AppLayout>
              <Routes>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="assets" element={<AssetsPage />} />
                <Route path="warehouse" element={<WarehousePage />} />
                <Route path="suppliers" element={<SuppliersPage />} />
                <Route path="movements" element={<MovementsPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="repairs" element={<RepairsPage />} />
                <Route path="write-offs" element={<WriteOffPage />} />
                <Route path="quotas" element={<QuotasPage />} />
                <Route path="system-audit" element={<SystemAuditPage />} />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route path="backups" element={<BackupsPage />} />
                <Route path="organization" element={<OrganizationPage />} />
                <Route path="audit" element={<AuditScannerPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppLayout>
          }
        />
      </Route>
    </Routes>
  );
};
