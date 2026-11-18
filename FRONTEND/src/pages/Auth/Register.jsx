import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaExclamationCircle } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordField from '../../components/auth/PasswordField';
import Avatar from '../../components/common/Avatar';

const Required = () => <span className="required-asterisk" aria-hidden="true">*</span>;

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    student_id: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    batch: '',
    department_name: '',
    blood_group: '',
    hall_name: '',
    hall_attachement: 'Resident',
    profile_picture: null,
  });
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const passwordsMismatch =
    formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

  // Preview of the chosen photo; released when it changes or the page closes.
  const photoPreview = useMemo(
    () => (formData.profile_picture ? URL.createObjectURL(formData.profile_picture) : null),
    [formData.profile_picture],
  );
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'file' ? files[0] || null : value,
    });
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (formData.password !== formData.confirmPassword) {
      setFormError('Your passwords do not match. Please re-enter them.');
      document.getElementById('confirmPassword')?.focus();
      return;
    }

    setLoading(true);
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    setLoading(false);

    if (result.success) {
      navigate('/login');
      return;
    }
    setFormError(result?.error || 'Registration failed. Please check your details and try again.');
  };

  return (
    <AuthLayout
      wide
      title="Create your account"
      subtitle="Join the BUET community. Fields marked * are required."
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {formError && (
          <div className="auth-error" role="alert">
            <FaExclamationCircle aria-hidden="true" />
            <div>
              <strong>We couldn't create your account</strong>
              <p>{formError}</p>
            </div>
          </div>
        )}

        <fieldset className="auth-fieldset">
          <legend>Account</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="student_id">Student ID <Required /></label>
              <input
                type="number"
                id="student_id"
                name="student_id"
                value={formData.student_id}
                onChange={handleChange}
                placeholder="e.g. 2105001"
                inputMode="numeric"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="name">Full name <Required /></label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email <Required /></label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-row">
            <PasswordField
              id="password"
              label="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat the password"
              autoComplete="new-password"
              aria-invalid={passwordsMismatch}
              aria-describedby={passwordsMismatch ? 'password-mismatch' : undefined}
              hint={
                passwordsMismatch ? (
                  <p className="field-error" id="password-mismatch" role="alert">
                    Passwords don't match yet.
                  </p>
                ) : null
              }
            />
          </div>
        </fieldset>

        <fieldset className="auth-fieldset">
          <legend>About you</legend>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="batch">Batch</label>
              <input
                type="number"
                id="batch"
                name="batch"
                value={formData.batch}
                onChange={handleChange}
                placeholder="e.g. 21"
                inputMode="numeric"
              />
            </div>

            <div className="form-group">
              <label htmlFor="department_name">Department</label>
              <input
                type="text"
                id="department_name"
                name="department_name"
                value={formData.department_name}
                onChange={handleChange}
                placeholder="e.g. CSE"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="blood_group">Blood group</label>
              <select
                id="blood_group"
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
              >
                <option value="">Select</option>
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="hall_name">Hall</label>
              <input
                type="text"
                id="hall_name"
                name="hall_name"
                value={formData.hall_name}
                onChange={handleChange}
                placeholder="e.g. Sher-e-Bangla Hall"
              />
            </div>
          </div>

          <div className="form-group">
            <span className="field-label" id="hall-attachment-label">Hall attachment</span>
            <div className="hall-toggle" role="radiogroup" aria-labelledby="hall-attachment-label">
              {['Resident', 'Attached'].map((opt) => (
                <label
                  key={opt}
                  className={`hall-toggle-option${formData.hall_attachement === opt ? ' active' : ''}`}
                >
                  <input
                    type="radio"
                    name="hall_attachement"
                    value={opt}
                    checked={formData.hall_attachement === opt}
                    onChange={handleChange}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group photo-field">
            {photoPreview ? (
              <img className="photo-preview" src={photoPreview} alt="Selected profile" />
            ) : (
              <Avatar src={null} name="" size={56} decorative />
            )}
            <div className="photo-field-body">
              <label htmlFor="profile_picture">Profile picture</label>
              <input
                type="file"
                id="profile_picture"
                name="profile_picture"
                accept="image/*"
                onChange={handleChange}
              />
              <p className="field-note">Optional. A default picture is used if you skip this.</p>
            </div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Register;
