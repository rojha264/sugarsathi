import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

/** Crash reporting is on only when a DSN is configured (EXPO_PUBLIC_SENTRY_DSN); nothing is sent otherwise. */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // Health app: no IP, phone or name; users are known only by their internal id.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

type Root = ComponentType<Record<string, unknown>>;

/** Wraps the root layout so render crashes and touch breadcrumbs are reported. */
export const withCrashReporting = (Root: Root): Root => (dsn ? Sentry.wrap(Root) : Root);

export function setCrashUser(id: string | null) {
  if (dsn) Sentry.setUser(id ? { id } : null);
}
