// Central runtime configuration.
//
// Everything environment-specific comes from Vite env vars (set them in
// FRONTEND/.env.local for development or in the Vercel project settings):
//
//   VITE_API_URL            Base URL of the Django API, including /api
//                           e.g. https://my-backend.vercel.app/api
//   VITE_ENABLE_WEBSOCKET   "false" on hosts without WebSocket support
//                           (Vercel). Chat then falls back to REST + polling.
//   VITE_WS_URL             Optional explicit WebSocket origin (ws:// or wss://)

const trimTrailingSlash = (value) => String(value).replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
);

const resolveOrigin = (value) => {
  try {
    return new URL(value, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
};

// Origin that serves the API (and any legacy /media/... files).
export const API_ORIGIN = resolveOrigin(API_BASE_URL);
export const MEDIA_BASE_URL = API_ORIGIN;

export const REALTIME_ENABLED = import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false';

export const WS_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_WS_URL ||
    (API_ORIGIN.startsWith('https:')
      ? API_ORIGIN.replace('https:', 'wss:')
      : API_ORIGIN.replace('http:', 'ws:')),
);

export const DEFAULT_AVATAR = '/default-avatar.svg';
export const DEFAULT_GROUP_COVER = '/default-group.svg';
export const DEFAULT_PRODUCT_IMAGE = '/default-product.svg';

/**
 * Turn a stored media reference into something an <img>/<video> can load.
 * - Absolute URLs (Cloudinary) are returned untouched.
 * - Relative paths (legacy local uploads such as /media/x.jpg) are served
 *   from the API origin.
 */
export const toAbsoluteMediaUrl = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `${window.location.protocol}${url}`;
  return `${MEDIA_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};
