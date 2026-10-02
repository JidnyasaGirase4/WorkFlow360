import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './routes/ProtectedRoute'
import { ROLES } from './mockData/users'

import PublicLayout from './layouts/PublicLayout'
import AuthLayout from './layouts/AuthLayout'
import AdminLayout from './layouts/AdminLayout'
import EmployeeLayout from './layouts/EmployeeLayout'
import ClientLayout from './layouts/ClientLayout'

const Home = lazy(() => import('./pages/public/Home'))
const Features = lazy(() => import('./pages/public/Features'))
const Solutions = lazy(() => import('./pages/public/Solutions'))
const Pricing = lazy(() => import('./pages/public/Pricing'))
const About = lazy(() => import('./pages/public/About'))
const Contact = lazy(() => import('./pages/public/Contact'))
const FAQ = lazy(() => import('./pages/public/FAQ'))
const Privacy = lazy(() => import('./pages/public/Privacy'))
const Terms = lazy(() => import('./pages/public/Terms'))
const NotFound = lazy(() => import('./pages/public/NotFound'))
const AccessDenied = lazy(() => import('./pages/public/AccessDenied'))

const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const VerifyEmail = lazy(() => import('./pages/auth/VerifyEmail'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))

const Leads = lazy(() => import('./pages/admin/crm/Leads'))
const LeadDetails = lazy(() => import('./pages/admin/crm/LeadDetails'))
const Clients = lazy(() => import('./pages/admin/crm/Clients'))
const ClientDetails = lazy(() => import('./pages/admin/crm/ClientDetails'))
const Contacts = lazy(() => import('./pages/admin/crm/Contacts'))

const Projects = lazy(() => import('./pages/admin/projects/Projects'))
const ProjectDetails = lazy(() => import('./pages/admin/projects/ProjectDetails'))
const Tasks = lazy(() => import('./pages/admin/tasks/Tasks'))

const Employees = lazy(() => import('./pages/admin/employees/Employees'))
const EmployeeProfile = lazy(() => import('./pages/admin/employees/EmployeeProfile'))
const Attendance = lazy(() => import('./pages/admin/employees/Attendance'))
const Leave = lazy(() => import('./pages/admin/employees/Leave'))

const Invoices = lazy(() => import('./pages/admin/billing/Invoices'))
const InvoiceDetails = lazy(() => import('./pages/admin/billing/InvoiceDetails'))
const Quotations = lazy(() => import('./pages/admin/billing/Quotations'))
const Payments = lazy(() => import('./pages/admin/billing/Payments'))
const Expenses = lazy(() => import('./pages/admin/billing/Expenses'))

const Documents = lazy(() => import('./pages/admin/documents/Documents'))
const Tickets = lazy(() => import('./pages/admin/support/Tickets'))
const TicketDetails = lazy(() => import('./pages/admin/support/TicketDetails'))
const Meetings = lazy(() => import('./pages/admin/meetings/Meetings'))
const Reports = lazy(() => import('./pages/admin/reports/Reports'))
const Team = lazy(() => import('./pages/admin/team/Team'))
const Settings = lazy(() => import('./pages/admin/settings/Settings'))

const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'))
const EmployeeProjects = lazy(() => import('./pages/employee/Projects'))
const EmployeeTasks = lazy(() => import('./pages/employee/Tasks'))
const EmployeeCalendar = lazy(() => import('./pages/employee/Calendar'))
const EmployeeAttendance = lazy(() => import('./pages/employee/Attendance'))
const EmployeeLeave = lazy(() => import('./pages/employee/Leave'))
const EmployeeDocuments = lazy(() => import('./pages/employee/Documents'))
const EmployeeMeetings = lazy(() => import('./pages/employee/Meetings'))
const EmployeeProfilePage = lazy(() => import('./pages/employee/Profile'))

const ClientDashboard = lazy(() => import('./pages/client/Dashboard'))
const ClientProjects = lazy(() => import('./pages/client/Projects'))
const ClientProjectDetails = lazy(() => import('./pages/client/ProjectDetails'))
const ClientDocuments = lazy(() => import('./pages/client/Documents'))
const ClientInvoices = lazy(() => import('./pages/client/Invoices'))
const ClientPayments = lazy(() => import('./pages/client/Payments'))
const ClientTickets = lazy(() => import('./pages/client/Tickets'))
const ClientTicketDetails = lazy(() => import('./pages/client/TicketDetails'))
const ClientMeetings = lazy(() => import('./pages/client/Meetings'))
const ClientProfilePage = lazy(() => import('./pages/client/Profile'))

