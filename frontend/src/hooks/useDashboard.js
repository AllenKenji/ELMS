import { useState, useEffect } from 'react';
import api from '../api/api';

// Hook to fetch dashboard statistics
export const useStats = () => {
  const [stats, setStats] = useState({
    totalOrdinances: 0,
    draftOrdinances: 0,
    submittedOrdinances: 0,
    approvedOrdinances: 0,
    publishedOrdinances: 0,
    totalSessions: 0,
    upcomingSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');

        const [ordinancesRes, sessionsRes] = await Promise.all([
          api.get('/ordinances'),
          api.get('/sessions'),
        ]);

        const ordinances = ordinancesRes.data || [];
        const sessions = sessionsRes.data || [];

        const now = new Date();
        const upcomingSessions = sessions.filter(s => new Date(s.date) > now).length;

        const counts = {
          totalOrdinances: ordinances.length,
          draftOrdinances: ordinances.filter(o => o.status === 'Draft').length,
          submittedOrdinances: ordinances.filter(o => o.status === 'Submitted').length,
          approvedOrdinances: ordinances.filter(o => o.status === 'Approved').length,
          publishedOrdinances: ordinances.filter(o => o.status === 'Published').length,
          totalSessions: sessions.length,
          upcomingSessions,
        };

        setStats(counts);
      } catch (err) {
        setError('Failed to load statistics');
        console.error('Stats error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error };
};

// Hook to fetch recent activity
export const useActivityFeed = (limit = 10) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        setLoading(true);
        setError('');

        const [ordinancesRes, sessionsRes, auditRes] = await Promise.all([
          api.get('/ordinances'),
          api.get('/sessions'),
          api.get('/audit-logs'),
        ]);

        const ordinances = ordinancesRes.data || [];
        const sessions = sessionsRes.data || [];
        const auditLogs = auditRes.data || [];

        // Create activity items
        const activityItems = [];

        // Add ordinance activities
        ordinances.slice(0, 5).forEach(ord => {
          activityItems.push({
            id: `ord-${ord.id}`,
            type: 'ORDINANCE_CREATED',
            title: ord.title,
            description: `Created ordinance "${ord.title}"`,
            timestamp: ord.created_at,
            icon: '📋',
            color: '#4a90e2',
            status: ord.status,
          });
        });

        // Add session activities
        sessions.slice(0, 5).forEach(sess => {
          activityItems.push({
            id: `sess-${sess.id}`,
            type: 'SESSION_CREATED',
            title: sess.title,
            description: `Scheduled session "${sess.title}"`,
            timestamp: sess.created_at,
            icon: '📅',
            color: '#27ae60',
          });
        });

        // Add audit log activities
        auditLogs.slice(0, 5).forEach(log => {
          activityItems.push({
            id: `audit-${log.id}`,
            type: log.action,
            title: log.action,
            description: log.details,
            timestamp: log.timestamp,
            icon: '📝',
            color: '#f39c12',
            user: log.user_name,
          });
        });

        // Sort by timestamp (newest first)
        activityItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        setActivities(activityItems.slice(0, limit));
      } catch (err) {
        setError('Failed to load activities');
        console.error('Activity error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [limit]);

  return { activities, loading, error };
};

// Hook to fetch pending items
export const usePendingItems = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPending = async () => {
      try {
        setLoading(true);
        setError('');

        const ordinancesRes = await api.get('/ordinances');
        const ordinances = ordinancesRes.data || [];

        // Get pending statuses
        const pendingItems = ordinances
          .filter(o => ['Draft', 'Submitted', 'Under Review'].includes(o.status))
          .map(o => ({
            id: o.id,
            title: o.title,
            type: 'Ordinance',
            status: o.status,
            daysOld: Math.floor(
              (new Date() - new Date(o.created_at)) / (1000 * 60 * 60 * 24)
            ),
            proposer: o.proposer_name,
            icon: '📋',
            priority: o.status === 'Draft' ? 'low' : o.status === 'Submitted' ? 'medium' : 'high',
          }))
          .sort((a, b) => {
            // Sort by priority (high first)
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });

        setItems(pendingItems);
      } catch (err) {
        setError('Failed to load pending items');
        console.error('Pending error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPending();
  }, []);

  return { items, loading, error };
};

// Hook to fetch trend data
export const useTrendData = (days = 30) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        setError('');

        const ordinancesRes = await api.get('/ordinances');
        const ordinances = ordinancesRes.data || [];

        // Create date range
        const dateRange = [];
        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          dateRange.push(date);
        }

        // Count ordinances per day
        const trendData = dateRange.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const count = ordinances.filter(o => {
            const ordDate = new Date(o.created_at).toISOString().split('T')[0];
            return ordDate === dateStr;
          }).length;

          return {
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            ordinances: count,
            fullDate: dateStr,
          };
        });

        setData(trendData);
      } catch (err) {
        setError('Failed to load trend data');
        console.error('Trend error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [days]);

  return { data, loading, error };
};