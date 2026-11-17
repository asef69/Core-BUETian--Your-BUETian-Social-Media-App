import React from 'react';
import { NavLink } from 'react-router-dom';
import { FaComments, FaUsers, FaStore, FaTint } from 'react-icons/fa';
import '../../styles/Auth.css';

const FEATURES = [
  [FaComments, 'Real-time chat', 'Message batchmates and seniors instantly.'],
  [FaUsers, 'Groups and forums', 'Your batch, hall and clubs in one place.'],
  [FaStore, 'Campus marketplace', 'Buy and sell books, gear and hostel items.'],
  [FaTint, 'Blood and tuition boards', 'Find donors and tutors within the community.'],
];

/** Shared frame for the login and registration screens. */
const AuthLayout = ({ title, subtitle, children, wide = false }) => (
  <div className="auth-page">
    <aside className="auth-brand">
      <div className="auth-logo">
        <span className="auth-logo-mark" aria-hidden="true">CB</span>
        <span>Core BUETians</span>
      </div>

      <div className="auth-brand-copy">
        <h2>Where all BUETians align.</h2>
        <p>One home for everything that happens around campus.</p>
        <ul>
          {FEATURES.map(([Icon, name, text]) => (
            <li key={name}>
              <span className="auth-feature-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>
                <strong>{name}</strong>
                <span>{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="auth-brand-foot">Made for the BUET community</p>
    </aside>

    <main className="auth-main">
      <div className="auth-mobile-hero">
        <div className="auth-logo">
          <span className="auth-logo-mark" aria-hidden="true">CB</span>
          <span>Core BUETians</span>
        </div>
        <p>Where all BUETians align.</p>
      </div>

      <div className={`auth-panel ${wide ? 'auth-panel-wide' : ''}`}>
        <nav className="auth-switch" aria-label="Account">
          <NavLink to="/login" className={({ isActive }) => (isActive ? 'active' : '')}>
            Log in
          </NavLink>
          <NavLink to="/register" className={({ isActive }) => (isActive ? 'active' : '')}>
            Sign up
          </NavLink>
        </nav>

        <header className="auth-header">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </header>

        {children}
      </div>
    </main>
  </div>
);

export default AuthLayout;
