import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      navigate('/');
      return;
    }

    setLoginError(result?.error || 'Login failed. Please try again.');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Core BUETians</h1>
          <p>Welcome back! Please login to your account.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </div>
      </div>

      {loginError && (
        <div className="auth-error-modal-overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
          <div className="auth-error-modal-card">
            <div className="auth-error-title">Sign in failed</div>
            <p className="auth-error-message">{loginError}</p>
            <div className="auth-error-actions">
              <button
                type="button"
                className="btn btn-secondary auth-error-retry"
                onClick={() => setLoginError('')}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
