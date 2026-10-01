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

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(compression());
app.use(express.json());

app.use(
  pinoHttp({
    quietReqLogger: true,
    transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', globalLimiter);

app.use('/api/payments', paymentsRouter);
app.use('/api/odds', oddsRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await initDb();
    server.listen(env.PORT, () => {
      console.log(`[CORE] Nitro-Bet Engine live on port ${env.PORT} [${env.NODE_ENV}]`);
    });
  } catch (err) {
    console.error('[CRITICAL] Boot failed:', err);
    process.exit(1);
  }
};

startServer();

