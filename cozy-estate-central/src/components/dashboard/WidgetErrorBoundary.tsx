import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error("[WidgetError]", this.props.title ?? "", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Card className="h-full">
          <CardContent className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {this.props.title ? `Widget "${this.props.title}"` : "Widget"} konnte nicht geladen werden.
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
