export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? '',
  sessionCookieName:
    process.env.SESSION_COOKIE_NAME ??
    (process.env.NODE_ENV === 'production' ? '__Host-session' : 'session'),
  sessionSecure:
    process.env.SESSION_SECURE === undefined
      ? process.env.NODE_ENV === 'production'
      : process.env.SESSION_SECURE === 'true',
  sessionSameSite: process.env.SESSION_SAME_SITE ?? 'lax',
  sessionIdleTimeoutSeconds: Number(
    process.env.SESSION_IDLE_TIMEOUT_SECONDS ?? 86400,
  ),
  sessionAbsoluteTimeoutSeconds: Number(
    process.env.SESSION_ABSOLUTE_TIMEOUT_SECONDS ?? 604800,
  ),
  sessionActivityRefreshSeconds: Number(
    process.env.SESSION_ACTIVITY_REFRESH_SECONDS ?? 3600,
  ),
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
});
