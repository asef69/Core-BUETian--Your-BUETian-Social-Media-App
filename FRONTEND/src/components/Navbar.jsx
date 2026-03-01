import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHome, FaComments, FaUsers, FaStore, FaBullhorn, FaBell, FaUser, FaSignOutAlt, FaSearch } from 'react-icons/fa';
import '../styles/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

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
            <Link to="/" className="nav-link" title="Home">
              <FaHome size={20} />
              <span>Home</span>
            </Link>
          </li>
          <li>
            <Link to="/chat" className="nav-link" title="Messages">
              <FaComments size={20} />
              <span>Chat</span>
            </Link>
          </li>
          <li>
            <Link to="/groups" className="nav-link" title="Groups">
              <FaUsers size={20} />
              <span>Groups</span>
            </Link>
          </li>
          <li>
            <Link to="/marketplace" className="nav-link" title="Marketplace">
              <FaStore size={20} />
              <span>Marketplace</span>
            </Link>
          </li>
          <li>
            <Link to="/forums" className="nav-link" title="Forums">
              <FaBullhorn size={20} />
              <span>Forums</span>
            </Link>
          </li>
          <li>
            <Link to="/notifications" className="nav-link" title="Notifications">
              <FaBell size={20} />
              <span>Notifications</span>
            </Link>
          </li>
          <li>
            <Link to={`/profile/${user?.id}`} className="nav-link" title="Profile">
              <FaUser size={20} />
              <span>Profile</span>
            </Link>
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
