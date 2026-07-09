/**
 * Construction of the NI Package Builder command-line invocation.
 *
 * NI packages are built from a `.pbs` NI Package Builder *solution* with the NI
 * Package Builder CLI (`NipbCli`). Unlike the VIPM CLI, NipbCli takes no
 * LabVIEW version/bitness — it opens the solution and builds its packages — so
 * the only substituted token is `${specPath}`, the absolute path to the `.pbs`
 * solution. The executable and its argument template are driven by user
 * settings so unusual install locations and build targets stay configurable.
 */
import type { CommandInvocation } from './vipmCliBuild';

export interface NipbBuildSettings {
  cliPath: string;
  buildArgs: string[];
}

export interface NipbBuildTokens {
  specPath: string;
}

const TOKEN_REPLACEMENTS: ReadonlyArray<{ token: string; key: keyof NipbBuildTokens }> = [
  { token: '${specPath}', key: 'specPath' }
];

export function substituteNipbTokens(args: string[], tokens: NipbBuildTokens): string[] {
  return args.map((arg) =>
    TOKEN_REPLACEMENTS.reduce(
      (current, { token, key }) => current.split(token).join(tokens[key]),
      arg
    )
  );
}

export function buildNipbInvocation(
  tokens: NipbBuildTokens,
  settings: NipbBuildSettings
): CommandInvocation {
  return {
    command: settings.cliPath,
    args: substituteNipbTokens(settings.buildArgs, tokens)
  };
}
