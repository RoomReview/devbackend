import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT ?? 5000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  // Access token
  jwtSecret: process.env.JWT_SECRET ?? 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  // Refresh token
  jwtRefreshTokenSecret: process.env.JWT_REFRESH_SECRET ?? 'your-refresh-secret-key',
  jwtRefreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  // Standard JWT claims (iss / aud)
  jwtIssuer: process.env.JWT_ISSUER ?? 'roomreview-api',
  jwtAccessTokenAudience: process.env.JWT_ACCESS_TOKEN_AUDIENCE ?? 'roomreview-client',
  jwtRefreshTokenAudience: process.env.JWT_REFRESH_TOKEN_AUDIENCE ?? 'roomreview-auth',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  saltKeyLength: 16,
  passwordHashLength: 64,
} as const;

export default config;
