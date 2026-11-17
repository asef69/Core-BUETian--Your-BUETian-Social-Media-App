import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

/** Password input with a show/hide toggle. Pass through the usual input props. */
const PasswordField = ({ id, label, required = true, hint = null, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label} {required && <span className="required-asterisk" aria-hidden="true">*</span>}
      </label>
      <div className="password-wrap">
        <input id={id} type={visible ? 'text' : 'password'} required={required} {...inputProps} />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
        </button>
      </div>
      {hint}
    </div>
  );
};

export default PasswordField;
