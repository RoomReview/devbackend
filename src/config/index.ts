import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT ?? 5000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'your-secret-key',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  jwtRefreshTokenSecret:
    process.env.JWT_REFRESH_SECRET ?? 'your-refresh-secret-key',
  jwtRefreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  jwtIssuer: process.env.JWT_ISSUER ?? 'roomreview-api',
  jwtAccessTokenAudience:
    process.env.JWT_ACCESS_TOKEN_AUDIENCE ?? 'roomreview-client',
  jwtRefreshTokenAudience:
    process.env.JWT_REFRESH_TOKEN_AUDIENCE ?? 'roomreview-auth',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  saltKeyLength: 16,
  passwordHashLength: 64,
  sendGridApiKey: process.env.SENDGRID_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? '',
  sendGridSandboxMode: process.env.SENDGRID_SANDBOX_MODE === 'false' ? false : true,
  sendGridDataResidence: 'eu',
  sendVerifyEmailCodeV1TemplateId: 'd-2495bae5bdb84fa1b2afc8c4dacb0e59',
  sendResetPasswordCodeV1TemplateId: 'd-56e1f0eb30c34b7fb20ca9e21bab30a1',
  sendGridTemplateParameters: {
    'd-2495bae5bdb84fa1b2afc8c4dacb0e59': {
      name: 'Customer',
      code: '######',
      contact_button_link: process.env.ROOMREVIEW_CONTACT_LINK ?? '/',
    },
    'd-56e1f0eb30c34b7fb20ca9e21bab30a1': {
      contact_button_link: process.env.ROOMREVIEW_CONTACT_LINK ?? '/',
      reset_pswd_button_link: process.env.ROOMREVIEW_RESET_PASSWORD_LINK ?? '/',
    }
  },
  enableGoogleSSO: process.env.ENABLE_GOOGLE_SSO === 'true' ? true : false,
  enableFacebookSSO: process.env.ENABLE_FACEBOOK_SSO === 'true' ? true : false,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:5000/api/v1/sso/google/callback',
  facebookAppId: process.env.FACEBOOK_APP_ID ?? '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET ?? '',
  facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL ?? 'http://localhost:5000/api/v1/sso/facebook/callback',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
} as const;

export default config;
