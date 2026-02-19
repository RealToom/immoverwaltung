import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full p-8 text-center">
            <h1 className="text-2xl font-bold text-destructive mb-4">
              Ein unerwarteter Fehler ist aufgetreten
            </h1>
            <p className="text-muted-foreground mb-6">
              Bitte laden Sie die Seite neu. Wenn das Problem weiterhin besteht,
              kontaktieren Sie den Support.
            </p>
            {this.state.error && (
              <p className="text-xs text-muted-foreground font-mono bg-muted p-3 rounded mb-6 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
