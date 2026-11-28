import { Component, type ErrorInfo, type ReactNode } from 'react';
import { btnPrimary, btnSecondary } from './ui';

interface Props {
  children: ReactNode;
  /** Goes to the first portal page (Dashboard, or Home for tradesmen). */
  onHome: () => void;
}

/**
 * One portal page crashing must not blank the whole portal. The shell keys
 * this by page id, so moving to another page starts with a clean boundary.
 */
export default class PageErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[portal] a page failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="border-brick bg-paper border-l-4 px-4 py-4 font-sans">
        <p className="text-brick font-semibold">Something went wrong on this page.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={btnPrimary} onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              this.setState({ failed: false });
              this.props.onHome();
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }
}
