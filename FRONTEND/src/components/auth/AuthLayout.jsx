import React from 'react';
import { NavLink } from 'react-router-dom';
import '../../styles/Auth.css';

const FEATURES = [
  ['Real-time chat', 'with batchmates and seniors'],
  ['Groups and forums', 'for your batch, hall and clubs'],
  ['A campus marketplace', 'for books, gear and hostel items'],
  ['Blood and tuition boards', 'to find donors and tutors'],
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
          {FEATURES.map(([name, text]) => (
            <li key={name}>
              <span>
                <strong>{name}</strong> {text}
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
