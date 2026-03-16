import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import NotificationBell from './NotificationBell';
import '../styles/DashboardLayout.css'; 
import { FaBell, FaUser, FaFileAlt, FaFileSignature, FaUsers, FaCog, FaClipboardList, FaEnvelope, FaBars, FaTimes, FaVoteYea, FaLayerGroup, FaChartBar, FaCalendarAlt, FaEdit, FaInbox, FaRobot } from 'react-icons/fa';

export default function DashboardLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar when navigating
  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const sidebarLinksByRole = {
    Admin: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/drafts', label: 'Drafts', icon: <FaEdit /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
      { path: '/dashboard/voting', label: 'Voting', icon: <FaVoteYea /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/reports', label: 'Reports', icon: <FaChartBar /> },
      { path: '/dashboard/minutes', label: 'AI Meeting Minutes', icon: <FaRobot /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
      { path: '/dashboard/users', label: 'User Management', icon: <FaUsers /> },
      { path: '/dashboard/audit-logs', label: 'Audit Logs', icon: <FaClipboardList /> },
      { path: '/dashboard/system-settings', label: 'System Settings', icon: <FaCog /> },
    ],
    Secretary: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/drafts', label: 'Drafts', icon: <FaEdit /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
      { path: '/dashboard/voting', label: 'Voting', icon: <FaVoteYea /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/reports', label: 'Reports', icon: <FaChartBar /> },
      { path: '/dashboard/minutes', label: 'AI Meeting Minutes', icon: <FaRobot /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Councilor: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/drafts', label: 'Drafts', icon: <FaEdit /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
      { path: '/dashboard/voting', label: 'Voting', icon: <FaVoteYea /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/reports', label: 'Reports', icon: <FaChartBar /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Captain: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Resident: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
  };

  const links = sidebarLinksByRole[user?.role] || [];

  return (
    <div className="dashboard-container">
      {/* Mobile Hamburger Toggle Button */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar menu"
        title="Menu"
      >
        {sidebarOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Sidebar Overlay (Mobile Only) */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <h2>E‑Legislative</h2>
          <p className="sidebar-subtitle">Management System</p>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <ul>
            {links.map((link, idx) => (
              <li key={idx}>
                <Link
                  to={link.path}
                  className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
                  onClick={handleNavClick}
                  title={link.label}
                >
                  <span className="nav-icon">{link.icon}</span>
                  <span className="nav-label">{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            className="btn-logout-sidebar"
            onClick={logout}
            aria-label="Logout"
            title="Logout"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="dashboard-main">
        {/* Top Bar */}
        <div className="dashboard-topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">Dashboard</h1>
          </div>

          <div className="topbar-right">
            <div className="topbar-user">
              <NotificationBell />
              <div className="user-avatar">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-info">
                <p className="user-name">{user?.name || 'User'}</p>
                <p className="user-role">{user?.role || 'Role'}</p>
              </div>
              <button
                className="btn-logout"
                onClick={logout}
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
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