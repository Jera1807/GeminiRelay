import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: process.env.HOST ?? '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  geminiPath: process.env.GEMINI_PATH ?? 'gemini',
  dbPath: process.env.DB_PATH ?? path.join(os.homedir(), '.gemini-relay', 'data.db'),
  contextMessages: parseInt(process.env.CONTEXT_MESSAGES ?? '20', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
};
