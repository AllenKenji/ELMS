// pages/ResidentDashboard.jsx
import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../context/useAuth';
import useSocket from '../hooks/useSocket';
import DashboardLayout from '../components/DashboardLayout';
import { Outlet } from 'react-router-dom';

export default function ResidentDashboard() {
  const [ordinances, setOrdinances] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [sessions, setSessions] = useState([]);
  const { user } = useAuth();
  const { notifications } = useSocket(user?.role);

  useEffect(() => {
    api.get('/ordinances').then(res => setOrdinances(res.data));
    api.get('/resolutions').then(res => setResolutions(res.data));
    api.get('/sessions').then(res => setSessions(res.data));
  }, []);

  const summary = [
    { title: 'Ordinances', value: ordinances.length },
    { title: 'Resolutions', value: resolutions.length },
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
