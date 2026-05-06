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

    // On Windows, npm-installed CLI commands are .cmd wrapper scripts and
    // therefore require shell:true to be executable by name. You can override
    // this with GEMINI_SHELL=false when pointing GEMINI_PATH at a native .exe.
    const useShell = config.geminiShell !== undefined
      ? config.geminiShell
      : process.platform === 'win32';

    const cwd = process.cwd();

    // Safe representation of args for logging (prompt is user-supplied and
    // potentially sensitive, so we only log its length).
    const safeArgs = ['-p', `[${this.prompt.length} chars]`, '-o', 'stream-json'];

    if (config.geminiDebug) {
      console.debug(
        `[GeminiRunner] spawn: path=${config.geminiPath}` +
        ` args=${JSON.stringify(safeArgs)}` +
        ` cwd=${cwd} platform=${process.platform} shell=${useShell}`,
      );
    }

    this.process = spawn(config.geminiPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell,
      cwd,
    });

    let buffer = '';
    let stats: RunStats | null = null;
    const stderrLines: string[] = [];

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
          const trimmed = line.trim();
          if (trimmed) {
            stderrLines.push(trimmed);
            if (config.geminiDebug) {
              console.warn(`[GeminiRunner] stderr: ${trimmed}`);
            }
            this.emit('logLine', trimmed);
          }
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
        const stderrSummary = stderrLines.length > 0
          ? stderrLines.map(l => `    ${l}`).join('\n')
          : '    (empty)';
        console.error(
          `[GeminiRunner] gemini exited with code ${code}\n` +
          `  path:     ${config.geminiPath}\n` +
          `  args:     ${JSON.stringify(safeArgs)}\n` +
          `  cwd:      ${cwd}\n` +
          `  platform: ${process.platform}\n` +
          `  shell:    ${useShell}\n` +
          `  stderr:\n${stderrSummary}`,
        );
        const stderrDetail = stderrLines.length > 0
          ? `: ${stderrLines.join(' | ')}`
          : '';
        this.emit('error', new Error(`gemini exited with code ${code}${stderrDetail}`));
        return;
      }
      this.emit('finished', stats);
    });

    this.process.on('error', (err) => {
      console.error(
        `[GeminiRunner] spawn error: ${err.message}` +
        ` (path: ${config.geminiPath}, platform: ${process.platform}, shell: ${useShell})`,
      );
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
      if (config.geminiDebug) {
        console.debug(`[GeminiRunner] non-JSON stdout: ${line}`);
      }
      this.emit('logLine', line);
    }
  }
}
