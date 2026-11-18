import React, { useEffect, useRef } from 'react';
import { CloseIcon } from '../icons/index.js';
import { Button } from './Button.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = ''
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    // Focus first focusable element inside modal
    const originalFocus = document.activeElement as HTMLElement | null;
    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      originalFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="na-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`na-modal ${className}`}
      >
        <div className="na-panel__header">
          <div>
            {title && <h3 className="na-panel__title">{title}</h3>}
            {subtitle && <div className="na-panel__subtitle">{subtitle}</div>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={<CloseIcon size={16} />}
            onClick={onClose}
            aria-label="Close modal"
          />
        </div>

        <div className="na-panel__body" style={{ overflowY: 'auto' }}>
          {children}
        </div>

        {footer && <div className="na-panel__footer">{footer}</div>}
      </div>
    </div>
  );
};
