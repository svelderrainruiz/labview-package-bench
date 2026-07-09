import type { BuildProvider, ProviderBuildContext } from '../packaging/buildProvider';
import type { DockerProviderSettings } from '../packaging/settings';
import { baseName, joinWindowsPath } from '../packaging/pathUtil';

/**
 * Runs the build inside a Docker Desktop Windows container that has LabVIEW and
 * VIPM installed. The build-spec directory is bind-mounted into the container
 * working directory, and the host spec path in the base invocation is rewritten
 * to its in-container location.
 */
export function createDockerWindowsProvider(settings: DockerProviderSettings): BuildProvider {
  return {
    id: 'docker-windows',
    label: 'Docker Windows container',
    description: `Runs the build inside ${settings.image}.`,
    resolveInvocation(context: ProviderBuildContext) {
      const containerSpecPath = joinWindowsPath(
        settings.containerWorkdir,
        baseName(context.specPath)
      );
      const rewrittenArgs = context.base.args.map((arg) =>
        arg === context.specPath ? containerSpecPath : arg
      );

      return {
        command: 'docker',
        args: [
          'run',
          '--rm',
          '-v',
          `${context.specDir}:${settings.containerWorkdir}`,
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
