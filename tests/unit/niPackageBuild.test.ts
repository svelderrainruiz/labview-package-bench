import { describe, expect, it } from 'vitest';

import { buildNipbInvocation, substituteNipbTokens } from '../../src/packaging/niPackageBuild';
import { renderInvocation } from '../../src/packaging/vipmCliBuild';

describe('ni package build', () => {
  it('substitutes the spec-path token in every argument', () => {
    expect(
      substituteNipbTokens(['-o=${specPath}', '-b=packages', '--save'], {
        specPath: 'C:\\proj\\Solution.pbs'
      })
    ).toEqual(['-o=C:\\proj\\Solution.pbs', '-b=packages', '--save']);
  });

  it('builds an invocation from configurable settings', () => {
    expect(
      buildNipbInvocation(
        { specPath: '/x/Solution.pbs' },
        { cliPath: 'NipbCli.exe', buildArgs: ['-o=${specPath}', '-b=packages', '--save'] }
      )
    ).toEqual({
      command: 'NipbCli.exe',
      args: ['-o=/x/Solution.pbs', '-b=packages', '--save']
    });
  });

  it('renders an invocation and quotes the executable path with spaces', () => {
    expect(
      renderInvocation({
        command: 'C:\\Program Files\\National Instruments\\Package Builder\\NipbCli.exe',
        args: ['-o=C:\\proj\\Solution.pbs', '-b=packages', '--save']
      })
    ).toBe(
      '"C:\\Program Files\\National Instruments\\Package Builder\\NipbCli.exe" -o=C:\\proj\\Solution.pbs -b=packages --save'
    );
  });
});
