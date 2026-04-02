// ============================================================================
// PROFESSIONAL TOAST NOTIFICATIONS UTILITY
// ============================================================================

import { toast } from 'react-toastify';
import { FiCheckCircle, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

/**
 * Custom toast configuration with professional styling
 * Combines icon, message, and description for a polished look
 */

export const showToast = {
  /**
   * Success notification
   * @param {string} message - Main message (e.g., "Login successful!")
   * @param {string} description - Optional detailed message
  * @param {number} duration - Toast duration in ms (default: 2000)
   */
  success: (message, description = '', duration = 2000) => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          <FiCheckCircle className="toast-icon" size={20} />
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    return toast.success(content, {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Error notification
   * @param {string} message - Main message (e.g., "Login failed!")
   * @param {string} description - Optional detailed error message
  * @param {number} duration - Toast duration in ms (default: 2000)
   */
  error: (message, description = '', duration = 2000) => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          <FiAlertCircle className="toast-icon" size={20} />
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    return toast.error(content, {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Warning notification
   * @param {string} message - Main message (e.g., "Are you sure?")
   * @param {string} description - Optional detailed message
  * @param {number} duration - Toast duration in ms (default: 2000)
   */
  warning: (message, description = '', duration = 2000) => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          <FiAlertTriangle className="toast-icon" size={20} />
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    return toast.warning(content, {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Info notification
   * @param {string} message - Main message (e.g., "Loading...")
   * @param {string} description - Optional detailed message
  * @param {number} duration - Toast duration in ms (default: 2000)
   */
  info: (message, description = '', duration = 2000) => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          <FiInfo className="toast-icon" size={20} />
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    return toast.info(content, {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Custom notification with custom content
   * @param {React.ReactNode} content - Custom React component or JSX
   * @param {string} type - Type: 'success', 'error', 'warning', 'info' (default: 'info')
   * @param {number} duration - Toast duration in ms
   */
  custom: (content, type = 'info', duration = 2000) => {
    return toast[type](content, {
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Loading notification (non-closeable until updated)
   * @param {string} message - Loading message
   * @param {string} description - Optional description
   * @returns {string|number} - Toast ID for later updates
   */
  loading: (message, description = '') => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          <div className="toast-spinner" />
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    return toast.loading(content, {
      autoClose: false,
      closeOnClick: false,
      pauseOnHover: false,
      draggable: false,
    });
  },

  /**
   * Update an existing toast
   * @param {string|number} toastId - Toast ID returned from other methods
   * @param {Object} options - Update options (message, type, etc.)
   */
  update: (toastId, { message, type = 'info', description = '', duration = 2000 }) => {
    const content = (
      <div className="toast-content">
        <div className="toast-header">
          {type === 'success' && <FiCheckCircle className="toast-icon" size={20} />}
          {type === 'error' && <FiAlertCircle className="toast-icon" size={20} />}
          {type === 'warning' && <FiAlertTriangle className="toast-icon" size={20} />}
          {type === 'info' && <FiInfo className="toast-icon" size={20} />}
          <span className="toast-title">{message}</span>
        </div>
        {description && <div className="toast-description">{description}</div>}
      </div>
    );

    toast.update(toastId, {
      render: content,
      type: type,
      autoClose: duration,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: false,
      isLoading: false,
    });
  },

  /**
   * Dismiss a specific toast
   * @param {string|number} toastId - Toast ID to dismiss
   */
  dismiss: (toastId) => {
    if (toastId) {
      toast.dismiss(toastId);
    }
  },

  /**
   * Dismiss all toasts
   */
  dismissAll: () => {
    toast.dismiss();
  },
};

/**
 * Preset notifications for common scenarios
 */
export const toastPresets = {
  loginSuccess: () => showToast.success('Welcome back!', 'Login successful'),
  loginError: (message = 'Login failed') => showToast.error(message, 'Please check your credentials'),
  
  registerSuccess: () => showToast.success('Account created!', 'Please login with your credentials'),
  registerError: () => showToast.error('Registration failed', 'Please check your information'),
  
  logoutSuccess: () => showToast.info('Logged out', 'See you next time!'),
  
  postSuccess: () => showToast.success('Post created', 'Your post is now live'),
  postDeleted: () => showToast.success('Post deleted', 'The post has been removed'),
  postUpdated: () => showToast.success('Post updated', 'Your changes are saved'),
  
  chatSent: () => showToast.success('Message sent', 'Your message was delivered'),
  
  groupJoined: () => showToast.success('Group joined!', 'Welcome to the group'),
  groupLeft: () => showToast.info('Group left', 'You have left the group'),
  
  fileUploaded: () => showToast.success('Upload complete', 'Your file is ready'),
  fileUploadError: () => showToast.error('Upload failed', 'Please try again'),
  
  copied: () => showToast.success('Copied!', 'Text copied to clipboard'),
  
  saved: () => showToast.success('Saved', 'Changes saved successfully'),
  
  error: (message = 'Something went wrong') => showToast.error(message, 'Please try again'),
  
  offline: () => showToast.warning('Offline', 'Check your internet connection'),
  online: () => showToast.info('Online', 'Connection restored'),
};

export default showToast;
