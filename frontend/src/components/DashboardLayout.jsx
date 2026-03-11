import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import '../styles/DashboardLayout.css'; 
import { FaBell, FaUser, FaFileAlt, FaFileSignature, FaUsers, FaCog, FaClipboardList, FaEnvelope } from 'react-icons/fa';

export default function DashboardLayout() {
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
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Councilor: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Captain: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Resident: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    'DILG Official': [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
  };

  const links = sidebarLinksByRole[user?.role] || [];

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <h2>E‑Legislative</h2>
          <hr />
          <h3>Main Navigation</h3>
        </div>

        {/* Navigation */}
        <nav>
          <ul>
            {links.map((link, idx) => (
              <li key={idx}>
                <Link
                  to={link.path}
                  className={location.pathname === link.path ? 'active' : ''}
                  title={link.label}
                >
                  {link.icon && <span className="nav-icon">{link.icon}</span>}
                  <span className="nav-label">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Top Bar */}
        <div className="dashboard-topbar">
          <div></div>
          <div className="topbar-user">
            <div className="topbar-user-info">
              <p className="topbar-user-name">{user?.name || 'User'}</p>
              <p className="topbar-user-role">{user?.role || 'Role'}</p>
            </div>
            <button className="btn-logout" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {/* Page Content */}
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}