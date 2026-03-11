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

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT ?? 5000;

// Middleware
app.use(assignRequestId());
app.use(helmet());
app.use(cors());
app.use(morgan(getCustomMorganFormat));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
