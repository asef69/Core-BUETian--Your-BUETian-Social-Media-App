import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExclamationCircle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordField from '../../components/auth/PasswordField';

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
    if (loginError) setLoginError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setLoginError('');
    const result = await login(formData.email, formData.password);
    setLoading(false);

    if (result.success) {
      navigate('/');
      return;
    }

    setLoginError(result?.error || 'Login failed. Please try again.');
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to catch up with your campus."
    >
      <form onSubmit={handleSubmit} className="auth-form" noValidate={false}>
        {loginError && (
          <div className="auth-error" role="alert">
            <FaExclamationCircle aria-hidden="true" />
            <div>
              <strong>We couldn't sign you in</strong>
              <p>{loginError}</p>
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Your password"
          autoComplete="current-password"
        />

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Login;
