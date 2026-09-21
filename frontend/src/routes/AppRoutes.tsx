import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleRoute } from './ProtectedRoute';
export { RoleRoute };
import { AppLayout } from '../components/Layout/AppLayout';
import { PageLoader } from '../components/Common/PageLoader';
import { NAVIGATION_ITEMS } from '../constants';

const lazyLoad = <T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) =>
  React.lazy(() =>
    loader().then((mod) => ({ default: mod[exportName] as React.ComponentType<any> })),
  );

// Public Pages
const LoginPage = lazyLoad(() => import('../pages/Login/LoginPage'), 'LoginPage');
const PublicVerificationPage = lazyLoad(() => import('../pages/PublicVerification/PublicVerificationPage'), 'PublicVerificationPage');
const MobileSigningPage = lazyLoad(() => import('../pages/MobileSigning/MobileSigningPage'), 'MobileSigningPage');

// Protected Pages
const DashboardPage = lazyLoad(() => import('../pages/Dashboard/DashboardPage'), 'DashboardPage');
const InboxPage = lazyLoad(() => import('../pages/Inbox/InboxPage'), 'InboxPage');
const UsersPage = lazyLoad(() => import('../pages/Users/UsersPage'), 'UsersPage');
const UserPermissionsPage = lazyLoad(() => import('../pages/Users/UserPermissionsPage'), 'UserPermissionsPage');
const AssetsPage = lazyLoad(() => import('../pages/Assets/AssetsPage'), 'AssetsPage');
const WarehousePage = lazyLoad(() => import('../pages/Warehouse/WarehousePage'), 'WarehousePage');
const SuppliersPage = lazyLoad(() => import('../pages/Suppliers/SuppliersPage'), 'SuppliersPage');
const MovementsPage = lazyLoad(() => import('../pages/Movements/MovementsPage'), 'MovementsPage');
const RequestsPage = lazyLoad(() => import('../pages/Requests/RequestsPage'), 'RequestsPage');
const RepairsPage = lazyLoad(() => import('../pages/Repairs/RepairsPage'), 'RepairsPage');
const WriteOffPage = lazyLoad(() => import('../pages/WriteOff/WriteOffPage'), 'WriteOffPage');
const DepreciationPage = lazyLoad(() => import('../pages/Depreciation/DepreciationPage'), 'DepreciationPage');
const ChiefAccountantLedgerPage = lazyLoad(() => import('../pages/Reports/ChiefAccountantLedgerPage'), 'ChiefAccountantLedgerPage');
const FundingReportsPage = lazyLoad(() => import('../pages/Reports/FundingReportsPage'), 'FundingReportsPage');
const QuotasPage = lazyLoad(() => import('../pages/Quotas/QuotasPage'), 'QuotasPage');
const SystemAuditPage = lazyLoad(() => import('../pages/SystemAudit/SystemAuditPage'), 'SystemAuditPage');
const IntegrationsPage = lazyLoad(() => import('../pages/Integrations/IntegrationsPage'), 'IntegrationsPage');
const BackupsPage = lazyLoad(() => import('../pages/Backups/BackupsPage'), 'BackupsPage');
const OrganizationPage = lazyLoad(() => import('../pages/Organization/OrganizationPage'), 'OrganizationPage');
const AuditScannerPage = lazyLoad(() => import('../pages/Audit/AuditScannerPage'), 'AuditScannerPage');
const AuditCampaignsPage = lazyLoad(() => import('../pages/Audit/AuditCampaignsPage'), 'AuditCampaignsPage');

import { DesktopOnlyGuard } from '../components/Common/DesktopOnlyGuard';

const PageLoadingFallback: React.FC = () => <PageLoader size={20} />;

