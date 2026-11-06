import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

export type ActionModalVariant = 'primary' | 'success' | 'destructive' | 'warning' | 'info';

export interface ActionConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  variant?: ActionModalVariant;
  icon?: React.ReactNode;
  details?: React.ReactNode;
  warning?: React.ReactNode;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  onConfirm?: () => void | Promise<void>;
  isLoading?: boolean;
}

export const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  variant = 'primary',
  icon,
  details,
  warning,
  error,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  hideCancel = false,
  onConfirm,
  isLoading = false,
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5" />;
      case 'destructive':
        return <AlertTriangle className="h-5 w-5" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5" />;
      case 'info':
        return <Info className="h-5 w-5" />;
      case 'primary':
      default:
        return <HelpCircle className="h-5 w-5" />;
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return {
          iconBadge:
            'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400',
          confirmBtn:
            'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20',
        };
      case 'destructive':
        return {
          iconBadge:
            'bg-red-50 dark:bg-red-950/40 border-red-200/60 dark:border-red-900/50 text-red-600 dark:text-red-400',
          confirmBtn:
            'bg-red-600 hover:bg-red-700 text-white shadow-red-500/20',
        };
      case 'warning':
        return {
          iconBadge:
            'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-900/50 text-amber-600 dark:text-amber-400',
          confirmBtn:
            'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20',
        };
      case 'info':
        return {
          iconBadge:
            'bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900/50 text-blue-600 dark:text-blue-400',
          confirmBtn:
            'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20',
        };
      case 'primary':
      default:
        return {
          iconBadge:
            'bg-primary/10 border-primary/20 text-primary',
          confirmBtn:
            'bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20',
        };
    }
  };

  const styles = getVariantStyles();

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-6 sm:p-7">
        <div className="space-y-4">
          {/* Header with Icon and Title */}
          <div className="flex items-start gap-4">
            <div
              className={`h-11 w-11 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${styles.iconBadge}`}
            >
              {icon || getDefaultIcon()}
            </div>
            <div className="space-y-1 flex-1">
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </DialogDescription>
            </div>
          </div>

          {/* Optional Details or Children content */}
          {details && (
            <div className="rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/30 p-3 text-xs text-slate-700 dark:text-slate-300">
              {details}
            </div>
          )}

          {/* Optional Error Alert */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Optional Warning / Impact Box */}
          {warning && (
            <div className="bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 rounded-xl p-3 text-xs leading-relaxed flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1 font-medium">{warning}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="pt-4 flex items-center justify-end gap-2.5 sm:gap-2">
          {!hideCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="text-xs font-semibold px-4 h-9 rounded-xl"
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`text-xs font-bold px-4 h-9 rounded-xl shadow-sm flex items-center gap-1.5 ${styles.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
