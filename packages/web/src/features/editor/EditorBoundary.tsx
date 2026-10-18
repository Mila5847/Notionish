import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReset: () => void;
}
interface State {
  hasError: boolean;
  retries: number;
}

const MAX_AUTO_RETRIES = 5;

export class EditorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retries: 0 };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch() {
    if (this.state.retries < MAX_AUTO_RETRIES) {
      this.resetTimer = setTimeout(() => {
        this.setState((s) => ({ hasError: false, retries: s.retries + 1 }));
        this.props.onReset();
      }, 0);
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.children !== this.props.children && this.state.retries > 0) {
      this.setState({ retries: 0 });
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  render() {
    if (this.state.hasError && this.state.retries >= MAX_AUTO_RETRIES) {
      return (
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm">
          <p className="mb-2 font-medium">Editor keeps hitting an error.</p>
          <p className="mb-3 text-muted-foreground">
            Your saved content is safe. Try switching to another page and back, or hard-refresh the page (Cmd+Shift+R).
          </p>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
            onClick={() => {
              this.setState({ hasError: false, retries: 0 });
              this.props.onReset();
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
