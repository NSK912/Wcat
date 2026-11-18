import { ErrorInfo, ReactNode, Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
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
    console.error('Corrupted file / media decoding crash prevented by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 select-none">
          <div className="max-w-md w-full bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold mb-2">Damaged Video File Handled</h2>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              The video file is severely corrupted (e.g. broken headers from power failure). The application has successfully intercepted the crash so your browser stays running. You can reload or select a valid file to continue.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  (this as any).setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reset & Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
