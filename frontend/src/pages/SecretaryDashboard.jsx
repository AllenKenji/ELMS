// pages/SecretaryDashboard.jsx
import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import useSocket from '../hooks/useSocket';
import DashboardLayout from '../components/DashboardLayout';
import { Outlet } from 'react-router-dom';

export default function SecretaryDashboard() {
  const [sessions, setSessions] = useState([]);
  const { user } = useAuth();
  const { notifications } = useSocket(user?.role);

  useEffect(() => {
    api.get('/sessions').then(res => setSessions(res.data));
  }, []);

  const summary = [
    { title: 'Ordinances', value: 0 },
    { title: 'Resolutions', value: 0 },
    { title: 'Sessions', value: sessions.length },
    { title: 'Notifications', value: notifications.length },
    { title: 'Messages', value: 0 },
  ];

  return (
    <DashboardLayout summary={summary}>
      <Outlet /> {/* Nested routes render here */}
    </DashboardLayout>
  );
}
