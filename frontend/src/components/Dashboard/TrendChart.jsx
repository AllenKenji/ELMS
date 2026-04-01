import '../../styles/TrendChart.css';

export default function TrendChart({ data, loading, title = "Ordinances Created (Last 30 Days)" }) {
  if (loading) {
    return (
      <div className="trend-chart">
        <h3>{title}</h3>
        <div className="chart-loading">Loading chart...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="trend-chart">
        <h3>{title}</h3>
        <div className="chart-empty">No data available</div>
      </div>
    );
  }

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => d.ordinances), 1);
  const scale = 100 / maxValue;

  return (
    <div className="trend-chart">
      <h3>{title}</h3>

      <div className="chart-container">
        <div className="chart-y-axis">
          <div className="y-label">{maxValue}</div>
          <div className="y-label">{Math.floor(maxValue / 2)}</div>
          <div className="y-label">0</div>
        </div>

        <div className="chart-bars">
          {data.map((item, index) => (
            <div key={index} className="bar-wrapper">
              <div className="bar-container">
                <div
                  className="bar"
                  style={{
                    height: `${item.ordinances * scale}%`,
                    backgroundColor: item.ordinances > 0 ? '#4a90e2' : '#e0e0e0',
                  }}
                  title={`${item.date}: ${item.ordinances} ordinances`}
                >
                  {item.ordinances > 0 && (
                    <span className="bar-value">{item.ordinances}</span>
                  )}
                </div>
              </div>
              <span className="bar-label">{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="chart-stats">
        <div className="stat">
          <span className="stat-label">Total Created:</span>
          <span className="stat-value">{data.reduce((sum, d) => sum + d.ordinances, 0)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Average/Day:</span>
          <span className="stat-value">
            {(data.reduce((sum, d) => sum + d.ordinances, 0) / data.length).toFixed(1)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Peak Day:</span>
          <span className="stat-value">
            {Math.max(...data.map(d => d.ordinances))}
          </span>
        </div>
      </div>
    </div>
  );
}