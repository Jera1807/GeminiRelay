import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import authRoutes from './routes/auth';
import conversationRoutes from './routes/conversations';
import { setupWebSocket } from './ws/handler';
import { getDb } from './db/schema';

const app = express();

getDb();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);

const server = http.createServer(app);

setupWebSocket(server);

server.listen(config.port, config.host, () => {
  console.log(`🚀 GeminiRelay server running on http://${config.host}:${config.port}`);
  console.log(`   WebSocket: ws://${config.host}:${config.port}/ws`);
  console.log(`   Gemini CLI: ${config.geminiPath}`);
});
