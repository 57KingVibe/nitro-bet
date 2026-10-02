import express from 'express';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env.js';
import { initDb } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

import paymentsRouter from './routes/payments.js';
import oddsRouter from './routes/odds.js';
import streamRouter from './routes/stream.js';

const app = express();
const server = http.createServer(app);

// FRONTEND_URL may be "*" or a comma-separated allow-list.
const allowedOrigins = env.FRONTEND_URL === '*' ? '*' : env.FRONTEND_URL.split(',').map((s) => s.trim());

const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// Render sits behind a reverse proxy. Without this, every visitor shares the proxy's IP,
// so the rate limiter would count (and block) all users together.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(compression());
app.use(express.json());

app.use(
  pinoHttp({
    quietReqLogger: true,
    transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  })
);

// Polling endpoint with its own limiter: mounted BEFORE the global limiter on purpose.
app.use('/api/stream', streamRouter);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', globalLimiter);

app.use('/api/payments', paymentsRouter);
app.use('/api/odds', oddsRouter);

// Opening the bare URL used to return a plain 404; give it a useful answer.
app.get('/', (req, res) => {
  res.json({
    service: 'nitro-bet-api',
    status: 'ok',
    endpoints: ['/health', '/api/stream/unified', '/api/odds/live', 'POST /api/payments/cashback'],
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`[WS] Client disconnected: ${socket.id}`));
});

// Unknown API routes get JSON, not an HTML error page.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDb();
    server.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[CORE] Nitro-Bet Engine live on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    console.error('[CRITICAL] Boot failed:', err);
    process.exit(1);
  }
};

startServer();
