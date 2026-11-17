import React, { useEffect, useState } from 'react';
import { toAbsoluteMediaUrl } from '../../config';

/**
 * Cover image with a designed fallback. The fallback hue is derived from the group id so
 * each group keeps a stable look without needing an uploaded image.
 */
const GroupCover = ({ src, seed = 0, className = '', children = null }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const variant = Math.abs(Number(seed) || 0) % 5;
  const showImage = src && !failed;

  return (
    <div className={`group-cover ${className} ${showImage ? '' : `group-cover-fallback v${variant}`}`.trim()}>
      {showImage && (
        <img src={toAbsoluteMediaUrl(src)} alt="" loading="lazy" onError={() => setFailed(true)} />
      )}
      {children}
    </div>
  );
};

export default GroupCover;
