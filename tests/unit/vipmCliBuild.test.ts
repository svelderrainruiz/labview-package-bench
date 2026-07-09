import { describe, expect, it } from 'vitest';

import {
  buildVipmInvocation,
  renderInvocation,
  substituteTokens
} from '../../src/packaging/vipmCliBuild';

const tokens = { specPath: 'C:\\a\\b.vipb', labviewVersion: '2026', labviewBitness: '64' };

describe('vipm cli build', () => {
  it('substitutes spec-path, version, and bitness tokens in every argument', () => {
    expect(
      substituteTokens(
        [
          'build',
          '${specPath}',
          '--labview-version',
          '${labviewVersion}',
          '--labview-bitness',
          '${labviewBitness}'
        ],
        tokens
      )
    ).toEqual(['build', 'C:\\a\\b.vipb', '--labview-version', '2026', '--labview-bitness', '64']);
    expect(substituteTokens(['--input=${specPath}'], { ...tokens, specPath: '/x/y.vipb' })).toEqual([
      '--input=/x/y.vipb'
    ]);
  });

  it('builds an invocation from configurable settings', () => {
    expect(
      buildVipmInvocation(
        { specPath: '/x/y.vipb', labviewVersion: '2025', labviewBitness: '32' },
        {
          cliPath: 'vipm',
          buildArgs: [
            'build',
            '${specPath}',
            '--labview-version',
            '${labviewVersion}',
            '--labview-bitness',
            '${labviewBitness}'
          ],
          overwriteExisting: false
        }
      )
    ).toEqual({
      command: 'vipm',
      args: ['build', '/x/y.vipb', '--labview-version', '2025', '--labview-bitness', '32']
    });
  });

  it('renders an invocation and quotes tokens with spaces', () => {
    expect(
      renderInvocation({ command: 'vipm', args: ['build', 'C:\\Program Files\\a.vipb'] })
    ).toBe('vipm build "C:\\Program Files\\a.vipb"');
  });
});
