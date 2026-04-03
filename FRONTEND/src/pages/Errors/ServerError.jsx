import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiHome, FiArrowLeft, FiAlertTriangle } from 'react-icons/fi';
import '../../styles/ErrorPages.css';

const ServerError = () => {
  const navigate = useNavigate();

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
            onClick={() => navigate('/')}
            className="btn-secondary-lg"
          >
            <FiHome /> Go to Home
          </button>
        </div>

        <div className="error-page-illustration">
          <div className="illustration-error">
            <FiAlertTriangle size={80} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServerError;
