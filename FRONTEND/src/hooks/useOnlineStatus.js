import { useState, useEffect } from 'react';

/**
 * Custom hook to monitor online/offline status
 * Returns true when online, false when offline
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(() => {
    // Initialize based on current navigator status
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('✅ Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('⛔ Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export default useOnlineStatus;
