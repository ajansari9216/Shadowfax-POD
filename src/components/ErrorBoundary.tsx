import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center font-mono">
          <div className="max-w-2xl w-full bg-red-950/30 p-6 rounded-lg border border-red-900">
            <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong.</h1>
            <pre className="text-red-400 whitespace-pre-wrap text-sm break-all">
              {this.state.error?.toString()}
            </pre>
            <pre className="text-red-300 whitespace-pre-wrap text-xs mt-4">
              {this.state.error?.stack}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
