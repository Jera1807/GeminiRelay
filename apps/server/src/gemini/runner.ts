import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { config } from '../config';
import type { GeminiStreamEvent, RunStats } from '@gemini-relay/shared';

export interface RunnerEvents {
  event: (e: GeminiStreamEvent) => void;
  logLine: (line: string) => void;
  finished: (stats: RunStats | null) => void;
  error: (err: Error) => void;
}

export class GeminiRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private cancelled = false;

  constructor(private readonly prompt: string) {
    super();
  }

  start(): void {
    const args = ['-p', this.prompt, '-o', 'stream-json'];
    this.process = spawn(config.geminiPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let buffer = '';
    let stats: RunStats | null = null;

    this.process.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        this.handleLine(line.trim(), (s) => { stats = s; });
      }
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text) {
        for (const line of text.split('\n')) {
          if (line.trim()) this.emit('logLine', line.trim());
        }
      }
    });

    this.process.on('close', (code) => {
      if (buffer.trim()) {
        this.handleLine(buffer.trim(), (s) => { stats = s; });
      }
      if (this.cancelled) {
        this.emit('finished', stats);
        return;
      }
      if (code !== 0 && code !== null) {
        this.emit('error', new Error(`gemini exited with code ${code}`));
        return;
      }
      this.emit('finished', stats);
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
    });
  }

  cancel(): void {
    if (this.process && !this.cancelled) {
      this.cancelled = true;
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(this.process.pid), '/f', '/t']);
      } else {
        this.process.kill('SIGTERM');
      }
    }
  }

  private handleLine(line: string, onStats: (s: RunStats) => void): void {
    if (!line) return;
    try {
      const parsed = JSON.parse(line) as GeminiStreamEvent;
      if (parsed.type === 'result' && parsed.stats) {
        onStats(parsed.stats as RunStats);
      }
      this.emit('event', parsed);
    } catch {
      this.emit('logLine', line);
    }
  }
}
