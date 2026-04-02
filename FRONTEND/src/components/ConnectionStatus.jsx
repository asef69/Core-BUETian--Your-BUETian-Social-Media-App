import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import '../styles/ConnectionStatus.css';

export const ConnectionStatus = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="connection-status offline">
      <div className="connection-status-content">
        <span className="connection-status-indicator"></span>
        <span className="connection-status-text">You are offline</span>
      </div>
    </div>
  );
};

export default ConnectionStatus;
