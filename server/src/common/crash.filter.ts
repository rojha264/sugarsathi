import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/** Crash reporting is on only when SENTRY_DSN is set. Request bodies (health data) are never attached. */
export const crashReporting = !!process.env.SENTRY_DSN;

export function initCrashReporting() {
  if (!crashReporting) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? 'development', sendDefaultPii: false, tracesSampleRate: 0.1 });
}

/** Reports unexpected errors (5xx); expected ones like 400/401/403/404 are normal traffic. */
@Catch()
export class CrashFilter extends BaseExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const status = err instanceof HttpException ? err.getStatus() : 500;
    if (crashReporting && status >= 500) Sentry.captureException(err);
    super.catch(err, host);
  }
}
