import React from 'react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import '../../styles/ErrorState.css';

/**
 * GENERIC ERROR STATE - Inline error display with retry
 */
export const ErrorState = ({
  title = 'Something went wrong',
  message = 'An error occurred. Please try again.',
  actionLabel = 'Retry',
  onRetry = () => {},
  showDetails = false,
  errorDetails = null,
  type = 'error',
}) => {
  return (
    <div className={`error-state-container error-state-${type}`}>
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

/**
 * NETWORK ERROR - Connection issues
 */
export const NetworkErrorState = ({ onRetry = () => {} }) => (
  <ErrorState
    title="Network Error"
    message="Unable to connect. Please check your internet connection and try again."
    actionLabel="Retry"
    onRetry={onRetry}
    type="network"
  />
);

/**
 * VALIDATION ERROR - Form validation failures
 */
export const ValidationErrorState = ({ errors = [], onDismiss = null }) => (
  <div className="validation-error-state">
    <div className="validation-error-header">
      <div className="validation-error-icon">
        <FiAlertCircle size={32} />
      </div>
      <h4>Please fix the following errors:</h4>
      {onDismiss && (
        <button onClick={onDismiss} className="validation-error-dismiss">×</button>
      )}
    </div>
    <ul className="validation-error-list">
      {errors.map((error, index) => (
        <li key={index} className="validation-error-item">
          {error}
        </li>
      ))}
    </ul>
  </div>
);

/**
 * ACCESS DENIED ERROR - 403 Forbidden
 */
export const AccessDeniedError = ({ onGoBack = () => window.history.back() }) => (
  <div className="error-state-container error-state-forbidden">
    <div className="error-state-content">
      <div className="error-state-icon forbidden-icon">
        <FiAlertCircle size={48} />
      </div>
      <h3 className="error-state-title">Access Denied</h3>
      <p className="error-state-message">
        You do not have permission to access this resource.
      </p>
      <button onClick={onGoBack} className="btn-error-retry">
        ← Go Back
      </button>
    </div>
  </div>
);

/**
 * TIMEOUT ERROR - Request timeout
 */
export const TimeoutError = ({ onRetry = () => {} }) => (
  <ErrorState
    title="Request Timeout"
    message="The request took too long to complete. Please try again."
    actionLabel="Retry"
    onRetry={onRetry}
    type="timeout"
  />
);

/**
 * INLINE ERROR MESSAGE - For quick error display
 */
export const InlineErrorMessage = ({ message = 'An error occurred', onDismiss = null }) => (
  <div className="error-message-inline">
    <FiAlertCircle size={20} />
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="error-message-dismiss">×</button>
    )}
  </div>
);

/**
 * INLINE SUCCESS MESSAGE
 */
export const InlineSuccessMessage = ({ message = 'Success!', onDismiss = null }) => (
  <div className="success-message-inline">
    <span>✓</span>
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="error-message-dismiss">×</button>
    )}
  </div>
);

/**
 * INLINE WARNING MESSAGE
 */
export const InlineWarningMessage = ({ message = 'Warning!', onDismiss = null }) => (
  <div className="warning-message-inline">
    <FiAlertCircle size={20} />
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="error-message-dismiss">×</button>
    )}
  </div>
);

export default ErrorState;
