import { describe, expect, it } from 'vitest';

import {
  dockerRunContainerName,
  nodeProcessRunner,
  withDockerContainerName
} from '../../src/packaging/processRunner';

// Exercises the real spawn boundary with short-lived Node subprocesses (the one
// place the extension shells out), including the cancellation path.
describe('nodeProcessRunner', () => {
  it('runs a command and streams its combined stdout/stderr', async () => {
    let out = '';
    const code = await nodeProcessRunner.run(
      {
        command: process.execPath,
        args: ['-e', 'process.stdout.write("hello"); process.stderr.write("!")']
      },
      { onOutput: (chunk) => (out += chunk) }
    );
    expect(code).toBe(0);
    expect(out).toContain('hello');
    expect(out).toContain('!');
  });

  it('resolves with a failing command exit code', async () => {
    const code = await nodeProcessRunner.run(
      { command: process.execPath, args: ['-e', 'process.exit(3)'] },
      { onOutput: () => undefined }
    );
    expect(code).toBe(3);
  });

  it('kills the child process when the signal aborts', async () => {
    const controller = new AbortController();
    const promise = nodeProcessRunner.run(
      { command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] },
      { onOutput: () => undefined, signal: controller.signal }
    );
    controller.abort();
    // Must resolve (not hang) once the killed child closes.
    await expect(promise).resolves.toEqual(expect.any(Number));
  });

  it('does not spawn when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    let output = '';
    const code = await nodeProcessRunner.run(
      { command: process.execPath, args: ['-e', 'process.stdout.write("should-not-run")'] },
      { onOutput: (chunk) => (output += chunk), signal: controller.signal }
    );
    expect(code).toBe(0);
    expect(output).toBe('');
  });
});

// Cancelling a Docker build must stop the container, not just the docker client
// process (which does not stop the daemon-owned container on Windows).
describe('docker cancellation naming', () => {
  it('generates a container name for a docker run', () => {
    const name = dockerRunContainerName({ command: 'docker', args: ['run', '--rm', 'img', 'cmd'] });
    expect(name).toMatch(/^lvpb-build-/);
  });

  it('reuses an explicit --name', () => {
    expect(
      dockerRunContainerName({ command: 'docker', args: ['run', '--name', 'mine', '--rm', 'img'] })
    ).toBe('mine');
  });

  it('returns undefined for non-docker or non-run invocations', () => {
    expect(dockerRunContainerName({ command: 'vipm', args: ['build', 'x'] })).toBeUndefined();
    expect(dockerRunContainerName({ command: 'docker', args: ['ps'] })).toBeUndefined();
  });

  it('inserts --name after run, leaving an already-named invocation untouched', () => {
    expect(withDockerContainerName(['run', '--rm', 'img'], 'c1')).toEqual([
      'run',
      '--name',
      'c1',
      '--rm',
      'img'
    ]);
    const named = ['run', '--name', 'x', 'img'];
    expect(withDockerContainerName(named, 'c1')).toBe(named);
  });
});
