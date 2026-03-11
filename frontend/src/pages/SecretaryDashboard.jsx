import { useAuth } from '../context/useAuth';
import StatsWidget from '../components/Dashboard/StatsWidget';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import PendingApprovalWidget from '../components/Dashboard/PendingApprovalWidget';
import TrendChart from '../components/Dashboard/TrendChart';
import QuickActionPanel from '../components/Dashboard/QuickActionPanel';
import { useStats, useActivityFeed, usePendingItems, useTrendData } from '../hooks/useDashboard';
import '../styles/SecretaryDashboard.css';

export default function SecretaryDashboard() {
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
    return `${greeting}, ${user?.name || 'Secretary'}!`;
  };

  return (
    <div className="dashboard-content secretary-dashboard">
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
          onNewSession={() => console.log('New session')}
          onViewSessions={() => console.log('View sessions')}
        />
      </div>

      {/* Key Metrics */}
      <div className="dashboard-section">
        <h2 className="section-title">📊 System Overview</h2>
        <div className="stats-grid">
          <StatsWidget
            label="Total Ordinances"
            count={stats.totalOrdinances}
            icon="📋"
            color="#4a90e2"
          />
          <StatsWidget
            label="Pending Processing"
            count={stats.draftOrdinances + stats.submittedOrdinances}
            icon="⏳"
            color="#f39c12"
          />
          <StatsWidget
            label="Ready to Publish"
            count={stats.approvedOrdinances}
            icon="📌"
            color="#27ae60"
          />
          <StatsWidget
            label="Upcoming Sessions"
            count={stats.upcomingSessions}
            icon="📅"
            color="#9b59b6"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Pending Approvals */}
        <div className="dashboard-section">
          <PendingApprovalWidget items={pendingItems} loading={pendingLoading} />
        </div>

        {/* Activity Feed */}
        <div className="dashboard-section">
          <ActivityFeed activities={activities} loading={activityLoading} />
        </div>
      </div>

      {/* Processing Status */}
      <div className="dashboard-section full-width">
        <h2 className="section-title">📋 Processing Status</h2>
        <div className="status-breakdown">
          <div className="breakdown-item">
            <span className="breakdown-label">Draft</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill draft"
                style={{
                  width: `${stats.totalOrdinances > 0 ? (stats.draftOrdinances / stats.totalOrdinances) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <span className="breakdown-count">{stats.draftOrdinances}</span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">Submitted</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill submitted"
                style={{
                  width: `${stats.totalOrdinances > 0 ? (stats.submittedOrdinances / stats.totalOrdinances) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <span className="breakdown-count">{stats.submittedOrdinances}</span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">Approved</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill approved"
                style={{
                  width: `${stats.totalOrdinances > 0 ? (stats.approvedOrdinances / stats.totalOrdinances) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <span className="breakdown-count">{stats.approvedOrdinances}</span>
          </div>

          <div className="breakdown-item">
            <span className="breakdown-label">Published</span>
            <div className="breakdown-bar">
              <div
                className="breakdown-fill published"
                style={{
                  width: `${stats.totalOrdinances > 0 ? (stats.publishedOrdinances / stats.totalOrdinances) * 100 : 0}%`,
                }}
              ></div>
            </div>
            <span className="breakdown-count">{stats.publishedOrdinances}</span>
          </div>
        </div>
      </div>

      {/* Trends */}
      <div className="dashboard-section full-width">
        <TrendChart
          data={trendData}
          loading={trendLoading}
          title="📈 System Activity (Last 30 Days)"
        />
      </div>
    </div>
  );
}