import { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import api, { API_BASE_URL } from '../api/api';
import NotificationBell from './NotificationBell';
import '../styles/DashboardLayout.css'; 
import { FaBell, FaUser, FaFileAlt, FaFileSignature, FaUsers, FaCog, FaClipboardList, FaEnvelope, FaBars, FaTimes, FaLayerGroup, FaChartBar, FaCalendarAlt, FaEdit, FaInbox, FaRobot } from 'react-icons/fa';

export default function DashboardLayout() {
  const { accessToken, logout, user } = useAuth();
  // console.log('DashboardLayout user:', user);
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarErrored, setAvatarErrored] = useState(false);
  const [resolvedPhotoUrl, setResolvedPhotoUrl] = useState(null);

  useEffect(() => {
    setAvatarErrored(false);
  }, [user?.photo_url, user?.e_profile_photo_url, user?.profile_photo_url]);

  useEffect(() => {
    let isCancelled = false;

    const loadPhoto = async () => {
      if (!user?.id || !accessToken) {
        setResolvedPhotoUrl(null);
        return;
      }

      try {
        const response = await api.get('/users/me/photo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (isCancelled) return;

        const photoUrl = response.data?.photo_url || null;
        if (photoUrl) {
          const absoluteUrl = /^https?:\/\//i.test(photoUrl)
            ? photoUrl
            : `${API_BASE_URL}${photoUrl.startsWith('/') ? '' : '/'}${photoUrl}`;
          setResolvedPhotoUrl(absoluteUrl);
        } else {
          setResolvedPhotoUrl(null);
        }
      } catch {
        if (!isCancelled) {
          setResolvedPhotoUrl(null);
        }
      }
    };

    loadPhoto();

    return () => {
      isCancelled = true;
    };
  }, [accessToken, user?.id, user?.photo_url, user?.e_profile_photo_url, user?.profile_photo_url]);

  // Close sidebar when navigating
  const handleNavClick = () => {
    setSidebarOpen(false);
  };

  const sidebarLinksByRole = {
    'Committee Secretary': [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/committee-secretary', label: 'Committee Secretary Panel', icon: <FaClipboardList /> },
      { path: '/dashboard/committee-meetings', label: 'Committee Meetings', icon: <FaCalendarAlt /> },
      { path: '/dashboard/minutes', label: 'AI Meeting Minutes', icon: <FaRobot /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    Admin: [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/drafts', label: 'Drafts', icon: <FaEdit /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/order-of-business', label: 'Order of Business', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
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
      { path: '/dashboard/order-of-business', label: 'Order of Business', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
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
      { path: '/dashboard/order-of-business', label: 'Order of Business', icon: <FaClipboardList /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
      { path: '/dashboard/ordinances', label: 'Ordinances', icon: <FaFileAlt /> },
      { path: '/dashboard/resolutions', label: 'Resolutions', icon: <FaFileSignature /> },
      { path: '/dashboard/calendar', label: 'Events Calendar', icon: <FaCalendarAlt /> },
      { path: '/dashboard/reports', label: 'Reports', icon: <FaChartBar /> },
      { path: '/dashboard/messages', label: 'Messages', icon: <FaEnvelope /> },
      { path: '/dashboard/notifications', label: 'Notifications', icon: <FaBell /> },
    ],
    'Vice Mayor': [
      { path: '/dashboard', label: 'Dashboard', icon: <FaUser /> },
      { path: '/dashboard/proposed-measures', label: 'Proposed Measures', icon: <FaInbox /> },
      { path: '/dashboard/committees', label: 'Committees', icon: <FaLayerGroup /> },
      { path: '/dashboard/sessions', label: 'Sessions', icon: <FaClipboardList /> },
      { path: '/dashboard/order-of-business', label: 'Order of Business', icon: <FaClipboardList /> },
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
  // console.log('Sidebar links for role', user?.role, links);

  const userPhotoUrl = useMemo(() => {
    if (resolvedPhotoUrl) return resolvedPhotoUrl;
    const rawPhotoUrl = user?.photo_url || user?.e_profile_photo_url || user?.profile_photo_url || '';
    if (!rawPhotoUrl) return null;
    if (/^https?:\/\//i.test(rawPhotoUrl)) return rawPhotoUrl;
    return `${API_BASE_URL}${rawPhotoUrl.startsWith('/') ? '' : '/'}${rawPhotoUrl}`;
  }, [resolvedPhotoUrl, user]);

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
              {user && <NotificationBell />}
              <div className="user-avatar" aria-hidden="true">
                {userPhotoUrl && !avatarErrored ? (
                  <img
                    src={userPhotoUrl}
                    alt={user?.name || 'User profile photo'}
                    className="user-avatar-image"
                    onError={() => setAvatarErrored(true)}
                  />
                ) : (
                  <span>{user?.name?.charAt(0).toUpperCase() || 'U'}</span>
                )}
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