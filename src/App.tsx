import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { OrganizationProvider } from './contexts/OrganizationContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
import Layout from './components/Layout';
import { PageSkeleton } from './components/LoadingSkeleton';

// Lazy-loaded pages — each is code-split into its own chunk
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Vendors = lazy(() => import('./pages/Vendors'));
const VendorForm = lazy(() => import('./pages/VendorForm'));
const VendorDetail = lazy(() => import('./pages/VendorDetail'));
const VendorInventory = lazy(() => import('./pages/VendorInventory'));
const FourthParties = lazy(() => import('./pages/FourthParties'));
const ExitStrategy = lazy(() => import('./pages/ExitStrategy'));
const SLATracking = lazy(() => import('./pages/SLATracking'));
const VendorComparison = lazy(() => import('./pages/VendorComparison'));
const AssessmentWizard = lazy(() => import('./pages/AssessmentWizard'));
const Assessments = lazy(() => import('./pages/Assessments'));
const PendingReassessments = lazy(() => import('./pages/PendingReassessments'));
const RiskMatrix = lazy(() => import('./pages/RiskMatrix'));
const DueDiligence = lazy(() => import('./pages/DueDiligence'));
const DueDiligenceDetail = lazy(() => import('./pages/DueDiligenceDetail'));
const Contracts = lazy(() => import('./pages/Contracts'));
const ContractDetail = lazy(() => import('./pages/ContractDetail'));
const ContractReviews = lazy(() => import('./pages/ContractReviews'));
const Incidents = lazy(() => import('./pages/Incidents'));
const Performance = lazy(() => import('./pages/Performance'));
const KRIDashboard = lazy(() => import('./pages/KRIDashboard'));
const ConcentrationDashboard = lazy(() => import('./pages/ConcentrationDashboard'));
const Attestations = lazy(() => import('./pages/Attestations'));
const OSFICompliance = lazy(() => import('./pages/OSFICompliance'));
const BoardReports = lazy(() => import('./pages/BoardReports'));
const RegulatoryReports = lazy(() => import('./pages/RegulatoryReports'));
const InventoryReports = lazy(() => import('./pages/InventoryReports'));
const Settings = lazy(() => import('./pages/Settings'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Notifications = lazy(() => import('./pages/Notifications'));
const RiskExceptions = lazy(() => import('./pages/RiskExceptions'));
const AssessmentAnalytics = lazy(() => import('./pages/AssessmentAnalytics'));
const ComplianceDashboard = lazy(() => import('./pages/ComplianceDashboard'));
const OnboardingDashboard = lazy(() => import('./pages/OnboardingDashboard'));
const OnboardingRequestForm = lazy(() => import('./pages/OnboardingRequestForm'));
const OnboardingRequestDetail = lazy(() => import('./pages/OnboardingRequestDetail'));
const OrganizationSetup = lazy(() => import('./pages/OrganizationSetup'));
const WorkflowConfiguration = lazy(() => import('./pages/WorkflowConfiguration'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const PlatformAdminDashboard = lazy(() => import('./pages/PlatformAdminDashboard'));
const TenantManagement = lazy(() => import('./pages/TenantManagement'));
const GlobalThirdParties = lazy(() => import('./pages/GlobalThirdParties'));
const FIOnboarding = lazy(() => import('./pages/FIOnboarding'));
const AcceptInvitation = lazy(() => import('./pages/AcceptInvitation'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const RegulatoryUpdates = lazy(() => import('./pages/RegulatoryUpdates'));

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrganizationProvider>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/fi-onboarding" element={<FIOnboarding />} />
              <Route
                path="/accept-invitation/:token"
                element={<AcceptInvitation />}
              />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Suspense fallback={<PageSkeleton />}>
                        <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route
                        path="/access-denied"
                        element={<AccessDenied />}
                      />

                      {/* Onboarding Workflow */}
                      <Route
                        path="/onboarding"
                        element={<OnboardingDashboard />}
                      />
                      <Route
                        path="/onboarding/new"
                        element={<OnboardingRequestForm />}
                      />
                      <Route
                        path="/onboarding/:id"
                        element={<OnboardingRequestDetail />}
                      />
                      <Route
                        path="/onboarding/:id/edit"
                        element={<OnboardingRequestForm />}
                      />

                      {/* Vendor Management */}
                      <Route path="/vendors" element={<Vendors />} />
                      <Route
                        path="/vendors/new"
                        element={<Navigate to="/onboarding/new" replace />}
                      />
                      <Route
                        path="/vendors/compare"
                        element={<VendorComparison />}
                      />
                      <Route
                        path="/vendors/inventory"
                        element={<VendorInventory />}
                      />
                      <Route
                        path="/vendors/:id/edit"
                        element={<VendorForm />}
                      />
                      <Route
                        path="/vendors/:vendorId/assess"
                        element={<AssessmentWizard />}
                      />
                      <Route
                        path="/vendors/:vendorId/fourth-parties"
                        element={<FourthParties />}
                      />
                      <Route
                        path="/vendors/:vendorId/exit-strategy"
                        element={<ExitStrategy />}
                      />
                      <Route
                        path="/vendors/:vendorId/sla"
                        element={<SLATracking />}
                      />
                      <Route path="/vendors/:id" element={<VendorDetail />} />

                      {/* Risk Assessment */}
                      <Route
                        path="/assessments"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <Assessments />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/assessments/reassessments"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <PendingReassessments />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/risk-matrix"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <RiskMatrix />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/risk-exceptions"
                        element={
                          <RoleGuard allowedLines={['2nd', '3rd']}>
                            <RiskExceptions />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/due-diligence"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd']}>
                            <DueDiligence />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/due-diligence/:id"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd']}>
                            <DueDiligenceDetail />
                          </RoleGuard>
                        }
                      />

                      {/* Contracts */}
                      <Route
                        path="/contracts"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd']}>
                            <Contracts />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/contracts/reviews"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd']}>
                            <ContractReviews />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/contracts/:id"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd']}>
                            <ContractDetail />
                          </RoleGuard>
                        }
                      />

                      {/* Monitoring */}
                      <Route
                        path="/performance"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <Performance />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/incidents"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <Incidents />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/kri"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <KRIDashboard />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/concentration"
                        element={
                          <RoleGuard allowedLines={['1b', '2nd', '3rd', 'senior_management']}>
                            <ConcentrationDashboard />
                          </RoleGuard>
                        }
                      />

                      {/* Compliance */}
                      <Route
                        path="/compliance"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <ComplianceDashboard />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/compliance/osfi-b10"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <OSFICompliance />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/attestations"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '1b',
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <Attestations />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/regulatory-updates"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <RegulatoryUpdates />
                          </RoleGuard>
                        }
                      />

                      {/* Reporting */}
                      <Route
                        path="/reports/board"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <BoardReports />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/reports/regulatory"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <RegulatoryReports />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/reports/inventory"
                        element={<InventoryReports />}
                      />
                      <Route
                        path="/reports/assessment-analytics"
                        element={
                          <RoleGuard
                            allowedLines={[
                              '1b',
                              '2nd',
                              '3rd',
                              'senior_management',
                            ]}
                          >
                            <AssessmentAnalytics />
                          </RoleGuard>
                        }
                      />

                      {/* Organization Administration */}
                      <Route
                        path="/org/setup"
                        element={
                          <RoleGuard requireAdmin>
                            <OrganizationSetup />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/org/users"
                        element={
                          <RoleGuard requirePermission="canManageUsers">
                            <UserManagement />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/org/workflows"
                        element={
                          <RoleGuard requirePermission="canConfigureWorkflows">
                            <WorkflowConfiguration />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/settings"
                        element={
                          <RoleGuard requireAdmin>
                            <Settings />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/audit-log"
                        element={
                          <RoleGuard requireAdmin>
                            <AuditLog />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/notifications"
                        element={<Notifications />}
                      />
                      <Route path="/help" element={<HelpCenter />} />

                      {/* Platform Admin */}
                      <Route
                        path="/platform"
                        element={
                          <RoleGuard requirePlatformAdmin>
                            <PlatformAdminDashboard />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/platform/tenants"
                        element={
                          <RoleGuard requirePlatformAdmin>
                            <TenantManagement />
                          </RoleGuard>
                        }
                      />
                      <Route
                        path="/platform/global-vendors"
                        element={
                          <RoleGuard requirePlatformAdmin>
                            <GlobalThirdParties />
                          </RoleGuard>
                        }
                      />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        </OrganizationProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors closeButton />
    </BrowserRouter>
  );
}

export default App;
