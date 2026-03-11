import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import '../styles/DashboardLayout.css'; 
import { FaBell, FaUser, FaFileAlt, FaFileSignature, FaUsers, FaCog, FaClipboardList, FaEnvelope } from 'react-icons/fa';

export default function DashboardLayout({ summary }) {
  const { logout, user } = useAuth();
  const location = useLocation();

  const sidebarLinksByRole = {
    Admin: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/users', label: 'User Management', icon: <FaUsers /> },
      { path: '/dashboard/audit-logs', label: 'Audit Logs', icon: <FaClipboardList /> },
      { path: '/dashboard/system-settings', label: 'System Settings', icon: <FaCog /> },
    ],
    Secretary: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/sessions', label: 'Sessions' },
      { path: '/dashboard/notifications', label: 'Notifications' },
    ],
    Councilor: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/ordinances', label: 'Ordinances' },
      { path: '/dashboard/resolutions', label: 'Resolutions' },
      { path: '/dashboard/notifications', label: 'Notifications' },
    ],
    Captain: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/ordinances', label: 'Ordinances' },
      { path: '/dashboard/resolutions', label: 'Resolutions' },
      { path: '/dashboard/notifications', label: 'Notifications' },
    ],
    Resident: [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/ordinances', label: 'Ordinances' },
      { path: '/dashboard/resolutions', label: 'Resolutions' },
      { path: '/dashboard/sessions', label: 'Sessions' },
      { path: '/dashboard/notifications', label: 'Notifications' },
    ],
    'DILG Official': [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/dashboard/ordinances', label: 'Ordinances' },
      { path: '/dashboard/resolutions', label: 'Resolutions' },
      { path: '/dashboard/sessions', label: 'Sessions' },
      { path: '/dashboard/notifications', label: 'Notifications' },
    ],
  };

  const links = sidebarLinksByRole[user?.role] || [];
  const dashboardHomePaths = ['/dashboard', '/admin-dashboard', '/secretary-dashboard', '/councilor-dashboard', '/captain-dashboard', '/resident-dashboard', '/dilg-dashboard'];
  const showSummaryCards = dashboardHomePaths.includes(location.pathname);

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        {/* Sidebar Title */}
        <div className="sidebar-header">
          <h2>E‑Legislative</h2>
          <hr />
          <h3>Main Navigation</h3>
        </div>

        <nav>
          <ul>
            {links.map((link, idx) => (
              <li key={idx}>
                <Link to={link.path}>
                  <span className="icon">{link.icon}</span>
                  <span className="label">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button onClick={logout} className="logout-button">Logout</button>
      </aside>

      <main className="dashboard-main">
        {/* Top bar with user info and notification bell */}
        <div className="dashboard-topbar">
          <div className="user-info">
            <strong>{user?.name || user?.role}</strong>
          </div>
          <div className="notification-bell" data-count={summary.find(s => s.title === 'Notifications')?.value || 0}>
            <FaBell />
          </div>
        </div>

        {/* Summary cards */}
        {showSummaryCards && (
          <div className="summary-cards">
            {summary.map((card, idx) => (
              <div key={idx} className="summary-card">
                <h3>{card.title}</h3>
                <p>{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Nested route content */}
        <Outlet />
      </main>
    </div>
  );
}
