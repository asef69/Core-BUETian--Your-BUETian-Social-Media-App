import React from 'react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import '../styles/ErrorState.css';

export const ErrorState = ({
  title = 'Something went wrong',
  message = 'An error occurred. Please try again.',
  actionLabel = 'Retry',
  onRetry = () => {},
  showDetails = false,
  errorDetails = null,
}) => {
  return (
    <div className="error-state-container">
      <div className="error-state-content">
        <div className="error-state-icon">
          <FiAlertCircle size={48} />
        </div>

        <h3 className="error-state-title">{title}</h3>
        
        <p className="error-state-message">{message}</p>

        {showDetails && errorDetails && (
          <details className="error-state-details">
            <summary>Error Details</summary>
            <pre className="error-details-text">{errorDetails}</pre>
          </details>
        )}

        <button onClick={onRetry} className="btn-error-retry">
          <FiRefreshCw /> {actionLabel}
        </button>
      </div>
    </div>
  );
};

export const NetworkErrorState = ({ onRetry }) => (
  <ErrorState
    title="Network Error"
    message="Unable to connect. Please check your internet connection and try again."
    actionLabel="Retry"
    onRetry={onRetry}
  />
);

export const ValidationErrorState = ({ errors = [] }) => (
  <div className="validation-error-state">
    <div className="validation-error-icon">
      <FiAlertCircle size={32} />
    </div>
    <h4>Please fix the following errors:</h4>
    <ul className="validation-error-list">
      {errors.map((error, index) => (
        <li key={index} className="validation-error-item">
          {error}
        </li>
      ))}
    </ul>
  </div>
);

export default ErrorState;
