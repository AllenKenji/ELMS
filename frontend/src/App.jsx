import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
const Login = lazy(() => import('./components/Login'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const Register = lazy(() => import('./components/Register'));
import DashboardLayout from './components/DashboardLayout';

const CouncilorDashboard = lazy(() => import('./pages/CouncilorDashboard'));
const SecretaryDashboard = lazy(() => import('./pages/SecretaryDashboard'));
const ViceMayorDashboard = lazy(() => import('./pages/ViceMayorDashboard'));
const ResidentDashboard = lazy(() => import('./pages/ResidentDashboard'));
const CommitteeSecretaryDashboard = lazy(() => import('./pages/CommitteeSecretaryDashboard'));

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const OrdinanceList = lazy(() => import('./components/Ordinances/OrdinanceList'));
const ResolutionList = lazy(() => import('./components/Resolutions/ResolutionList'));
const SessionList = lazy(() => import('./components/Sessions/SessionList'));
const OrderOfBusinessPage = lazy(() => import('./components/Sessions/OrderOfBusinessPage'));
const NotificationList = lazy(() => import('./components/NotificationList'));
const MessageList = lazy(() => import('./components/Messages/MessageList'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const AuditLogList = lazy(() => import('./components/AuditLogList'));
const SystemSettings = lazy(() => import('./components/SystemSettings'));
const CommitteeList = lazy(() => import('./components/Committees/CommitteeList'));
const CommitteeMeetingsPage = lazy(() => import('./pages/CommitteeMeetingsPage'));
const ReportsList = lazy(() => import('./components/Reports/ReportsList'));
const EventsCalendar = lazy(() => import('./components/Calendar/EventsCalendar'));
const DraftsPage = lazy(() => import('./components/Drafts/DraftsPage'));
const ProposedMeasuresPage = lazy(() => import('./components/ProposedMeasures/ProposedMeasuresPage'));
const MinutesList = lazy(() => import('./components/Minutes/MinutesList'));
const CommitteeMeetingLiveRoomPage = lazy(() => import('./pages/CommitteeMeetingLiveRoomPage'));

function App() {
  const { accessToken, login, user } = useAuth();

  const dashboards = {
    Councilor: CouncilorDashboard,
    Secretary: SecretaryDashboard,
    "Vice Mayor": ViceMayorDashboard,
    Resident: ResidentDashboard,
    Admin: AdminDashboard,
    "Committee Secretary": CommitteeSecretaryDashboard,
  };

  const dashboardComponent = user?.role ? dashboards[user.role] : null;
  const canAccessDashboard = Boolean(accessToken && dashboardComponent);

  return (
    <BrowserRouter>
      <Suspense fallback={<div className="app-route-loading">Loading...</div>}>
        <Routes>
          {/* Auth Routes */}
          <Route
            path="/"
            element={canAccessDashboard ? <Navigate to="/dashboard" /> : <Login onLogin={login} />}
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Dashboard Routes */}
          <Route
            element={canAccessDashboard ? <DashboardLayout /> : <Navigate to="/" />}
          >
            {/* Main Dashboard */}
            <Route path="/dashboard" element={React.createElement(dashboardComponent)} />

            {/* Sub-routes */}
            <Route path="/dashboard/committee-secretary" element={<CommitteeSecretaryDashboard />} />
            <Route path="/dashboard/ordinances" element={<OrdinanceList />} />
            <Route path="/dashboard/resolutions" element={<ResolutionList />} />
            <Route path="/dashboard/sessions" element={<SessionList />} />
            <Route path="/dashboard/order-of-business" element={<OrderOfBusinessPage />} />
            <Route path="/dashboard/notifications" element={<NotificationList />} />
            <Route path="/dashboard/messages" element={<MessageList />} />
            <Route path="/dashboard/users" element={<UserManagement />} />
            <Route path="/dashboard/audit-logs" element={<AuditLogList />} />
            <Route path="/dashboard/system-settings" element={<SystemSettings />} />
            <Route path="/dashboard/committees" element={<CommitteeList />} />
            <Route path="/dashboard/committee-meetings" element={<CommitteeMeetingsPage />} />
            <Route path="/dashboard/reports" element={<ReportsList />} />
            <Route path="/dashboard/calendar" element={<EventsCalendar />} />
            <Route path="/dashboard/drafts" element={<DraftsPage />} />
            <Route path="/dashboard/proposed-measures" element={<ProposedMeasuresPage />} />
            <Route path="/dashboard/minutes" element={<MinutesList />} />
            <Route path="/dashboard/committee-meetings/live/:committeeId/:meetingId" element={<CommitteeMeetingLiveRoomPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;