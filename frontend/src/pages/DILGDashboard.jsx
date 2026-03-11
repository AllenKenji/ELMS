import StatsWidget from '../components/Dashboard/StatsWidget';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import TrendChart from '../components/Dashboard/TrendChart';
import QuickActionPanel from '../components/Dashboard/QuickActionPanel';
import { useStats, useActivityFeed, useTrendData } from '../hooks/useDashboard';
import '../styles/DILGDashboard.css';

export default function DILGDashboard() {
  const { stats } = useStats();
  const { activities, loading: activityLoading } = useActivityFeed(10);
  const { data: trendData, loading: trendLoading } = useTrendData(30);

  const handleRefresh = () => {
    window.location.reload();
  };

  const getDashboardTitle = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    return `${greeting}, DILG Official!`;
  };

  return (
    <div className="dashboard-content dilg-dashboard">
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
          onNewOrdinance={() => console.log('Generate report')}
          onNewSession={() => console.log('View sessions')}
          onViewSessions={() => console.log('View sessions')}
        />
      </div>

      {/* Oversight Metrics */}
      <div className="dashboard-section">
        <h2 className="section-title">🔍 Oversight Metrics</h2>
        <div className="stats-grid">
          <StatsWidget
            label="Total Ordinances"
            count={stats.totalOrdinances}
            icon="📋"
            color="#4a90e2"
          />
          <StatsWidget
            label="Under Review"
            count={stats.draftOrdinances + stats.submittedOrdinances}
            icon="⏳"
            color="#f39c12"
          />
          <StatsWidget
            label="Compliant Laws"
            count={stats.publishedOrdinances}
            icon="✅"
            color="#27ae60"
          />
          <StatsWidget
            label="Compliance Rate"
            count="98%"
            icon="📊"
            color="#9b59b6"
          />
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Activity Feed */}
        <div className="dashboard-section full-width">
          <ActivityFeed activities={activities} loading={activityLoading} />
        </div>
      </div>

      {/* Trends */}
      <div className="dashboard-section full-width">
        <TrendChart
          data={trendData}
          loading={trendLoading}
          title="📈 Compliance Trend (Last 30 Days)"
        />
      </div>

      {/* Compliance Note */}
      <div className="dashboard-section">
        <h3 className="info-title">📋 DILG Compliance</h3>
        <div className="info-content">
          <p>This dashboard provides oversight of all legislative activities to ensure compliance with DILG standards and requirements.</p>
        </div>
      </div>
    </div>
  );
}