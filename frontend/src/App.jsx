import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Register from './components/Register';
import DashboardLayout from './components/DashboardLayout';

import CouncilorDashboard from './pages/CouncilorDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import CaptainDashboard from './pages/CaptainDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import DILGDashboard from './pages/DILGDashboard';
import AdminDashboard from './pages/Dashboards/AdminDashboard';

import OrdinanceList from './components/Ordinances/OrdinanceList';
import ResolutionList from './components/ResolutionList';
import SessionList from './components/Sessions/SessionList';
import NotificationList from './components/NotificationList';
import MessageList from './components/MessageList';
import UserManagement from './components/UserManagement';
import AuditLogList from './components/AuditLogList';
import SystemSettings from './components/SystemSettings';

function App() {
  const { accessToken, login, user } = useAuth();

  // Store component references, not JSX
  const dashboards = {
    Councilor: CouncilorDashboard,
    Secretary: SecretaryDashboard,
    Captain: CaptainDashboard,
    Resident: ResidentDashboard,
    'DILG Official': DILGDashboard,
    Admin: AdminDashboard,
  };

  const dashboardComponent = user?.role ? dashboards[user.role] : null;
  const canAccessDashboard = Boolean(accessToken && dashboardComponent);
  const dashboardPathByRole = {
    Admin: '/dashboard',
    Secretary: '/dashboard',
    Councilor: '/dashboard',
    Captain: '/dashboard',
    Resident: '/dashboard',
    'DILG Official': '/dashboard',
  };
  const userDashboardPath = user?.role ? dashboardPathByRole[user.role] || '/dashboard' : '/';

  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route
          path="/"
          element={!canAccessDashboard ? <Login onLogin={login} /> : <Navigate to={userDashboardPath} />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Dashboard Routes with Layout */}
        <Route
          element={
            canAccessDashboard ? <DashboardLayout /> : <Navigate to="/" />
          }
        >
          {/* Main Dashboard */}
          <Route path="/dashboard" element={React.createElement(dashboardComponent)} />

          {/* Sub-routes inside dashboard layout */}
          <Route path="/dashboard/ordinances" element={<OrdinanceList />} />
          <Route path="/dashboard/resolutions" element={<ResolutionList />} />
          <Route path="/dashboard/sessions" element={<SessionList />} />
          <Route path="/dashboard/notifications" element={<NotificationList />} />
          <Route path="/dashboard/messages" element={<MessageList />} />
          <Route path="/dashboard/users" element={<UserManagement />} />
          <Route path="/dashboard/audit-logs" element={<AuditLogList />} />
          <Route path="/dashboard/system-settings" element={<SystemSettings />} />
        </Route>

        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;