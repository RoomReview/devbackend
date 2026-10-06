import cors from 'cors';
import dotenv from 'dotenv';
import express, {
  type Application,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler, notFoundHandler } from '@middleware/error.middleware';
import { assignRequestId } from '@middleware/request-id.middleware.js';
import { getCustomMorganFormat } from '@middleware/request-logger.middleware';
import routes from './routes';
import { configurePassport } from '@utils/sso.login';
import logger from '@utils/logger';
import * as paymentController from './controllers/payment.controller';
import { startScoreReportWorker } from '@/services/score-report.service';
import { getRequestRateLimitKey, rateLimit } from '@middleware/rateLimit.middleware';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT ?? 5000;
const trustedProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 0);
if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
}
app.set('trust proxy', trustedProxyHops);
const isTestProcess = process.env.NODE_ENV === 'test'
  || process.env.NODE_TEST_CONTEXT !== undefined
  || process.argv.includes('--test');
if (!isTestProcess) void startScoreReportWorker();

// Middleware
app.use(assignRequestId());
app.use(helmet());
app.use(cors());
app.use(morgan(getCustomMorganFormat));
app.get('/api/v1/payments/webhook', paymentController.webhookStatus);
app.post('/api/v1/payments/webhook', express.raw({ type: 'application/json' }), paymentController.handleWebhook);
app.use(
  '/api/v1',
  rateLimit({
    name: 'api-global',
    limit: 300,
    windowMs: 60 * 1000,
    key: getRequestRateLimitKey,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Passport SSO (session-less — must come after body parsers)
configurePassport(app);

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route for basic backend readiness
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'RoomReview backend is running' });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (!isTestProcess) {
  app.listen(PORT, () => {
    logger.info(
      { service: 'HTTP', function: 'listen' },
      `Server running on port ${PORT}`,
    );
  });
}

export default app;
