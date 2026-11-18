import React, { useId } from 'react';

/**
 * Core BUETians mark: an open ring (the "C" of Core, the campus community) around a
 * glowing core, connected to both ends of the ring. Keep in sync with public/favicon.svg.
 */
const Logo = ({ size = 40, className = '', title }) => {
  const gradientId = `cb-tile-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={`brand-logo ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="6" y1="2" x2="58" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5d6ef5" />
          <stop offset="1" stopColor="#2d3bb8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <path d="M45.02 21.07A17 17 0 1 0 45.02 42.93" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
      <path d="M32 32L45.02 21.07M32 32L45.02 42.93" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5.5" fill="#ffb347" />
    </svg>
  );
};

export default Logo;
