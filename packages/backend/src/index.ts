// Softway ContractGen V2 — Backend Entry Point

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AiError } from './services/ai.js';
import './db/client.js'; // initializes the DB on import
import { sessionMiddleware } from './auth/session.js';
import { authRouter } from './routes/auth.js';
import { contractsRouter } from './routes/contracts.js';
import { importDetectRouter } from './routes/importDetect.js';
import { aiRouter } from './routes/ai.js';
import { uploadRouter } from './routes/upload.js';
import { adminRouter } from './routes/admin.js';

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
  res.json({ ok: true, service: 'contractgen-v2' });
});

app.use('/auth', authRouter);
app.use('/contracts', contractsRouter);
app.use('/import/detect', importDetectRouter);
app.use('/ai', aiRouter);
app.use('/upload', uploadRouter);
app.use('/admin', adminRouter);

// Global error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request body',
      details: err.flatten(),
    });
  }
  if (err instanceof AiError) {
    return res.status(err.statusCode).json({ error: 'ai_error', message: err.message });
  }
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Unknown error';
  res.status(500).json({ error: 'internal_error', message });
});

app.listen(config.PORT, () => {
  console.log(`✔ ContractGen V2 listening on http://localhost:${config.PORT}`);
  console.log(`  CORS origin: ${config.WEB_ORIGIN}`);
  console.log(`  DB: ${config.DATABASE_URL}`);
});
