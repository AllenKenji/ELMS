// pages/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import useSocket from '../hooks/useSocket';
import DashboardLayout from '../components/DashboardLayout';
import { Outlet } from 'react-router-dom';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const { user } = useAuth();
  const { notifications } = useSocket(user?.role);

  useEffect(() => {
    api.get('/users').then(res => setUsers(res.data));
    api.get('/audit-logs').then(res => setAuditLogs(res.data));
  }, []);

  const summary = [
    { title: 'Users', value: users.length },
    { title: 'Audit Logs', value: auditLogs.length },
    { title: 'Notifications', value: notifications.length },
    { title: 'System Settings', value: 1 },
  ];

  return (
    <DashboardLayout summary={summary}>
      <Outlet /> {/* Nested routes will render here */}
    </DashboardLayout>
  );
}
