import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Register from './components/Register';
import DashboardLayout from './components/DashboardLayout';

import CouncilorDashboard from './pages/CouncilorDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import ViceMayorDashboard from './pages/ViceMayorDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import CommitteeSecretaryDashboard from './pages/CommitteeSecretaryDashboard';

import AdminDashboard from './pages/AdminDashboard';

import OrdinanceList from './components/Ordinances/OrdinanceList';
import ResolutionList from './components/Resolutions/ResolutionList';
import SessionList from './components/Sessions/SessionList';
import OrderOfBusinessPage from './components/Sessions/OrderOfBusinessPage';
import NotificationList from './components/NotificationList';
import MessageList from './components/Messages/MessageList';
import UserManagement from './components/UserManagement';
import AuditLogList from './components/AuditLogList';
import SystemSettings from './components/SystemSettings';
import VotingDashboard from './components/Voting/VotingDashboard';
import CommitteeList from './components/Committees/CommitteeList';
import ReportsList from './components/Reports/ReportsList';
import EventsCalendar from './components/Calendar/EventsCalendar';
import DraftsPage from './components/Drafts/DraftsPage';
import ProposedMeasuresPage from './components/ProposedMeasures/ProposedMeasuresPage';
import MinutesList from './components/Minutes/MinutesList';

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
          <Route path="/dashboard/voting" element={<VotingDashboard />} />
          <Route path="/dashboard/committees" element={<CommitteeList />} />
          <Route path="/dashboard/reports" element={<ReportsList />} />
          <Route path="/dashboard/calendar" element={<EventsCalendar />} />
          <Route path="/dashboard/drafts" element={<DraftsPage />} />
          <Route path="/dashboard/proposed-measures" element={<ProposedMeasuresPage />} />
          <Route path="/dashboard/minutes" element={<MinutesList />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;