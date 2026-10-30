import * as Sentry from '@sentry/react';
import { Button, Result } from 'antd';
import { Component, type ReactNode } from 'react';

/** Shows a message with a reload button instead of a blank page when a screen crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error); // no-op unless Sentry was initialised
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Result
        status="warning"
        title="This page could not open"
        subTitle={this.state.error.message}
        extra={<Button type="primary" onClick={() => location.reload()}>Reload</Button>}
      />
    );
  }
}
