import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import './db/client.js'; // initializes the DB on import
import { sessionMiddleware } from './auth/session.js';
import { authRouter } from './routes/auth.js';
import { templatesRouter } from './routes/templates.js';
import { contractsRouter } from './routes/contracts.js';
import { aiRouter } from './routes/ai.js';
import { hubspotRouter } from './routes/hubspot.js';
import { driveImportRouter } from './routes/driveImport.js';
import { importDetectRouter } from './routes/importDetect.js';

const app = express();

app.use(
  cors({
    origin: config.WEB_ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(sessionMiddleware);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'contract-generator-backend' });
});

app.use('/auth', authRouter);
app.use('/templates', templatesRouter);
app.use('/contracts', contractsRouter);
app.use('/ai', aiRouter);
app.use('/hubspot', hubspotRouter);
app.use('/drive-import', driveImportRouter);
app.use('/import/detect', importDetectRouter);

// Global error handler. Keeps Zod errors readable; masks the rest.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request body',
      details: err.flatten(),
    });
  }
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({ error: 'internal_error', message });
});

app.listen(config.PORT, () => {
  console.log(`✔ backend listening on http://localhost:${config.PORT}`);
  console.log(`  CORS origin: ${config.WEB_ORIGIN}`);
  console.log(`  DB: ${config.DATABASE_URL}`);
});
