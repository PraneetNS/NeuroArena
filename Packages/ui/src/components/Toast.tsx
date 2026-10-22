import React, { createContext, useContext, useState, useCallback } from 'react';
import { CloseIcon, CheckIcon, InfoIcon } from '../icons/index.js';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration: number = 3500) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, message, variant, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="na-toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`na-toast na-toast--${toast.variant || 'info'}`}
          >
            <div style={{ flexShrink: 0, marginTop: '2px' }}>
              {toast.variant === 'success' ? (
                <CheckIcon size={16} />
              ) : (
                <InfoIcon size={16} />
              )}
            </div>
            <div style={{ flex: 1 }}>{toast.message}</div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="na-button na-button--ghost na-button--sm na-button--icon-only"
              aria-label="Dismiss toast"
              style={{ width: '20px', height: '20px', padding: 0 }}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
