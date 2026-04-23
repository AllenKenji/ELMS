// hooks/useSocket.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/api';

export default function useSocket(role) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Create socket connection inside effect
    const socket = io(import.meta.env.VITE_SOCKET_URL || API_BASE_URL);

    // Join role-specific room
    if (role) {
      socket.emit('joinRole', role);
    }

    // Listen for broadcasts
    socket.on('newOrdinance', (ordinance) => {
      setNotifications(prev => [...prev, { message: `New ordinance: ${ordinance.title}` }]);
    });

    socket.on('resolutionUpdated', (resolution) => {
      setNotifications(prev => [...prev, { message: `Resolution updated: ${resolution.title}` }]);
    });

    socket.on('sessionScheduled', (session) => {
      setNotifications(prev => [...prev, { message: `Session scheduled: ${session.date}` }]);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [role]); // only re-run when role changes

  return { notifications };
}
