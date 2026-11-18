import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FaHome, FaComments, FaUsers, FaStore, FaBullhorn, FaBell, FaUser, FaSignOutAlt, FaSearch,
  FaMoon, FaSun, FaPenNib, FaEllipsisH, FaTimes,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { chatAPI, notificationAPI, userAPI } from '../services/apiService';
import { getNotificationLink } from '../utils/notifications';
import { timeAgo } from '../utils/time';
import Avatar from './common/Avatar';
import Logo from './common/Logo';
import '../styles/Navbar.css';

// The signed-in user's profile (for the avatar) is fetched once and shared by every
// page's navbar instead of being requested again on each navigation.
let profileCache = { id: null, data: null, promise: null };

const loadMyProfile = (userId, force = false) => {
  if (force || profileCache.id !== userId) {
    profileCache = { id: userId, data: null, promise: null };
  }
  if (profileCache.data) return Promise.resolve(profileCache.data);
  if (!profileCache.promise) {
    const cache = profileCache;
    cache.promise = userAPI
      .getProfile(userId)
      .then((response) => {
        cache.data = response.data;
        return cache.data;
      })
      .catch(() => null);
  }
  return profileCache.promise;
};

const NOTIFICATION_PREVIEW_COUNT = 8;

// Section shortcuts shown in the account menu.
const ACCOUNT_LINKS = [
  { to: '/', label: 'News Feed', Icon: FaHome, end: true },
  { to: '/groups', label: 'Groups', Icon: FaUsers },
  { to: '/chat', label: 'Messages', Icon: FaComments },
  { to: '/marketplace', label: 'Marketplace', Icon: FaStore },
  { to: '/blogs', label: 'Blogs', Icon: FaPenNib },
  { to: '/forums', label: 'Forums', Icon: FaBullhorn },
];

