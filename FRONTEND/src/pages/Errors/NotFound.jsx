import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiHome, FiArrowLeft } from 'react-icons/fi';
import '../../styles/ErrorPages.css';

const NotFound = () => {
  const navigate = useNavigate();

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
            onClick={() => navigate('/')}
            className="btn-primary-lg"
          >
            <FiHome /> Go to Home
          </button>
          
          <button 
            onClick={() => navigate(-1)}
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

export default NotFound;
