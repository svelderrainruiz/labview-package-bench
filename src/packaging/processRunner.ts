import { spawn } from 'node:child_process';

import type { CommandInvocation } from './vipmCliBuild';

export interface ProcessRunOptions {
  cwd?: string;
  onOutput: (chunk: string) => void;
  /** Aborts the run: the child process is killed and the promise resolves. The
   * caller inspects its own signal to distinguish cancellation from failure. */
  signal?: AbortSignal;
}

/**
 * Executes a command invocation, streaming combined stdout/stderr to
 * `onOutput` and resolving with the process exit code. Injected into the build
 * command so unit tests can substitute a deterministic fake.
 */
export interface ProcessRunner {
  run(invocation: CommandInvocation, options: ProcessRunOptions): Promise<number>;
}

export const nodeProcessRunner: ProcessRunner = {
  run(invocation, options) {
    return new Promise<number>((resolve, reject) => {
      const { signal } = options;
      if (signal?.aborted) {
        resolve(0);
        return;
      }

      const child = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        shell: false
      });

      const onAbort = () => child.kill();
      signal?.addEventListener('abort', onAbort, { once: true });
      const cleanup = () => signal?.removeEventListener('abort', onAbort);

      child.stdout.on('data', (data: Buffer) => options.onOutput(data.toString()));
      child.stderr.on('data', (data: Buffer) => options.onOutput(data.toString()));
      child.on('error', (error) => {
        cleanup();
        reject(error);
      });
      child.on('close', (code) => {
        cleanup();
        resolve(code ?? 0);
      });
    });
  }
};
