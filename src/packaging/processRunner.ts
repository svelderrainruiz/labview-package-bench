import { spawn } from 'node:child_process';

import type { CommandInvocation } from './vipmCliBuild';

export interface ProcessRunOptions {
  cwd?: string;
  onOutput: (chunk: string) => void;
  /** Aborts the run: the child process is killed and the promise resolves. The
   * caller inspects its own signal to distinguish cancellation from failure. */
  signal?: AbortSignal;
  /** Extra environment variables merged over the inherited process env. */
  env?: Record<string, string>;
}

/**
 * Executes a command invocation, streaming combined stdout/stderr to
 * `onOutput` and resolving with the process exit code. Injected into the build
 * command so unit tests can substitute a deterministic fake.
 */
export interface ProcessRunner {
  run(invocation: CommandInvocation, options: ProcessRunOptions): Promise<number>;
}

/**
 * A Docker `run` needs its container named so cancellation can stop the
 * container itself: on Windows, killing the `docker` client process does not
 * stop the container (it is owned by the daemon, not a child of the client), so
 * the named container is `docker kill`ed on abort. Returns `undefined` for
 * non-Docker runs, where killing the child process is sufficient.
 */
export function dockerRunContainerName(invocation: CommandInvocation): string | undefined {
  if (invocation.command !== 'docker' || invocation.args[0] !== 'run') {
    return undefined;
  }
  const nameIndex = invocation.args.indexOf('--name');
  if (nameIndex >= 0 && nameIndex + 1 < invocation.args.length) {
    return invocation.args[nameIndex + 1];
  }
  return `lvpb-build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Inserts `--name <name>` after `run` unless the args already name the container. */
export function withDockerContainerName(args: string[], name: string): string[] {
  if (args.includes('--name')) {
    return args;
  }
  return [args[0], '--name', name, ...args.slice(1)];
}

export const nodeProcessRunner: ProcessRunner = {
  run(invocation, options) {
    return new Promise<number>((resolve, reject) => {
      const { signal } = options;
      if (signal?.aborted) {
        resolve(0);
        return;
      }

      const container = dockerRunContainerName(invocation);
      const args = container
        ? withDockerContainerName(invocation.args, container)
        : invocation.args;

      const child = spawn(invocation.command, args, {
        cwd: options.cwd,
        shell: false,
        env: options.env ? { ...process.env, ...options.env } : undefined
      });

      const onAbort = () => {
        // Killing the docker client does not stop the container, so stop it
        // explicitly (best-effort); the run's `--rm` then removes it.
        if (container) {
          spawn('docker', ['kill', container], { shell: false }).on('error', () => undefined);
        }
        child.kill();
      };
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
