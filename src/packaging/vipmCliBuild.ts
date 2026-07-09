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

export const SPEC_PATH_TOKEN = '${specPath}';

export function substituteSpecPath(args: string[], specPath: string): string[] {
  return args.map((arg) => arg.split(SPEC_PATH_TOKEN).join(specPath));
}

export function buildVipmInvocation(
  specPath: string,
  settings: VipmBuildSettings
): CommandInvocation {
  return {
    command: settings.cliPath,
    args: substituteSpecPath(settings.buildArgs, specPath)
  };
}

export function renderInvocation(invocation: CommandInvocation): string {
  return [invocation.command, ...invocation.args]
    .map((token) => (/\s/.test(token) ? `"${token}"` : token))
    .join(' ');
}
