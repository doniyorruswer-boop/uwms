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
import { DepreciationPage } from '../pages/Depreciation/DepreciationPage';

import { NAVIGATION_ITEMS } from '../constants';

const getRoles = (keyOrPath: string) => {
  return NAVIGATION_ITEMS.find((item) => item.key === keyOrPath || item.path === `/${keyOrPath}`)?.allowedRoles;
};

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
                <Route path="dashboard" element={<ProtectedRoute allowedRoles={getRoles('dashboard')}><DashboardPage /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute allowedRoles={getRoles('users')}><UsersPage /></ProtectedRoute>} />
                <Route path="assets" element={<ProtectedRoute allowedRoles={getRoles('assets')}><AssetsPage /></ProtectedRoute>} />
                <Route path="warehouse" element={<ProtectedRoute allowedRoles={getRoles('warehouse')}><WarehousePage /></ProtectedRoute>} />
                <Route path="suppliers" element={<ProtectedRoute allowedRoles={getRoles('suppliers')}><SuppliersPage /></ProtectedRoute>} />
                <Route path="movements" element={<ProtectedRoute allowedRoles={getRoles('movements')}><MovementsPage /></ProtectedRoute>} />
                <Route path="requests" element={<ProtectedRoute allowedRoles={getRoles('requests')}><RequestsPage /></ProtectedRoute>} />
                <Route path="repairs" element={<ProtectedRoute allowedRoles={getRoles('repairs')}><RepairsPage /></ProtectedRoute>} />
                <Route path="write-offs" element={<ProtectedRoute allowedRoles={getRoles('write-offs')}><WriteOffPage /></ProtectedRoute>} />
                <Route path="depreciation" element={<ProtectedRoute allowedRoles={getRoles('depreciation')}><DepreciationPage /></ProtectedRoute>} />
                <Route path="quotas" element={<ProtectedRoute allowedRoles={getRoles('quotas')}><QuotasPage /></ProtectedRoute>} />
                <Route path="system-audit" element={<ProtectedRoute allowedRoles={getRoles('systemAudit')}><SystemAuditPage /></ProtectedRoute>} />
                <Route path="integrations" element={<ProtectedRoute allowedRoles={getRoles('integrations')}><IntegrationsPage /></ProtectedRoute>} />
                <Route path="backups" element={<ProtectedRoute allowedRoles={getRoles('backups')}><BackupsPage /></ProtectedRoute>} />
                <Route path="organization" element={<ProtectedRoute allowedRoles={getRoles('organization')}><OrganizationPage /></ProtectedRoute>} />
                <Route path="audit" element={<ProtectedRoute allowedRoles={getRoles('audit')}><AuditScannerPage /></ProtectedRoute>} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </AppLayout>
          }
        />
      </Route>
    </Routes>
  );
};