const tabClass = ({ isActive }) => `navbar-tab ${isActive ? 'active' : ''}`;

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [moreOpen, setMoreOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState(null); // 'notifications' | 'account' | null
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [me, setMe] = useState(profileCache.data);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState(false);

  const moreButtonRef = useRef(null);
  const notificationsRef = useRef(null);
  const accountRef = useRef(null);

  const loadUnreadCounts = useCallback(async () => {
    try {
      const [notificationRes, chatRes] = await Promise.all([
        notificationAPI.getCount().catch(() => ({ data: { count: 0 } })),
        chatAPI.getUnreadCount().catch(() => ({ data: { total_unread: 0 } })),
      ]);

      setUnreadNotifications(Number(notificationRes?.data?.count) || 0);
      setUnreadChats(Number(chatRes?.data?.total_unread) || 0);
    } catch (error) {
      setUnreadNotifications(0);
      setUnreadChats(0);
    }
  }, []);

  useEffect(() => {
    loadUnreadCounts();

    const intervalId = setInterval(loadUnreadCounts, 15000);
    const refreshOnFocus = () => loadUnreadCounts();
    const refreshEvent = () => loadUnreadCounts();

    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('counts:refresh', refreshEvent);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('counts:refresh', refreshEvent);
    };
  }, [loadUnreadCounts]);

  // Avatar and name for the account button; refreshed when the profile is edited.
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    loadMyProfile(user.id).then((data) => {
      if (!cancelled && data) setMe(data);
    });

    const refresh = () => {
      loadMyProfile(user.id, true).then((data) => {
        if (!cancelled && data) setMe(data);
      });
    };
    window.addEventListener('profile:updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('profile:updated', refresh);
    };
  }, [user?.id]);

  // Close menus on navigation.
  useEffect(() => {
    setMoreOpen(false);
    setOpenPanel(null);
  }, [location.pathname]);

  // Close the open popover on outside click or Escape; close the mobile sheet on Escape.
  useEffect(() => {
    if (!openPanel && !moreOpen) return undefined;

    const onPointerDown = (event) => {
      if (!openPanel) return;
      const wrap = openPanel === 'notifications' ? notificationsRef.current : accountRef.current;
      if (wrap && !wrap.contains(event.target)) setOpenPanel(null);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (openPanel) {
        const wrap = openPanel === 'notifications' ? notificationsRef.current : accountRef.current;
        setOpenPanel(null);
        wrap?.querySelector('button')?.focus();
      }
      if (moreOpen) {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openPanel, moreOpen]);

  const loadRecentNotifications = async () => {
    setRecentLoading(true);
    setRecentError(false);
    try {
      const response = await notificationAPI.getAll(NOTIFICATION_PREVIEW_COUNT);
      const items = response.data.results || response.data;
      setRecent(Array.isArray(items) ? items.slice(0, NOTIFICATION_PREVIEW_COUNT) : []);
    } catch (error) {
      setRecentError(true);
    } finally {
      setRecentLoading(false);
    }
  };

  const toggleNotifications = () => {
    if (openPanel === 'notifications') {
      setOpenPanel(null);
      return;
    }
    setOpenPanel('notifications');
    loadRecentNotifications();
  };

  const openNotification = async (notif) => {
    setOpenPanel(null);
    if (notif.is_read) return;
    try {
      await notificationAPI.markAsRead(notif.id);
      window.dispatchEvent(new Event('counts:refresh'));
    } catch (error) {
      // Navigating still works if marking as read fails.
    }
  };

  const handleLogout = () => {
    setOpenPanel(null);
    logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const countLabel = (count) => (count > 99 ? '99+' : count);

  return (
    <>
      <header className="navbar">
        <div className="navbar-left">
          <Link to="/" className="navbar-brand" aria-label="Core BUETians home">
            <Logo size={40} />
            <span className="navbar-brand-name">
              <span className="brand-core">Core</span> <span className="brand-buet">BUETians</span>
            </span>
          </Link>

          <form className="navbar-search" role="search" onSubmit={handleSearch}>
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              placeholder="Search Core BUETians"
              aria-label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
          <Link to="/search" className="icon-circle navbar-search-icon" aria-label="Search" title="Search">
            <FaSearch aria-hidden="true" />
          </Link>
        </div>

        <nav className="navbar-tabs" aria-label="Primary">
          <NavLink to="/" end className={tabClass} title="Home" aria-label="Home">
            <FaHome aria-hidden="true" />
          </NavLink>
          <NavLink to="/groups" className={tabClass} title="Groups" aria-label="Groups">
            <FaUsers aria-hidden="true" />
          </NavLink>
          <NavLink to="/marketplace" className={tabClass} title="Marketplace" aria-label="Marketplace">
            <FaStore aria-hidden="true" />
          </NavLink>
          <NavLink to="/forums" className={tabClass} title="Forums" aria-label="Forums">
            <FaBullhorn aria-hidden="true" />
          </NavLink>
          <NavLink to="/blogs" className={tabClass} title="Blogs" aria-label="Blogs">
            <FaPenNib aria-hidden="true" />
          </NavLink>
        </nav>

        <div className="navbar-right">
          <NavLink
            to="/chat"
            className={({ isActive }) => `icon-circle ${isActive ? 'active' : ''}`}
            title="Messages"
            aria-label={unreadChats > 0 ? `Messages, ${unreadChats} unread` : 'Messages'}
          >
            <FaComments aria-hidden="true" />
            {unreadChats > 0 && <span className="nav-badge">{countLabel(unreadChats)}</span>}
          </NavLink>

          <div className="popover-wrap" ref={notificationsRef}>
            <button
              type="button"
              className={`icon-circle ${openPanel === 'notifications' || location.pathname === '/notifications' ? 'active' : ''}`}
              title="Notifications"
              aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : 'Notifications'}
              aria-haspopup="true"
              aria-expanded={openPanel === 'notifications'}
              onClick={toggleNotifications}
            >
              <FaBell aria-hidden="true" />
              {unreadNotifications > 0 && <span className="nav-badge">{countLabel(unreadNotifications)}</span>}
            </button>

            {openPanel === 'notifications' && (
              <div className="popover notif-popover" role="dialog" aria-label="Notifications">
                <div className="popover-head">
                  <h2>Notifications</h2>
                  <Link to="/notifications" onClick={() => setOpenPanel(null)}>See all</Link>
                </div>

                {recentLoading ? (
                  <div className="popover-skeleton" aria-busy="true" aria-label="Loading notifications">
                    {[0, 1, 2].map((i) => (
                      <div className="popover-skel-row" key={i}>
                        <span className="skel popover-skel-avatar" />
                        <span className="skel popover-skel-line" />
                      </div>
                    ))}
                  </div>
                ) : recentError ? (
                  <p className="popover-note" role="alert">
                    Couldn't load notifications.{' '}
                    <button type="button" className="inline-link-btn" onClick={loadRecentNotifications}>
                      Try again
                    </button>
                  </p>
                ) : recent.length === 0 ? (
                  <p className="popover-note">You're all caught up.</p>
                ) : (
                  <ul className="popover-list">
                    {recent.map((notif) => {
                      const link = getNotificationLink(notif);
                      const row = (
                        <>
                          <Avatar src={notif.actor_profile_picture} name={notif.actor_name} size={40} decorative />
                          <span className="popover-item-text">
                            <span>
                              <strong>{notif.actor_name}</strong> {notif.content}
                            </span>
                            <time>{timeAgo(notif.created_at)}</time>
                          </span>
                          {!notif.is_read && <span className="notif-dot" role="img" aria-label="Unread" />}
                        </>
                      );
                      return (
                        <li key={notif.id} className={!notif.is_read ? 'unread' : ''}>
                          {link === '#' ? (
                            <div className="popover-item">{row}</div>
                          ) : (
                            <Link to={link} className="popover-item" onClick={() => openNotification(notif)}>
                              {row}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="popover-wrap" ref={accountRef}>
            <button
              type="button"
              className={`avatar-button ${openPanel === 'account' ? 'open' : ''}`}
              title="Account"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={openPanel === 'account'}
              onClick={() => setOpenPanel(openPanel === 'account' ? null : 'account')}
            >
              <Avatar src={me?.profile_picture} name={me?.name} size={40} decorative />
            </button>

            {openPanel === 'account' && (
              <div className="popover account-menu" role="menu">
                <Link to={`/profile/${user?.id}`} className="account-card" role="menuitem">
                  <Avatar src={me?.profile_picture} name={me?.name} size={48} decorative />
                  <span>
                    <strong>{me?.name || 'Your profile'}</strong>
                    <span>{me?.department_name ? `${me.department_name}${me.batch ? ` · Batch ${me.batch}` : ''}` : 'View your profile'}</span>
                  </span>
                </Link>

                <div className="account-divider" role="separator" />
                {ACCOUNT_LINKS.map(({ to, label, Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    role="menuitem"
                    className={({ isActive }) => `account-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="account-item-icon"><Icon aria-hidden="true" /></span>
                    {label}
                    {to === '/chat' && unreadChats > 0 && (
                      <span className="account-badge" aria-label={`${unreadChats} unread`}>{countLabel(unreadChats)}</span>
                    )}
                  </NavLink>
                ))}
                <div className="account-divider" role="separator" />

                <button type="button" className="account-item" role="menuitem" onClick={toggleTheme}>
                  <span className="account-item-icon">{isDark ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}</span>
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>
                <button type="button" className="account-item" role="menuitem" onClick={handleLogout}>
                  <span className="account-item-icon"><FaSignOutAlt aria-hidden="true" /></span>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile: compact actions in the top bar, primary navigation at the bottom */}
      <div className="mobile-topbar-actions">
        <Link to="/search" className="mobile-icon-btn" aria-label="Search">
          <FaSearch size={18} />
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="mobile-icon-btn"
          aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDark ? <FaSun size={18} /> : <FaMoon size={18} />}
        </button>
      </div>

      <nav className="bottom-nav" aria-label="Primary">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FaHome size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FaComments size={20} />
          <span>Chat</span>
          {unreadChats > 0 && <span className="nav-badge" aria-label={`${unreadChats} unread messages`}>{countLabel(unreadChats)}</span>}
        </NavLink>
        <NavLink to="/groups" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FaUsers size={20} />
          <span>Groups</span>
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FaBell size={20} />
          <span>Alerts</span>
          {unreadNotifications > 0 && <span className="nav-badge" aria-label={`${unreadNotifications} unread notifications`}>{countLabel(unreadNotifications)}</span>}
        </NavLink>
        <button
          type="button"
          ref={moreButtonRef}
          className={`bottom-nav-item ${moreOpen ? 'active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <FaEllipsisH size={20} />
          <span>More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div
            className="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="more-sheet-header">
              <span>Menu</span>
              <button type="button" className="mobile-icon-btn" onClick={() => setMoreOpen(false)} aria-label="Close menu">
                <FaTimes size={16} />
              </button>
            </div>
            <NavLink to={`/profile/${user?.id}`} className="more-sheet-link"><FaUser size={18} /> Profile</NavLink>
            <NavLink to="/marketplace" className="more-sheet-link"><FaStore size={18} /> Marketplace</NavLink>
            <NavLink to="/forums" className="more-sheet-link"><FaBullhorn size={18} /> Forums</NavLink>
            <NavLink to="/blogs" className="more-sheet-link"><FaPenNib size={18} /> Blogs</NavLink>
            <button type="button" onClick={handleLogout} className="more-sheet-link more-sheet-danger">
              <FaSignOutAlt size={18} /> Log out
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
