import { useAuth } from '../../context/useAuth';
import '../../styles/QuickActionPanel.css';

export default function QuickActionPanel({ onNewOrdinance, onNewSession, onViewSessions }) {
  const { user } = useAuth();

  const canCreateOrdinance = ['Councilor', 'Secretary', 'Admin'].includes(user?.role);
  const canCreateSession = ['Secretary', 'Admin'].includes(user?.role);

  return (
    <div className="quick-action-panel">
      <h3>⚡ Quick Actions</h3>

      <div className="actions-grid">
        {canCreateOrdinance && (
          <button className="action-btn action-primary" onClick={onNewOrdinance}>
            <span className="action-icon">📋</span>
            <span className="action-label">New Ordinance</span>
          </button>
        )}

        {canCreateSession && (
          <button className="action-btn action-success" onClick={onNewSession}>
            <span className="action-icon">📅</span>
            <span className="action-label">New Session</span>
          </button>
        )}

        <button className="action-btn action-info" onClick={onViewSessions}>
          <span className="action-icon">👁️</span>
          <span className="action-label">View Sessions</span>
        </button>

        <button className="action-btn action-secondary">
          <span className="action-icon">📊</span>
          <span className="action-label">View Reports</span>
        </button>
      </div>
    </div>
  );
}