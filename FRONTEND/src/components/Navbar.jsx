import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaComments, FaUsers, FaStore, FaBullhorn, FaBell, FaUser, FaSignOutAlt, FaSearch, FaMoon, FaSun, FaPenNib } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import { chatAPI, notificationAPI } from '../services/apiService';
import '../styles/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
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
  );
};

export default Navbar;
