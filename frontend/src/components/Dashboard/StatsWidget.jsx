import '../../styles/StatsWidget.css';

export default function StatsWidget({ label, count, icon, color, trend = null }) {
  return (
    <div className="stats-widget" style={{ borderLeftColor: color }}>
      <div className="widget-icon" style={{ backgroundColor: `${color}20` }}>
        <span className="icon-emoji">{icon}</span>
      </div>

      <div className="widget-content">
        <h4 className="widget-label">{label}</h4>
        <p className="widget-count">{count}</p>
        {trend && (
          <span className={`widget-trend ${trend.direction}`}>
            {trend.direction === 'up' ? '📈' : '📉'} {trend.percentage}% from last month
          </span>
        )}
      </div>
    </div>
  );
}