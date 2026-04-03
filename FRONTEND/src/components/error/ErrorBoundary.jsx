import React from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import '../../styles/ErrorBoundary.css';

/**
 * ERROR BOUNDARY - Catches unhandled React errors
 * Wraps entire app to prevent crashes
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">
              <FiAlertTriangle size={64} />
            </div>
            
            <h1>Oops! Something went wrong</h1>
            
            <p className="error-message">
              We're sorry for the inconvenience. The application encountered an unexpected error.
            </p>

            <details className="error-details">
              <summary>Error Details (Development Only)</summary>
              <div className="error-stack">
                <p className="error-heading">Error:</p>
                <pre className="error-text">{this.state.error?.toString()}</pre>
                
                {this.state.errorInfo && (
                  <>
                    <p className="error-heading">Stack Trace:</p>
                    <pre className="error-text">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>

            <div className="error-actions">
              <button 
                onClick={this.resetError}
                className="btn-primary"
              >
                Try Again
              </button>
              
              <button 
                onClick={() => window.location.href = '/'}
                className="btn-secondary"
              >
                Go to Home
              </button>
            </div>

            {this.state.errorCount > 3 && (
              <div className="error-warning">
                <p>⚠️ Multiple errors detected. Please refresh the page or contact support if the issue persists.</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
