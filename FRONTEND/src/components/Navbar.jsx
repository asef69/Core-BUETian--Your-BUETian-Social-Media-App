import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaComments, FaUsers, FaStore, FaBullhorn, FaBell, FaUser, FaSignOutAlt, FaSearch, FaMoon, FaSun, FaPenNib, FaEllipsisH, FaTimes } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { chatAPI, notificationAPI } from '../services/apiService';
import '../styles/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef(null);
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);

  const loadUnreadCounts = async () => {
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
  };

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
  }, []);

  // Close the mobile "More" sheet on navigation and on Escape.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <span className="navbar-brand-mark">CB</span>
          <span className="navbar-brand-copy">
            <h2>Core BUETians</h2>
            <span>Where All BUETians align</span>
          </span>
        </Link>

        <div className="navbar-search">
          <form onSubmit={handleSearch}>
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search people, posts, groups..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>

        <ul className="navbar-menu">
          <li>
            <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Home" end>
              <FaHome size={20} />
              <span>Home</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Messages">
              <FaComments size={20} />
              <span>Chat</span>
              {unreadChats > 0 && <span className="nav-badge">{unreadChats > 99 ? '99+' : unreadChats}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to="/groups" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Groups">
              <FaUsers size={20} />
              <span>Groups</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/marketplace" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Marketplace">
              <FaStore size={20} />
              <span>Market</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/forums" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Forums">
              <FaBullhorn size={20} />
              <span>Forums</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/blogs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Blogs">
              <FaPenNib size={20} />
              <span>Blogs</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/notifications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Notifications">
              <FaBell size={20} />
              <span>Notifications</span>
              {unreadNotifications > 0 && <span className="nav-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to={`/profile/${user?.id}`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Profile">
              <FaUser size={20} />
              <span>Profile</span>
            </NavLink>
          </li>
          <li>
            <button
              onClick={toggleTheme}
              className="nav-link theme-toggle-btn"
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {isDark ? <FaSun size={20} /> : <FaMoon size={20} />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </li>
          <li>
            <button onClick={handleLogout} className="nav-link logout-btn" title="Logout">
              <FaSignOutAlt size={20} />
              <span>Logout</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>

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
        {unreadChats > 0 && <span className="nav-badge" aria-label={`${unreadChats} unread messages`}>{unreadChats > 99 ? '99+' : unreadChats}</span>}
      </NavLink>
      <NavLink to="/groups" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaUsers size={20} />
        <span>Groups</span>
      </NavLink>
      <NavLink to="/notifications" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
        <FaBell size={20} />
        <span>Alerts</span>
        {unreadNotifications > 0 && <span className="nav-badge" aria-label={`${unreadNotifications} unread notifications`}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
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
