import type { BuildProvider, ProviderBuildContext } from '../packaging/buildProvider';
import type { DockerProviderSettings } from '../packaging/settings';
import { joinWindowsPath, relativeFromRoot } from '../packaging/pathUtil';

/**
 * Runs the build inside a Docker Desktop Windows container that has LabVIEW and
 * VIPM installed. The git repo root (`mountRoot`) is bind-mounted so VIPM can
 * see `.git`, and the host spec path in the base invocation is rewritten to its
 * in-container location relative to that root.
 */
export function createDockerWindowsProvider(settings: DockerProviderSettings): BuildProvider {
  return {
    id: 'docker-windows',
    label: 'Docker Windows container',
    description: `Runs the build inside ${settings.image}.`,
    resolveInvocation(context: ProviderBuildContext) {
      const relativeSpec = relativeFromRoot(context.mountRoot, context.specPath).replace(/\//g, '\\');
      const containerSpecPath = joinWindowsPath(settings.containerWorkdir, relativeSpec);
      const rewrittenArgs = context.base.args.map((arg) =>
        arg === context.specPath ? containerSpecPath : arg
      );

      return {
        command: 'docker',
        args: [
          'run',
          '--rm',
          '-v',
          `${context.mountRoot}:${settings.containerWorkdir}`,
          '-w',
          settings.containerWorkdir,
          settings.image,
          context.base.command,
          ...rewrittenArgs
        ]
      };
    }
  };
}
