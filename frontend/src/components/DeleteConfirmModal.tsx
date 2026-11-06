import React from 'react';
import { Trash2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

export interface DeleteConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  warning?: React.ReactNode;
  error?: string | null;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  warning,
  error,
  confirmLabel = 'Delete',
  onConfirm,
  isLoading = false,
  icon,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white dark:bg-slate-900 border border-border shadow-2xl rounded-2xl p-6 sm:p-7">
        <div className="space-y-4">
          {/* Header with Icon and Title */}
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 shadow-sm">
              {icon || <Trash2 className="h-5 w-5" />}
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="text-xs font-semibold px-4 h-9 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="text-xs font-bold px-4 h-9 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {confirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