const getRoles = (keyOrPath: string) => {
  return NAVIGATION_ITEMS.find((item) => item.key === keyOrPath || item.path === `/${keyOrPath}`)?.allowedRoles;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public routes (no authentication required) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-doc/:docNumber" element={<PublicVerificationPage />} />
        <Route path="/mobile/sign/:token" element={<MobileSigningPage />} />

        {/* Protected Routes inside AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route
            path="/*"
            element={
              <AppLayout>
                <Suspense fallback={<PageLoadingFallback />}>
                  <Routes>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<ProtectedRoute allowedRoles={getRoles('dashboard')}><DashboardPage /></ProtectedRoute>} />
                    <Route path="inbox" element={<ProtectedRoute allowedRoles={getRoles('inbox')}><InboxPage /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute allowedRoles={getRoles('users')}><UsersPage /></ProtectedRoute>} />
                    <Route path="users/:id/permissions" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']}><UserPermissionsPage /></ProtectedRoute>} />
                    <Route path="assets" element={<ProtectedRoute allowedRoles={getRoles('assets')}><AssetsPage /></ProtectedRoute>} />
                    <Route path="warehouse" element={<ProtectedRoute allowedRoles={getRoles('warehouse')}><WarehousePage /></ProtectedRoute>} />
                    <Route path="suppliers" element={<ProtectedRoute allowedRoles={getRoles('suppliers')}><SuppliersPage /></ProtectedRoute>} />
                    <Route path="movements" element={<ProtectedRoute allowedRoles={getRoles('movements')}><MovementsPage /></ProtectedRoute>} />
                    <Route path="requests" element={<ProtectedRoute allowedRoles={getRoles('requests')}><RequestsPage /></ProtectedRoute>} />
                    <Route path="repairs" element={<ProtectedRoute allowedRoles={getRoles('repairs')}><RepairsPage /></ProtectedRoute>} />
                    <Route path="write-offs" element={<ProtectedRoute allowedRoles={getRoles('write-offs')}><WriteOffPage /></ProtectedRoute>} />
                    <Route path="depreciation" element={<ProtectedRoute allowedRoles={getRoles('depreciation')}><DesktopOnlyGuard pageTitle="Amortizatsiya Hisobi"><DepreciationPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="reports/chief-accountant" element={<ProtectedRoute allowedRoles={getRoles('chiefAccountantLedger')}><DesktopOnlyGuard pageTitle="Bosh Hisobchi Daftari"><ChiefAccountantLedgerPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="reports/funding" element={<ProtectedRoute allowedRoles={getRoles('fundingReports')}><DesktopOnlyGuard pageTitle="Moliyaviy Manbalar Hisoboti"><FundingReportsPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="quotas" element={<ProtectedRoute allowedRoles={getRoles('quotas')}><DesktopOnlyGuard pageTitle="Kafedralar Kvotasi"><QuotasPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="system-audit" element={<ProtectedRoute allowedRoles={getRoles('systemAudit')}><DesktopOnlyGuard pageTitle="Tizim Auditi va Jurnallari"><SystemAuditPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="integrations" element={<ProtectedRoute allowedRoles={getRoles('integrations')}><DesktopOnlyGuard pageTitle="Tashqi Tizimlar Integratsiyasi"><IntegrationsPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="backups" element={<ProtectedRoute allowedRoles={getRoles('backups')}><DesktopOnlyGuard pageTitle="Zaxira Nusxalari (Backups)"><BackupsPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="organization" element={<ProtectedRoute allowedRoles={getRoles('organization')}><DesktopOnlyGuard pageTitle="Tashkiliy Tuzilma va Xonalar"><OrganizationPage /></DesktopOnlyGuard></ProtectedRoute>} />
                    <Route path="audit" element={<ProtectedRoute allowedRoles={getRoles('audit')}><AuditScannerPage /></ProtectedRoute>} />
                    <Route path="audit-campaigns" element={<ProtectedRoute allowedRoles={getRoles('auditCampaigns')}><AuditCampaignsPage /></ProtectedRoute>} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
};
