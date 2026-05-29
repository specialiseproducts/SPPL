import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../../lib/observability/errorReporter';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  children: ReactNode;
  onReset?: () => void;
}

interface ModuleErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates module render failures so the app shell (navbar/sidebar) stays usable.
 */
export class ModuleErrorBoundary extends Component<ModuleErrorBoundaryProps, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      source: 'error_boundary',
      module: this.props.moduleName,
      componentStack: info.componentStack || undefined,
    });
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <Card className="border-destructive/25 p-8">
          <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-[#212529]">{this.props.moduleName} is temporarily unavailable</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Something went wrong while loading this module. You can switch to another module from the sidebar or try
              again.
            </p>
            {import.meta.env.DEV ? (
              <pre className="mt-4 max-h-40 w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs text-destructive">
                {this.state.error.message}
              </pre>
            ) : null}
            <Button type="button" className="mt-6" onClick={this.handleRetry}>
              Try again
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}
