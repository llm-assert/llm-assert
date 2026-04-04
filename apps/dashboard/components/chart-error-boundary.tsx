"use client";

import { Component, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  title?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(
      "[chart] render_error title=%s message=%s",
      this.props.title ?? "Chart",
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {this.props.title ?? "Chart"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="size-5 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Failed to load chart data
            </p>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
