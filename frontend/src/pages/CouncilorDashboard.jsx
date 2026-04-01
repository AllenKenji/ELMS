import { useAuth } from '../context/useAuth';
import StatsWidget from '../components/Dashboard/StatsWidget';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import PendingApprovalWidget from '../components/Dashboard/PendingApprovalWidget';
import TrendChart from '../components/Dashboard/TrendChart';
import QuickActionPanel from '../components/Dashboard/QuickActionPanel';
import { useStats, useActivityFeed, usePendingItems, useTrendData } from '../hooks/useDashboard';
import '../styles/CouncilorDashboard.css';

export default function CouncilorDashboard() {
  const { user } = useAuth();
  const { stats } = useStats();
  const { activities, loading: activityLoading } = useActivityFeed(10);
  const { items: pendingItems, loading: pendingLoading } = usePendingItems();
  const { data: trendData, loading: trendLoading } = useTrendData(30);

  const handleRefresh = () => {
    window.location.reload();
  };

  const getDashboardTitle = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    return `${greeting}, ${user?.name || 'Councilor'}!`;
  };

  return (
    <div className="dashboard-content councilor-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{getDashboardTitle()}</h1>
          <p className="header-subtitle">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={handleRefresh}
            title="Refresh dashboard"
            aria-label="Refresh dashboard"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-section">
        <QuickActionPanel
          onNewOrdinance={() => console.log('New ordinance')}
          onNewSession={() => console.log('View sessions')}
          onViewSessions={() => console.log('View sessions')}
        />
      </div>

      {/* Key Metrics */}
      <div className="dashboard-section">
        <h2 className="section-title">📊 Your Ordinances Overview</h2>
        <div className="stats-grid">
          <StatsWidget
            label="My Ordinances"
            count={stats.totalOrdinances}
            icon="📋"
            color="#4a90e2"
          />
          <StatsWidget
            label="Awaiting Review"
            count={stats.submittedOrdinances}
            icon="⏳"
            color="#f39c12"
          />
          <StatsWidget
            label="Approved"
            count={stats.approvedOrdinances}
            icon="✅"
            color="#27ae60"
          />
          <StatsWidget
            label="Published"
            count={stats.publishedOrdinances}
            icon="📖"
            color="#9b59b6"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Pending Actions */}
        <div className="dashboard-section">
          <PendingApprovalWidget items={pendingItems} loading={pendingLoading} />
        </div>

        {/* Activity Feed */}
        <div className="dashboard-section">
          <ActivityFeed activities={activities} loading={activityLoading} />
        </div>
      </div>

      {/* Trends */}
      <div className="dashboard-section full-width">
        <TrendChart
          data={trendData}
          loading={trendLoading}
          title="📈 My Ordinances Activity (Last 30 Days)"
        />
      </div>
    </div>
  );
}