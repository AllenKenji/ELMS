import '../../styles/PendingApprovalWidget.css';

export default function PendingApprovalWidget({ items, loading }) {
  if (loading) {
    return (
      <div className="pending-widget">
        <h3>⏳ Pending Your Action</h3>
        <div className="loading-skeleton">
          {[1, 2].map(i => (
            <div key={i} className="skeleton-item"></div>
          ))}
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority) => {
    const colors = {
      high: '#e74c3c',
      medium: '#f39c12',
      low: '#95a5a6',
    };
    return colors[priority] || '#95a5a6';
  };

  const getPriorityLabel = (priority) => {
    const labels = {
      high: '🔴 Urgent',
      medium: '🟠 Normal',
      low: '⚪ Low',
    };
    return labels[priority] || 'Unknown';
  };

  return (
    <div className="pending-widget">
      <div className="widget-header">
        <h3>⏳ Pending Your Action</h3>
        {items && items.length > 0 && (
          <span className="pending-badge">{items.length}</span>
        )}
      </div>

      {items && items.length > 0 ? (
        <div className="pending-list">
          {items.map((item) => (
            <div
              key={item.id}
              className="pending-item"
              style={{ borderLeftColor: getPriorityColor(item.priority) }}
            >
              <div className="pending-content">
                <h4 className="pending-title">{item.title}</h4>
                <p className="pending-meta">
                  <span className="pending-type">{item.type}</span>
                  <span className="pending-time">{item.daysOld} days old</span>
                </p>
                <p className="pending-proposer">by {item.proposer || 'Unknown'}</p>
              </div>
              <span className="pending-priority" style={{ backgroundColor: getPriorityColor(item.priority) }}>
                {getPriorityLabel(item.priority)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-pending">
          <p>✅ No pending items - Great job!</p>
        </div>
      )}
    </div>
  );
}