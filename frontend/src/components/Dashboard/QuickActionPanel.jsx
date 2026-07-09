import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import '../../styles/QuickActionPanel.css';

export default function QuickActionPanel({ onNewOrdinance, onNewSession, onViewSessions }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const canCreateOrdinance = ['Councilor', 'Admin'].includes(user?.role);
  const canCreateSession = ['Secretary', 'Admin'].includes(user?.role);

  const goTo = (path) => {
    navigate(path);
  };

  return (
    <div className="quick-action-panel">
      <h3>⚡ Quick Actions</h3>

      <div className="actions-grid">
        {canCreateOrdinance && (
          <button
            type="button"
            className="action-btn action-primary"
            onClick={() => goTo('/dashboard/proposed-measures')}
          >
            <span className="action-icon">📋</span>
            <span className="action-label">New Ordinance</span>
          </button>
        )}

        {canCreateSession && (
          <button
            type="button"
            className="action-btn action-success"
            onClick={() => goTo('/dashboard/sessions')}
          >
            <span className="action-icon">📅</span>
            <span className="action-label">New Session</span>
          </button>
        )}

        <button
          type="button"
          className="action-btn action-info"
          onClick={() => goTo('/dashboard/sessions')}
        >
          <span className="action-icon">👁️</span>
          <span className="action-label">View Sessions</span>
        </button>

        <button
          type="button"
          className="action-btn action-secondary"
          onClick={() => navigate('/dashboard/reports')}
        >
          <span className="action-icon">📊</span>
          <span className="action-label">View Reports</span>
        </button>
      </div>
    </div>
  );
}