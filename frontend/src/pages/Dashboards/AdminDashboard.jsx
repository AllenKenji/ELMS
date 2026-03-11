import { useAuth } from '../../context/useAuth';
import StatsWidget from '../../components/Dashboard/StatsWidget';
import ActivityFeed from '../../components/Dashboard/ActivityFeed';
import PendingApprovalWidget from '../../components/Dashboard/PendingApprovalWidget';
import TrendChart from '../../components/Dashboard/TrendChart';
import QuickActionPanel from '../../components/Dashboard/QuickActionPanel';
import { useStats, useActivityFeed, usePendingItems, useTrendData } from '../../hooks/useDashboard';
import '../../styles/AdminDashboard.css';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { stats } = useStats();
  const { activities, loading: activityLoading } = useActivityFeed(10);
  const { items: pendingItems, loading: pendingLoading } = usePendingItems();
  const { data: trendData, loading: trendLoading } = useTrendData(30);

  const handleRefresh = () => {
    // Refresh all data
    window.location.reload();
  };

  const getDashboardTitle = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    return `${greeting}, ${user?.name || 'User'}!`;
  };

  return (
    <div className="dashboard-content">
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

      {/* Statistics Grid */}
      <div className="dashboard-section">
        <h2 className="section-title">📊 Statistics Overview</h2>
        <div className="stats-grid">
          <StatsWidget
            label="Total Ordinances"
            count={stats.totalOrdinances}
            icon="📋"
            color="#4a90e2"
            trend={{ direction: 'up', percentage: 12 }}
          />
          <StatsWidget
            label="In Progress"
            count={stats.draftOrdinances + stats.submittedOrdinances + stats.approvedOrdinances}
            icon="⏳"
            color="#f39c12"
          />
          <StatsWidget
            label="Published"
            count={stats.publishedOrdinances}
            icon="📖"
            color="#27ae60"
            trend={{ direction: 'up', percentage: 8 }}
          />
          <StatsWidget
            label="Upcoming Sessions"
            count={stats.upcomingSessions}
            icon="📅"
            color="#9b59b6"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Trend Chart */}
        <div className="dashboard-section full-width">
          <TrendChart
            data={trendData}
            loading={trendLoading}
            title="📈 Ordinances Created (Last 30 Days)"
          />
        </div>

        {/* Activity Feed */}
        <div className="dashboard-section">
          <ActivityFeed activities={activities} loading={activityLoading} />
        </div>

        {/* Pending Approvals */}
        <div className="dashboard-section">
          <PendingApprovalWidget items={pendingItems} loading={pendingLoading} />
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="dashboard-section">
        <h2 className="section-title">📋 Ordinance Status Breakdown</h2>
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
    </div>
  );
}