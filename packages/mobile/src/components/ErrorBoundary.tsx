import React, { Component } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fontSize, fontWeight, borderRadius, spacing } from '../utils/theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Root error boundary that catches unhandled JavaScript errors
 * and shows a user-friendly recovery screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console for development; Sentry will capture this automatically
    // when configured via Sentry.wrap() in _layout.tsx.
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconWrapper}>
            <Text style={styles.iconText}>!</Text>
          </View>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>
            An unexpected error occurred. Please try again. If the problem
            persists, restart the app.
          </Text>
          {__DEV__ && this.state.error && (
            <View style={styles.debugBox}>
              <Text style={styles.debugText} numberOfLines={6}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
            onPress={this.handleReset}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface[900],
    paddingHorizontal: spacing['3xl'],
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.danger[500] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['2xl'],
  },
  iconText: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    color: colors.danger[400],
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.surface[400],
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
    maxWidth: 300,
  },
  debugBox: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface[800],
    borderWidth: 1,
    borderColor: colors.surface[700] + '80',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
  },
  debugText: {
    fontSize: fontSize.xs,
    color: colors.danger[400],
    fontFamily: 'monospace',
  },
  retryButton: {
    marginTop: spacing['2xl'],
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing['3xl'],
    paddingVertical: spacing.md,
  },
  retryButtonPressed: {
    backgroundColor: colors.primary[500],
  },
  retryButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
});
