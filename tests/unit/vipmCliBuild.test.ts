import { describe, expect, it } from 'vitest';

import {
  buildVipmInvocation,
  renderInvocation,
  substituteSpecPath
} from '../../src/packaging/vipmCliBuild';

describe('vipm cli build', () => {
  it('substitutes the spec-path token in every argument', () => {
    expect(substituteSpecPath(['build', '${specPath}'], 'C:\\a\\b.vipb')).toEqual([
      'build',
      'C:\\a\\b.vipb'
    ]);
    expect(substituteSpecPath(['--input=${specPath}'], '/x/y.vipb')).toEqual(['--input=/x/y.vipb']);
  });

  it('builds an invocation from configurable settings', () => {
    expect(
      buildVipmInvocation('/x/y.vipb', { cliPath: 'vipm', buildArgs: ['build', '${specPath}'] })
    ).toEqual({ command: 'vipm', args: ['build', '/x/y.vipb'] });
  });

  it('renders an invocation and quotes tokens with spaces', () => {
    expect(
      renderInvocation({ command: 'vipm', args: ['build', 'C:\\Program Files\\a.vipb'] })
    ).toBe('vipm build "C:\\Program Files\\a.vipb"');
  });
});
