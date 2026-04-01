import '../../styles/ActivityFeed.css';

const getTimeAgo = (timestamp) => {
  const now = new Date();
  const time = new Date(timestamp);
  const seconds = Math.floor((now - time) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return time.toLocaleDateString();
};

export default function ActivityFeed({ activities, loading }) {
  if (loading) {
    return (
      <div className="activity-feed">
        <h3>📊 Recent Activity</h3>
        <div className="loading-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton-item"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      <h3>📊 Recent Activity</h3>

      {activities && activities.length > 0 ? (
        <div className="activity-list">
          {activities.map((activity, index) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-marker" style={{ backgroundColor: activity.color }}>
                {activity.icon}
              </div>

              <div className="activity-content">
                <div className="activity-header">
                  <p className="activity-description">
                    <strong>{activity.title}</strong>
                  </p>
                  <span className="activity-time">{getTimeAgo(activity.timestamp)}</span>
                </div>
                <p className="activity-meta">{activity.description}</p>
                {activity.status && (
                  <span className={`activity-status status-${activity.status.toLowerCase()}`}>
                    {activity.status}
                  </span>
                )}
              </div>

              {index < activities.length - 1 && <div className="activity-divider"></div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-activity">
          <p>No recent activity</p>
        </div>
      )}
    </div>
  );
}