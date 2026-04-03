import React from 'react';
import { FiHome, FiArrowLeft } from 'react-icons/fi';
import '../../styles/ErrorPages.css';

/**
 * PAGE NOT FOUND - 404 Error Page
 */
export const NotFound = () => {
  return (
    <div className="error-page-container">
      <div className="error-page-content">
        <div className="error-code">404</div>
        
        <h1>Page Not Found</h1>
        
        <p className="error-description">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>

        <div className="error-page-actions">
          <button 
            onClick={() => window.location.href = '/'}
            className="btn-primary-lg"
          >
            <FiHome /> Go to Home
          </button>
          
          <button 
            onClick={() => window.history.back()}
            className="btn-secondary-lg"
          >
            <FiArrowLeft /> Go Back
          </button>
        </div>

        <div className="error-page-illustration">
          <div className="illustration-404">?</div>
        </div>
      </div>
    </div>
  );
};

/**
 * SERVER ERROR - 500 Error Page
 */
export const ServerError = () => {
  return (
    <div className="error-page-container">
      <div className="error-page-content">
        <div className="error-code error-code-500">500</div>
        
        <h1>Server Error</h1>
        
        <p className="error-description">
          Something went wrong on our end. Our team has been notified and is working to fix it.
        </p>

        <div className="error-page-actions">
          <button 
            onClick={() => window.location.reload()}
            className="btn-primary-lg"
          >
            Try Again
          </button>
          
          <button 
            onClick={() => window.location.href = '/'}
            className="btn-secondary-lg"
          >
            <FiHome /> Go to Home
          </button>
        </div>

        <div className="error-page-illustration">
          <div className="illustration-error">⚠️</div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
