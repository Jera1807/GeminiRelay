/**
 * Unit tests for GeminiRunner.
 *
 * Uses Node.js built-in test runner (node:test) – no extra dependencies needed.
 * Run with: npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

// ---------------------------------------------------------------------------
// Minimal mock for child_process.spawn
// ---------------------------------------------------------------------------
interface MockProcess extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  pid: number;
}

function makeMockProcess(): MockProcess {
  const proc = new EventEmitter() as MockProcess;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 99999;
  return proc;
}

// ---------------------------------------------------------------------------
// We patch child_process.spawn before importing the runner so the runner
// picks up our mock.  Using require() because the module system is CJS.
// ---------------------------------------------------------------------------
let mockProcess: MockProcess | null = null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cp = require('node:child_process') as typeof import('child_process');
const originalSpawn = cp.spawn;

// Helper: start a runner and return the mock process
function startRunner(prompt = 'hello'): { runner: InstanceType<typeof GeminiRunner>; proc: MockProcess } {
  // @ts-expect-error – patching for test purposes
  cp.spawn = (..._args: unknown[]) => {
    mockProcess = makeMockProcess();
    return mockProcess;
  };

  const runner = new GeminiRunner(prompt);
  runner.start();
  const proc = mockProcess!;

  // @ts-expect-error – restore
  cp.spawn = originalSpawn;
  return { runner, proc };
}

// Import runner AFTER defining the helper so the module cache works correctly
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GeminiRunner } = require('../src/gemini/runner') as typeof import('../src/gemini/runner');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('emits error with stderr details when gemini exits with non-zero code', (_t, done) => {
  const { runner, proc } = startRunner('hello world');

  runner.on('error', (err: Error) => {
    assert.ok(
      err.message.includes('gemini exited with code 1'),
      `Expected exit-code in message, got: ${err.message}`,
    );
    assert.ok(
      err.message.includes('trust check failed'),
      `Expected stderr detail in message, got: ${err.message}`,
    );
    done();
  });

  // Simulate stderr output followed by process exit
  proc.stderr.emit('data', Buffer.from('trust check failed\n'));
  proc.emit('close', 1);
});

test('emits finished (not error) when gemini exits with code 0', (_t, done) => {
  const { runner, proc } = startRunner('hello');

  runner.on('error', (err: Error) => {
    done(new Error(`Should not have emitted error: ${err.message}`));
  });

  runner.on('finished', () => {
    done();
  });

  proc.emit('close', 0);
});

test('emits error when spawn itself fails (e.g. binary not found)', (_t, done) => {
  const { runner, proc } = startRunner('hello');

  runner.on('error', (err: Error) => {
    assert.ok(err.message.includes('ENOENT'), `Expected ENOENT, got: ${err.message}`);
    done();
  });

  proc.emit('error', Object.assign(new Error('ENOENT: spawn gemini ENOENT'), { code: 'ENOENT' }));
});

test('emits logLine for each stderr line received', (_t, done) => {
  const { runner, proc } = startRunner('hello');
  const lines: string[] = [];

  runner.on('logLine', (line: string) => {
    lines.push(line);
    if (lines.length === 2) {
      assert.deepEqual(lines, ['line one', 'line two']);
      done();
    }
  });

  proc.stderr.emit('data', Buffer.from('line one\nline two\n'));
  proc.emit('close', 0);
});

test('emits logLine for non-JSON stdout content', (_t, done) => {
  const { runner, proc } = startRunner('hello');

  runner.on('logLine', (line: string) => {
    assert.equal(line, 'Ripgrep is not available. Falling back to GrepTool.');
    done();
  });

  // Non-JSON line followed by newline so the runner flushes its line buffer
  proc.stdout.emit('data', Buffer.from('Ripgrep is not available. Falling back to GrepTool.\n'));
  proc.emit('close', 0);
});
