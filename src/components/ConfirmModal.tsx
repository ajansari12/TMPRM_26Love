import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

const variantStyles = {
  danger: {
    icon: <Trash2 className="h-5 w-5 text-red-600" />,
    iconBg: 'bg-red-50',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
    iconBg: 'bg-amber-50',
    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  primary: {
    icon: <AlertTriangle className="h-5 w-5 text-slate-600" />,
    iconBg: 'bg-slate-100',
    button: 'bg-slate-900 hover:bg-slate-800 focus:ring-slate-500',
  },
};

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm w-full mx-4 p-6">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`shrink-0 w-10 h-10 rounded-xl ${styles.iconBg} flex items-center justify-center`}
          >
            {styles.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-modal-title"
              className="text-base font-semibold text-slate-900 mb-1"
            >
              {title}
            </h3>
            <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 inline-flex items-center gap-2 ${styles.button}`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
