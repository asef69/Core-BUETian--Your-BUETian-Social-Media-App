import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';

/**
 * Custom hook for handling API requests with error handling
 * Provides loading, error, and data states
 */
export const useAPI = (apiFunction, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    onSuccess = null,
    onError = null,
    showErrorToast = true,
    showSuccessToast = false,
  } = options;

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);

      try {
        const result = await apiFunction(...args);
        setData(result.data);
        
        if (showSuccessToast) {
          toast.success(result.data?.message || 'Success!');
        }

        if (onSuccess) {
          onSuccess(result.data);
        }

        return result.data;
      } catch (err) {
        const errorMessage = err.displayMessage || err.message || 'An error occurred';
        
        setError({
          message: errorMessage,
          details: err.validationErrors || err.response?.data,
          status: err.response?.status,
        });

        if (showErrorToast) {
          toast.error(errorMessage);
        }

        if (onError) {
          onError(err);
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction, onSuccess, onError, showErrorToast, showSuccessToast]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
};

/**
 * Custom hook for form submissions with API calls
 */
export const useAPIForm = (submitFunction, options = {}) => {
  const [formData, setFormData] = useState(options.initialData || {});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const { onSuccess = null, showToast = true } = options;

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  }, [errors]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);
      setErrors({});
      setSuccess(false);

      try {
        const result = await submitFunction(formData);
        
        if (showToast) {
          toast.success(result?.message || 'Submitted successfully!');
        }

        setSuccess(true);
        setFormData(options.initialData || {});

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (err) {
        const validationErrors = err.validationErrors || {};
        setErrors(validationErrors);

        const errorMessage = err.displayMessage || 'Failed to submit form';
        
        if (showToast) {
          toast.error(errorMessage);
        }

        throw err;
      } finally {
        setLoading(false);
      }
    },
    [formData, submitFunction, onSuccess, showToast, options]
  );

  const reset = useCallback(() => {
    setFormData(options.initialData || {});
    setErrors({});
    setSuccess(false);
  }, [options]);

  return {
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    loading,
    errors,
    success,
    reset,
  };
};

export default useAPI;
