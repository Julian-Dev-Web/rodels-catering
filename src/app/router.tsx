import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import {
  MaintenanceBoundary,
  PortalLayout,
  PublicLayout,
} from '../layouts/Layouts'
import { RoleGuard, useAuth } from '../features/auth'
import { roleHome } from '../lib/permissions'
import { About, Gallery, Home, Packages, Policies } from '../pages/Public'
import { AuthPage } from '../pages/Auth'
import { Empty, Loading } from '../components/ui'
const FoodPhotoCredits = lazy(() => import('../pages/FoodPhotoCredits').then(module => ({ default: module.FoodPhotoCredits })))
const AvailableDates = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.AvailableDates })),
)
const CustomerWorkflow = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.CustomerWorkflow })),
)
const Feedback = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.Feedback })),
)
const Payments = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.Payments })),
)
const ReservationDetail = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.ReservationDetail })),
)
const Reservations = lazy(() =>
  import('../pages/Customer').then((m) => ({ default: m.Reservations })),
)
const ReservationWizard = lazy(() =>
  import('../pages/ReservationWizard').then((m) => ({
    default: m.ReservationWizard,
  })),
)
const Support = lazy(() =>
  import('../pages/Support').then((m) => ({ default: m.Support })),
)
const Settings = lazy(() =>
  import('../pages/Settings').then((m) => ({ default: m.Settings })),
)
const AuditLogs = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.AuditLogs })),
)
const CatalogManager = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.CatalogManager })),
)
const Dashboard = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.Dashboard })),
)
const GalleryManagement = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.GalleryManagement })),
)
const Maintenance = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.Maintenance })),
)
const ManagePayments = lazy(() =>
  import('../pages/Reports').then((m) => ({ default: m.Reports })),
)
const OperatingHours = lazy(() =>
  import('../pages/OperatingHours').then((m) => ({
    default: m.OperatingHours,
  })),
)
const ManageReservations = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.ManageReservations })),
)
const ReviewRequests = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.ReviewRequests })),
)
const UserManagement = lazy(() =>
  import('../pages/Admin').then((m) => ({ default: m.UserManagement })),
)
const SystemOverview = lazy(() =>
  import('../pages/SystemAdmin').then((m) => ({ default: m.SystemOverview })),
)
const Backups = lazy(() =>
  import('../pages/SystemAdmin').then((m) => ({ default: m.Backups })),
)
const ManagerCalendar = lazy(() =>
  import('../pages/ManagerOperations').then((m) => ({
    default: m.ManagerCalendar,
  })),
)
const ManagerCatalog = lazy(() =>
  import('../pages/ManagerOperations').then((m) => ({
    default: m.ManagerCatalog,
  })),
)
const RolePermissions = lazy(() =>
  import('../pages/AdministrationControls').then((m) => ({
    default: m.RolePermissions,
  })),
)
const SecurityMonitoring = lazy(() =>
  import('../pages/AdministrationControls').then((m) => ({
    default: m.SecurityMonitoring,
  })),
)
const SystemReports = lazy(() =>
  import('../pages/SystemAdmin').then((m) => ({ default: m.SystemReports })),
)
const SystemSettings = lazy(() =>
  import('../pages/SystemSettings').then((m) => ({
    default: m.SystemSettings,
  })),
)
const Terms = lazy(() =>
  import('../pages/Legal').then((m) => ({ default: m.Terms })),
)
const Privacy = lazy(() =>
  import('../pages/Legal').then((m) => ({ default: m.Privacy })),
)
function Scroll() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
function RecoveryRedirect() {
  const { recovery, session } = useAuth()
  const { pathname } = useLocation()
  return recovery && session && pathname !== '/reset-password' ? (
    <Navigate to="/reset-password" replace />
  ) : null
}
function Start() {
  const { profile, loading } = useAuth()
  return loading ? (
    <Loading />
  ) : (
    <Navigate to={profile ? roleHome[profile.role] : '/login'} replace />
  )
}
function Missing() {
  return (
    <Empty title="This page isn’t at the table.">
      <a href="/">Return home</a> to find your way.
    </Empty>
  )
}
export function Router() {
  return (
    <BrowserRouter>
      <Scroll />
      <RecoveryRedirect />
      <Suspense fallback={<Loading />}>
        <MaintenanceBoundary>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="packages" element={<Packages />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="food-photo-credits" element={<FoodPhotoCredits />} />
              <Route path="about" element={<About />} />
              <Route path="policies" element={<Policies />} />
              <Route path="terms" element={<Terms />} />
              <Route path="privacy" element={<Privacy />} />
            </Route>
            <Route
              path="login"
              element={<AuthPage key="login" mode="login" />}
            />
            <Route
              path="register"
              element={<AuthPage key="register" mode="register" />}
            />
            <Route
              path="forgot-password"
              element={<AuthPage key="forgot" mode="forgot" />}
            />
            <Route
              path="reset-password"
              element={<AuthPage key="reset" mode="reset" />}
            />
            <Route
              element={
                <RoleGuard>
                  <PortalLayout />
                </RoleGuard>
              }
            >
              <Route path="customer">
                <Route index element={<Start />} />
                <Route path="available-dates" element={<AvailableDates />} />
                <Route path="packages" element={<Packages />} />
                <Route path="reservations" element={<Reservations />} />
                <Route
                  path="reservations/new"
                  element={<ReservationWizard />}
                />
                <Route
                  path="reservations/:id"
                  element={<ReservationDetail />}
                />
                {['edit', 'menu', 'event-setup', 'confirm'].map((step) => (
                  <Route
                    key={step}
                    path={'reservations/:id/' + step}
                    element={<ReservationWizard />}
                  />
                ))}
                <Route path="payments" element={<Payments />} />
                <Route
                  path="transactions"
                  element={<Payments transactions />}
                />
                <Route
                  path="cancellations"
                  element={<CustomerWorkflow kind="cancellations" />}
                />
                <Route
                  path="refunds"
                  element={<CustomerWorkflow kind="refunds" />}
                />
                <Route
                  path="reschedule"
                  element={<CustomerWorkflow kind="reschedule" />}
                />
                <Route path="feedback" element={<Feedback />} />
                <Route path="support" element={<Support />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="manager">
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="calendar" element={<ManagerCalendar />} />
                <Route path="operating-hours" element={<OperatingHours />} />
                <Route path="catalog" element={<ManagerCatalog />} />
                <Route
                  path="event-setups"
                  element={<ManagerCatalog setups />}
                />
                <Route path="reports" element={<ManagePayments />} />
                <Route path="menu" element={<CatalogManager area="menu" />} />
                <Route path="reservations" element={<ManageReservations />} />
                <Route
                  path="cancellations"
                  element={<ReviewRequests kind="cancellations" />}
                />
                <Route
                  path="reschedule"
                  element={<ReviewRequests kind="reschedule" />}
                />
                <Route
                  path="payments"
                  element={<ManagePayments paymentsOnly />}
                />
                <Route
                  path="refunds"
                  element={<ReviewRequests kind="refunds" />}
                />
                <Route path="feedback" element={<Feedback staff />} />
                <Route path="support" element={<Support />} />
                <Route path="settings" element={<Settings />} />
              </Route>
              <Route path="super-admin">
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<SystemOverview />} />
                <Route path="backups" element={<Backups />} />
                <Route path="roles" element={<RolePermissions />} />
                <Route path="system-settings" element={<SystemSettings />} />
                <Route path="operating-hours" element={<OperatingHours />} />
                <Route path="security" element={<SecurityMonitoring />} />
                <Route path="reports" element={<SystemReports />} />
                <Route
                  path="packages"
                  element={<CatalogManager area="packages" />}
                />
                <Route
                  path="add-ons"
                  element={<CatalogManager area="extras" />}
                />
                <Route path="users" element={<UserManagement />} />
                <Route path="gallery" element={<GalleryManagement />} />
                <Route path="menu-photos" element={<CatalogManager area="food-photos" />} />
                <Route path="maintenance" element={<Maintenance />} />
                <Route path="audit-logs" element={<AuditLogs />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<Missing />} />
          </Routes>
        </MaintenanceBoundary>
      </Suspense>
    </BrowserRouter>
  )
}
