import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FaExclamationTriangle } from 'react-icons/fa';
import '../styles/ConfirmDialog.css';

function ConfirmDialogCard({
  title,
  message,
  confirmText,
  confirmLoadingText,
  cancelText,
  danger,
  onConfirmAction,
  onConfirm,
  onCancel,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCancel = () => {
    if (isSubmitting) return;
    onCancel();
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    if (!onConfirmAction) {
      onConfirm();
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmAction();
      onConfirm();
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        handleCancel();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('confirm-dialog-open');

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('confirm-dialog-open');
    };
  }, [handleCancel, isSubmitting]);

  return (
    <div className="confirm-dialog-overlay" role="presentation" onClick={handleCancel}>
      <div
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-dialog-header">
          <span className={`confirm-dialog-icon ${danger ? 'danger' : ''}`}>
            <FaExclamationTriangle />
          </span>
          <h3 id="confirm-dialog-title">{title}</h3>
        </div>

        <p className="confirm-dialog-message">{message}</p>

        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn secondary" onClick={handleCancel} disabled={isSubmitting}>
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn ${danger ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? confirmLoadingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function confirmDialog({
  title = 'Please Confirm',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  confirmLoadingText = 'Working...',
  cancelText = 'Cancel',
  danger = false,
  onConfirmAction,
} = {}) {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    const cleanup = (value) => {
      root.unmount();
      host.remove();
      resolve(value);
    };

    root.render(
      <ConfirmDialogCard
        title={title}
        message={message}
        confirmText={confirmText}
        confirmLoadingText={confirmLoadingText}
        cancelText={cancelText}
        danger={danger}
        onConfirmAction={onConfirmAction}
        onCancel={() => cleanup(false)}
        onConfirm={() => cleanup(true)}
      />
    );
  });
}
