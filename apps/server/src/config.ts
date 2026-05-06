import dotenv from 'dotenv';
import path from 'path';
import os from 'os';

dotenv.config();

function parseGeminiShell(): boolean | undefined {
  const val = process.env.GEMINI_SHELL;
  if (val === undefined) return undefined; // auto-detect based on platform
  return val !== 'false' && val !== '0';
}

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  host: process.env.HOST ?? '127.0.0.1',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me-in-production',
  geminiPath: process.env.GEMINI_PATH ?? 'gemini',
  dbPath: process.env.DB_PATH ?? path.join(os.homedir(), '.gemini-relay', 'data.db'),
  contextMessages: parseInt(process.env.CONTEXT_MESSAGES ?? '20', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  /**
   * Whether to spawn Gemini via a shell. `undefined` = auto-detect (true on
   * Windows, false elsewhere). Set GEMINI_SHELL=false to disable the shell
   * when using a native binary on Windows (e.g. full .exe path via GEMINI_PATH).
   */
  geminiShell: parseGeminiShell(),
  /**
   * Enable verbose debug logging for the Gemini subprocess (spawn args,
   * stderr lines, non-JSON stdout). Set GEMINI_DEBUG=1 to enable.
   */
  geminiDebug: process.env.GEMINI_DEBUG === '1' || process.env.GEMINI_DEBUG === 'true',
};
