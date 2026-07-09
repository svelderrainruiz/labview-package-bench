/**
 * Construction of the JKI VIPM command-line invocation.
 *
 * The exact VIPM CLI syntax is deployment-specific, so the executable and its
 * argument template are driven by user settings. `${specPath}` in the argument
 * template is replaced with the absolute path to the `.vipb` build spec.
 */

export interface CommandInvocation {
  command: string;
  args: string[];
}

export interface VipmBuildSettings {
  cliPath: string;
  buildArgs: string[];
}

export interface VipmBuildTokens {
  specPath: string;
  labviewVersion: string;
  labviewBitness: string;
}

const TOKEN_REPLACEMENTS: ReadonlyArray<{ token: string; key: keyof VipmBuildTokens }> = [
  { token: '${specPath}', key: 'specPath' },
  { token: '${labviewVersion}', key: 'labviewVersion' },
  { token: '${labviewBitness}', key: 'labviewBitness' }
];

export function substituteTokens(args: string[], tokens: VipmBuildTokens): string[] {
  return args.map((arg) =>
    TOKEN_REPLACEMENTS.reduce((current, { token, key }) => current.split(token).join(tokens[key]), arg)
  );
}

export function buildVipmInvocation(
  tokens: VipmBuildTokens,
  settings: VipmBuildSettings
): CommandInvocation {
  return {
    command: settings.cliPath,
    args: substituteTokens(settings.buildArgs, tokens)
  };
}

export function renderInvocation(invocation: CommandInvocation): string {
  return [invocation.command, ...invocation.args]
    .map((token) => (/\s/.test(token) ? `"${token}"` : token))
    .join(' ');
}
