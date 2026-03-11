import { useAuth } from '../context/useAuth';
import StatsWidget from '../components/Dashboard/StatsWidget';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import { useStats, useActivityFeed } from '../hooks/useDashboard';
import '../styles/ResidentDashboard.css';

export default function ResidentDashboard() {
  const { user } = useAuth();
  const { stats } = useStats();
  const { activities, loading: activityLoading } = useActivityFeed(10);

  const handleRefresh = () => {
    window.location.reload();
  };

  const getDashboardTitle = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
    return `${greeting}, ${user?.name || 'Resident'}!`;
  };

  return (
    <div className="dashboard-content resident-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <h1>{getDashboardTitle()}</h1>
          <p className="header-subtitle">Stay informed about our community ordinances and resolutions</p>
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

      {/* Community Stats */}
      <div className="dashboard-section">
        <h2 className="section-title">📊 Community Information</h2>
        <div className="stats-grid">
          <StatsWidget
            label="Published Ordinances"
            count={stats.publishedOrdinances}
            icon="📋"
            color="#27ae60"
          />
          <StatsWidget
            label="Total Resolutions"
            count={stats.totalOrdinances}
            icon="📝"
            color="#3498db"
          />
          <StatsWidget
            label="Community Members"
            count={12450}
            icon="👥"
            color="#9b59b6"
          />
          <StatsWidget
            label="Active Sessions"
            count={stats.upcomingSessions}
            icon="📅"
            color="#e67e22"
          />
        </div>
      </div>

      {/* Community News */}
      <div className="dashboard-section full-width">
        <h2 className="section-title">📢 Community News & Updates</h2>
        <ActivityFeed activities={activities} loading={activityLoading} />
      </div>

      {/* Information Card */}
      <div className="dashboard-section">
        <h3 className="info-title">ℹ️ How to Get Involved</h3>
        <div className="info-content">
          <p>
            As a community resident, you can:
            <ul>
              <li>📖 Review published ordinances and resolutions</li>
              <li>📅 Attend public sessions and meetings</li>
              <li>💬 Provide feedback and suggestions</li>
              <li>📬 Subscribe to updates and notifications</li>
            </ul>
          </p>
        </div>
      </div>
    </div>
  );
}