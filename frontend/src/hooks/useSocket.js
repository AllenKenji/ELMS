// hooks/useSocket.js
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function useSocket(role) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Create socket connection inside effect
    const socket = io('http://localhost:5000'); // adjust to your backend URL

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
