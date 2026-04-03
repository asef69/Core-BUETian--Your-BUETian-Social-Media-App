import React from 'react';
import '../styles/Skeleton.css';

export const SkeletonLoader = ({ count = 1, type = 'post', style = {} }) => {
  const getSkeletonContent = () => {
    switch (type) {
      case 'post':
        return (
          <div className="skeleton-post">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-text">
              <div className="skeleton-line skeleton-line-short"></div>
              <div className="skeleton-line skeleton-line-full"></div>
              <div className="skeleton-line skeleton-line-full"></div>
            </div>
            <div className="skeleton-image"></div>
          </div>
        );
      
      case 'card':
        return (
          <div className="skeleton-card">
            <div className="skeleton-image"></div>
            <div className="skeleton-text">
              <div className="skeleton-line skeleton-line-short"></div>
              <div className="skeleton-line skeleton-line-full"></div>
              <div className="skeleton-line skeleton-line-short"></div>
            </div>
          </div>
        );
      
      case 'comment':
        return (
          <div className="skeleton-comment">
            <div className="skeleton-avatar-small"></div>
            <div className="skeleton-text">
              <div className="skeleton-line skeleton-line-short"></div>
              <div className="skeleton-line skeleton-line-full"></div>
            </div>
          </div>
        );
      
      case 'user':
        return (
          <div className="skeleton-user">
            <div className="skeleton-avatar-large"></div>
            <div className="skeleton-text">
              <div className="skeleton-line skeleton-line-short"></div>
              <div className="skeleton-line skeleton-line-short"></div>
            </div>
          </div>
        );
      
      case 'list':
        return (
          <div className="skeleton-list">
            <div className="skeleton-line skeleton-line-full"></div>
            <div className="skeleton-line skeleton-line-full"></div>
            <div className="skeleton-line skeleton-line-short"></div>
          </div>
        );
      
      case 'table-row':
        return (
          <div className="skeleton-table-row">
            <div className="skeleton-line skeleton-line-short"></div>
            <div className="skeleton-line skeleton-line-full"></div>
            <div className="skeleton-line skeleton-line-short"></div>
          </div>
        );
      
      default:
        return <div className="skeleton-line skeleton-line-full"></div>;
    }
  };

  return (
    <div className="skeleton-container" style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="skeleton-item">
          {getSkeletonContent()}
        </div>
      ))}
    </div>
  );
};

export const LoadingSpinner = ({ size = 'md', fullScreen = false }) => {
  const sizeClass = `spinner-${size}`;
  const containerClass = fullScreen ? 'loading-container-fullscreen' : 'loading-container';

  return (
    <div className={containerClass}>
      <div className={`spinner ${sizeClass}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
    </div>
  );
};

export default SkeletonLoader;
