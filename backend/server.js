import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import helmet from 'helmet';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import aiRoutes from './routes/ai.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import { aiLimiter, authLimiter } from './middlewares/rateLimit.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { getAllowedOrigins, normalizeOrigin, validateEnvironment } from './config/env.js';

dotenv.config();
validateEnvironment();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/multi-ai';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch((error) => console.error('MongoDB connection error:', error));

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const frontPath = join(__dirname, '..', 'frontend');
const allowedOrigins = getAllowedOrigins();

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin || allowedOrigins.length === 0 || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
    return callback(new Error('CORS origin not allowed'));
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use((request, response, next) => {
  response.setHeader('X-Request-Time', new Date().toISOString());
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);
  }
  next();
});

app.get('/api/health', (request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/ready', (request, response) => {
  const databaseReady = mongoose.connection.readyState === 1;
  response.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ready' : 'not_ready',
    database: databaseReady ? 'connected' : 'disconnected'
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/workspace', workspaceRoutes);

app.use('/api', (request, response) => {
  response.status(404).json({
    success: false,
    message: 'API route not found'
  });
});

app.get(['/', '/index.html', '/mobile.html'], (request, response) => {
  response.sendFile(join(frontPath, 'index.html'));
});

app.use(
  express.static(frontPath, {
    setHeaders(response) {
      response.setHeader('Cache-Control', 'no-store');
    }
  })
);

app.get('*', (request, response) => {
  response.sendFile(join(frontPath, 'index.html'));
});

app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);
  server.close(async () => {
    await mongoose.connection.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
