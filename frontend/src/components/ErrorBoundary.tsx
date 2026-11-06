import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-border shadow-xl rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {this.props.fallbackTitle || 'Something went wrong'}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                An unexpected error occurred while rendering this view.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="text-left bg-slate-50 dark:bg-slate-950/50 border border-border rounded-lg p-3 text-[11px] font-mono text-rose-600 dark:text-rose-400 max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => (window.location.href = '/dashboard')}
                className="text-xs font-semibold gap-1.5"
              >
                <Home className="w-3.5 h-3.5" /> Dashboard
              </Button>
              <Button
                size="sm"
                onClick={() => window.location.reload()}
                className="text-xs font-semibold gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