const AdminCalendar = lazy(() => import('./pages/admin/calendar/Calendar'))
const CrmActivities = lazy(() => import('./pages/admin/crm/Activities'))
const Departments = lazy(() => import('./pages/admin/employees/Departments'))
const Milestones = lazy(() => import('./pages/admin/projects/Milestones'))
const NotificationsPage = lazy(() => import('./pages/shared/Notifications'))
const AccountSettings = lazy(() => import('./pages/shared/AccountSettings'))
const EmployeeNotifications = lazy(() => import('./pages/employee/Notifications'))
const ClientNotifications = lazy(() => import('./pages/client/Notifications'))
const EmployeeActivity = lazy(() => import('./pages/employee/Activity'))
const ClientTasks = lazy(() => import('./pages/client/Tasks'))
const ClientMessages = lazy(() => import('./pages/client/Messages'))
const SessionExpired = lazy(() => import('./pages/public/SessionExpired'))
const NetworkError = lazy(() => import('./pages/public/NetworkError'))

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading page">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
    </div>
  )
}

const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER]
const EMPLOYEE_ROLES = [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.SUPER_ADMIN, ROLES.COMPANY_ADMIN]

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public site */}
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/features" element={<Features />} />
                <Route path="/solutions" element={<Solutions />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/access-denied" element={<AccessDenied />} />
                <Route path="/session-expired" element={<SessionExpired />} />
                <Route path="/network-error" element={<NetworkError />} />
              </Route>

              {/* Auth */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
              </Route>

              {/* Admin */}
              <Route element={<ProtectedRoute allowedRoles={STAFF_ROLES} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />

                  <Route path="crm/leads" element={<Leads />} />
                  <Route path="crm/leads/:id" element={<LeadDetails />} />
                  <Route path="crm/clients" element={<Clients />} />
                  <Route path="crm/clients/:id" element={<ClientDetails />} />
                  <Route path="crm/contacts" element={<Contacts />} />
                  <Route path="crm/activities" element={<CrmActivities />} />

                  <Route path="projects" element={<Projects />} />
                  <Route path="projects/:id" element={<ProjectDetails />} />
                  <Route path="tasks" element={<Tasks />} />
                  <Route path="milestones" element={<Milestones />} />

                  <Route path="employees" element={<Employees />} />
                  <Route path="employees/:id" element={<EmployeeProfile />} />
                  <Route path="departments" element={<Departments />} />
                  <Route path="employees/attendance" element={<Attendance />} />
                  <Route path="employees/leave" element={<Leave />} />

                  <Route path="billing/quotations" element={<Quotations />} />
                  <Route path="billing/invoices" element={<Invoices />} />
                  <Route path="billing/invoices/:id" element={<InvoiceDetails />} />
                  <Route path="billing/payments" element={<Payments />} />
                  <Route path="billing/expenses" element={<Expenses />} />

                  <Route path="documents" element={<Documents />} />
                  <Route path="support" element={<Tickets />} />
                  <Route path="support/:id" element={<TicketDetails />} />
                  <Route path="meetings" element={<Meetings />} />
                  <Route path="calendar" element={<AdminCalendar />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="team" element={<Team />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Route>

              {/* Employee */}
              <Route element={<ProtectedRoute allowedRoles={EMPLOYEE_ROLES} />}>
                <Route path="/employee" element={<EmployeeLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<EmployeeDashboard />} />
                  <Route path="projects" element={<EmployeeProjects />} />
                  <Route path="tasks" element={<EmployeeTasks />} />
                  <Route path="calendar" element={<EmployeeCalendar />} />
                  <Route path="attendance" element={<EmployeeAttendance />} />
                  <Route path="leave" element={<EmployeeLeave />} />
                  <Route path="documents" element={<EmployeeDocuments />} />
                  <Route path="meetings" element={<EmployeeMeetings />} />
                  <Route path="activity" element={<EmployeeActivity />} />
                  <Route path="notifications" element={<EmployeeNotifications />} />
                  <Route path="profile" element={<EmployeeProfilePage />} />
                  <Route path="settings" element={<AccountSettings profileHref="/employee/profile" />} />
                </Route>
              </Route>

              {/* Client */}
              <Route element={<ProtectedRoute allowedRoles={[ROLES.CLIENT]} />}>
                <Route path="/client" element={<ClientLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<ClientDashboard />} />
                  <Route path="projects" element={<ClientProjects />} />
                  <Route path="projects/:id" element={<ClientProjectDetails />} />
                  <Route path="tasks" element={<ClientTasks />} />
                  <Route path="documents" element={<ClientDocuments />} />
                  <Route path="invoices" element={<ClientInvoices />} />
                  <Route path="payments" element={<ClientPayments />} />
                  <Route path="tickets" element={<ClientTickets />} />
                  <Route path="tickets/:id" element={<ClientTicketDetails />} />
                  <Route path="meetings" element={<ClientMeetings />} />
                  <Route path="messages" element={<ClientMessages />} />
                  <Route path="notifications" element={<ClientNotifications />} />
                  <Route path="profile" element={<ClientProfilePage />} />
                  <Route path="settings" element={<AccountSettings profileHref="/client/profile" />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
