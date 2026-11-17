import React, { useEffect, useState } from 'react';
import { DEFAULT_AVATAR, toAbsoluteMediaUrl } from '../../config';

/**
 * Round profile photo with a safe fallback.
 * Pass `decorative` when the person's name is already visible next to it.
 */
const Avatar = ({ src, name = '', size = 40, decorative = false, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const url = src && !failed ? toAbsoluteMediaUrl(src) : DEFAULT_AVATAR;

  return (
    <img
      className={`avatar ${className}`.trim()}
      src={url}
      alt={decorative || !name ? '' : `${name}'s profile photo`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
};

export default Avatar;
