import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw } from 'lucide-react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
  resetKey: number;
}

/**
 * Catches render/lifecycle errors in the wrapped subtree so a single bad
 * screen shows a recoverable error instead of taking down the whole app
 * (RN has no default error boundary — an uncaught exception during render
 * crashes the entire native app, not just the current screen).
 */
export class ScreenErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, componentStack: null, resetKey: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[ScreenErrorBoundary] caught error:', error, info.componentStack);
    }
    this.setState({ componentStack: info.componentStack?.slice(0, 400) ?? null });
  }

  private handleRetry = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <SafeAreaView style={styles.container}>
          <Text style={styles.title}>Что-то пошло не так</Text>
          <Text style={styles.message}>
            Не удалось отобразить экран. Попробуйте ещё раз.
          </Text>
          {/* Shown in every build (not just __DEV__) so a real device repro
              is self-diagnosing via a screenshot, without needing adb/Sentry. */}
          <Text style={styles.debugText} selectable>
            {this.state.error.message || String(this.state.error)}
          </Text>
          {this.state.error.stack && (
            <Text style={styles.debugStack} selectable>
              {this.state.error.stack.slice(0, 600)}
            </Text>
          )}
          {this.state.componentStack && (
            <Text style={styles.debugStack} selectable>
              {this.state.componentStack}
            </Text>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={this.handleRetry}
            style={styles.retryButton}>
            <RefreshCw size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.retryText}>Повторить</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

/**
 * Wraps a screen component so it gets its own error boundary — used at
 * navigator registration so one broken screen can't take the whole app down,
 * without having to edit every individual screen file.
 */
export function withScreenErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const Wrapped: React.FC<P> = (props) => (
    <ScreenErrorBoundary>
      <Component {...props} />
    </ScreenErrorBoundary>
  );
  Wrapped.displayName = `withScreenErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#F8FAFC',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  message: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  debugText: {
    marginTop: 16,
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
  },
  debugStack: {
    marginTop: 8,
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0EA5E9',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
