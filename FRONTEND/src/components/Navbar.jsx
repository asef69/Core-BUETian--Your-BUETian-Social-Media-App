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
          <h2>Core BUETians</h2>
        </Link>

        <div className="navbar-search">
          <form onSubmit={handleSearch}>
            <FaSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search users, posts, groups..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>

        <ul className="navbar-menu">
          <li>
            <NavLink to="/" className="nav-link" title="Home" end>
              <FaHome size={20} />
            </NavLink>
          </li>
          <li>
            <NavLink to="/chat" className="nav-link" title="Messages">
              <FaComments size={20} />
              {unreadChats > 0 && <span className="nav-badge">{unreadChats > 99 ? '99+' : unreadChats}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to="/groups" className="nav-link" title="Groups">
              <FaUsers size={20} />
            </NavLink>
          </li>
          <li>
            <NavLink to="/marketplace" className="nav-link" title="Marketplace">
              <FaStore size={20} />
            </NavLink>
          </li>
          <li>
            <NavLink to="/forums" className="nav-link" title="Forums">
              <FaBullhorn size={20} />
            </NavLink>
          </li>
          <li>
            <NavLink to="/blogs" className="nav-link" title="Blogs">
              <FaPenNib size={20} />
            </NavLink>
          </li>
          <li>
            <NavLink to="/notifications" className="nav-link" title="Notifications">
              <FaBell size={20} />
              {unreadNotifications > 0 && <span className="nav-badge">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            </NavLink>
          </li>
          <li>
            <NavLink to={`/profile/${user?.id}`} className="nav-link" title="Profile">
              <FaUser size={20} />
            </NavLink>
          </li>
          <li>
            <button
              onClick={toggleTheme}
              className="nav-link theme-toggle-btn"
              title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {isDark ? <FaSun size={20} /> : <FaMoon size={20} />}
            </button>
          </li>
          <li>
            <button onClick={handleLogout} className="nav-link logout-btn" title="Logout">
              <FaSignOutAlt size={20} />
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
