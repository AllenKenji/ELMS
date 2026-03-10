import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import Register from './components/Register';

import CouncilorDashboard from './pages/CouncilorDashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';
import CaptainDashboard from './pages/CaptainDashboard';
import ResidentDashboard from './pages/ResidentDashboard';
import DILGDashboard from './pages/DILGDashboard';
import AdminDashboard from './pages/AdminDashboard';

import OrdinanceList from './components/OrdinanceList';
import ResolutionList from './components/ResolutionList';
import SessionList from './components/SessionList';
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
    Admin: '/admin-dashboard',
    Secretary: '/secretary-dashboard',
    Councilor: '/councilor-dashboard',
    Captain: '/captain-dashboard',
    Resident: '/resident-dashboard',
    'DILG Official': '/dilg-dashboard',
  };
  const userDashboardPath = user?.role ? dashboardPathByRole[user.role] || '/dashboard' : '/';

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={!canAccessDashboard ? <Login onLogin={login} /> : <Navigate to={userDashboardPath} />}
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/admin-dashboard"
          element={canAccessDashboard && user?.role === 'Admin' ? <AdminDashboard /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/secretary-dashboard"
          element={canAccessDashboard && user?.role === 'Secretary' ? <SecretaryDashboard /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/councilor-dashboard"
          element={canAccessDashboard && user?.role === 'Councilor' ? <CouncilorDashboard /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/captain-dashboard"
          element={canAccessDashboard && user?.role === 'Captain' ? <CaptainDashboard /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/resident-dashboard"
          element={canAccessDashboard && user?.role === 'Resident' ? <ResidentDashboard /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dilg-dashboard"
          element={canAccessDashboard && (user?.role === 'DILG' || user?.role === 'DILG Official') ? <DILGDashboard /> : <Navigate to="/dashboard" />}
        />

        {/* Protected dashboard route */}
        <Route
          path="/dashboard"
          element={
            canAccessDashboard
              ? React.createElement(dashboardComponent)
              : <Navigate to="/" />
          }
        >
          {/* Nested routes inside dashboard */}
          <Route path="ordinances" element={<OrdinanceList />} />
          <Route path="resolutions" element={<ResolutionList />} />
          <Route path="sessions" element={<SessionList />} />
          <Route path="notifications" element={<NotificationList />} />
          <Route path="messages" element={<MessageList />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="audit-logs" element={<AuditLogList />} />
          <Route path="system-settings" element={<SystemSettings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
