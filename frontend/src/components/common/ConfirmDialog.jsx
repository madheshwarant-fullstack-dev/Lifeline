import React, { useEffect, useId, useRef } from 'react';
import { FaExclamationTriangle, FaInfoCircle } from 'react-icons/fa';

/**
 * Accessible native <dialog> confirmation modal following modern web standards:
 * - Uses native <dialog> + showModal() (no redundant role="dialog" or aria-modal)
 * - Focuses the safe Cancel button by default to guard destructive actions
 * - Resets dialog.returnValue on open/close and locks background scroll via CSS
 */
const ConfirmDialog = ({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.returnValue = '';
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close('');
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      const value = dialog.returnValue;
      dialog.returnValue = '';
      if (value === 'confirm') {
        onConfirm?.();
        return;
      }
    }
    onCancel?.();
  };

  const handleCancel = (e) => {
    e.preventDefault();
    if (!loading) {
      dialogRef.current?.close('cancel');
    }
  };

  const handleBackdropClick = (e) => {
    if (loading) return;
    if (e.target === dialogRef.current) {
      dialogRef.current?.close('cancel');
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="lifeline-confirm-dialog shadow-lg border-0 rounded-4 p-0"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClose}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <form
        method="dialog"
        className="p-4 bg-white rounded-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) {
            dialogRef.current?.close('confirm');
          }
        }}
      >
        <div className="d-flex align-items-start gap-3 mb-3">
          <div
            className={`rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0 ${
              variant === 'danger' ? 'bg-danger-subtle text-danger' : 'bg-info-subtle text-info'
            }`}
            style={{ width: 42, height: 42 }}
          >
            {variant === 'danger' ? <FaExclamationTriangle size={18} /> : <FaInfoCircle size={18} />}
          </div>
          <div>
            <h5 id={titleId} className="fw-bold mb-1">
              {title}
            </h5>
            <p id={descId} className="text-muted small mb-0">
              {message}
            </p>
          </div>
        </div>

        <div className="d-flex justify-content-end gap-2 mt-4">
          <button
            type="button"
            className="btn btn-light border rounded-pill px-3"
            autoFocus
            disabled={loading}
            onClick={() => dialogRef.current?.close('cancel')}
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={`btn ${variant === 'danger' ? 'btn-blood' : 'btn-primary'} rounded-pill px-4`}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
};

export default ConfirmDialog;

