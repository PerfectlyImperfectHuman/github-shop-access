import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Bahi Error]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
          <svg
            viewBox="0 0 24 24"
            className="w-8 h-8 text-destructive"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">
          Kuch Masla Aaya
        </h1>
        <p className="text-sm text-muted-foreground mb-1">
          Something went wrong
        </p>
        <p className="text-xs text-muted-foreground/60 font-mono mb-6 max-w-xs break-all">
          {error.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition"
        >
          App Restart Karein 🔄
        </button>
        <p className="text-xs text-muted-foreground mt-4">
          Agar yeh bar bar ho toh Settings → Export Backup kar lein
        </p>
      </div>
    );
  }
}
