import { spawn } from 'node:child_process';

import type { CommandInvocation } from './vipmCliBuild';

export interface ProcessRunOptions {
  cwd?: string;
  onOutput: (chunk: string) => void;
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
      const child = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        shell: false
      });

      child.stdout.on('data', (data: Buffer) => options.onOutput(data.toString()));
      child.stderr.on('data', (data: Buffer) => options.onOutput(data.toString()));
      child.on('error', (error) => reject(error));
      child.on('close', (code) => resolve(code ?? 0));
    });
  }
};
