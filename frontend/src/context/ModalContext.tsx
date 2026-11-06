import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { ActionConfirmModal, type ActionModalVariant } from '@/components/ActionConfirmModal';

export interface ModalOptions {
  title: string;
  description: React.ReactNode;
  variant?: ActionModalVariant;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  warning?: React.ReactNode;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface ModalContextType {
  confirm: (options: ModalOptions) => Promise<boolean>;
  alert: (options: ModalOptions | string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalOptions & { hideCancel?: boolean }>({
    title: '',
    description: '',
  });

  const resolverRef = useRef<((value: any) => void) | null>(null);

  const confirm = useCallback((options: ModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalConfig({
        ...options,
        hideCancel: false,
        confirmLabel: options.confirmLabel || 'Confirm',
        cancelLabel: options.cancelLabel || 'Cancel',
      });
      setIsOpen(true);
    });
  }, []);

  const alert = useCallback((options: ModalOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      if (typeof options === 'string') {
        setModalConfig({
          title: 'Notification',
          description: options,
          variant: 'info',
          confirmLabel: 'OK',
          hideCancel: true,
        });
      } else {
        setModalConfig({
          ...options,
          hideCancel: true,
          confirmLabel: options.confirmLabel || 'OK',
        });
      }
      setIsOpen(true);
    });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open && resolverRef.current) {
      // If closed by backdrop or cancel, resolve false
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const handleConfirmAction = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}
      <ActionConfirmModal
        open={isOpen}
        onOpenChange={handleOpenChange}
        title={modalConfig.title}
        description={modalConfig.description}
        variant={modalConfig.variant}
        icon={modalConfig.icon}
        details={modalConfig.details}
        warning={modalConfig.warning}
        error={modalConfig.error}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
        hideCancel={modalConfig.hideCancel}
        onConfirm={handleConfirmAction}
      />
    </ModalContext.Provider>
  );
};

export const useCoreModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useCoreModal must be used within a ModalProvider');
  }
  return context;
};
