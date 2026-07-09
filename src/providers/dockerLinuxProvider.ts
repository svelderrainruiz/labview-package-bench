import type { BuildProvider, ProviderBuildContext } from '../packaging/buildProvider';
import type { LinuxContainerSettings } from '../packaging/settings';
import { relativeFromRoot } from '../packaging/pathUtil';

const CONTAINER_WORKDIR = '/work';

// Baked wrapper that runs `vipm refresh` (to register LabVIEW and resolve
// packages) before the requested vipm command. See docker/vipm-build.sh.
const VIPM_BUILD_WRAPPER = 'lvpb-vipm-build';

/**
 * Runs the build inside the baked NI LabVIEW Linux container image (see
 * `docker/Dockerfile`). The image's entrypoint brings up the headless display
 * and LabVIEW runtime, then execs the passed `vipm build ...` command.
 *
 * The git repo root (`mountRoot`) is bind-mounted so VIPM Community Edition can
 * see `.git` for its public-repository check, and the spec is referenced by its
 * path relative to that root. The build runs through the baked wrapper, which
 * registers the installed LabVIEW via `vipm refresh` before building. The
 * produced `.vip` lands under the mount on the host.
 */
export function createDockerLinuxProvider(settings: LinuxContainerSettings): BuildProvider {
  return {
    id: 'docker-linux',
    label: 'Docker Linux container (NI LabVIEW image)',
    description: `Runs the build inside ${settings.image}.`,
    resolveInvocation(context: ProviderBuildContext) {
      const containerSpecPath = `${CONTAINER_WORKDIR}/${relativeFromRoot(
        context.mountRoot,
        context.specPath
      )}`;
      const rewrittenArgs = context.base.args.map((arg) =>
        arg === context.specPath ? containerSpecPath : arg
      );

      return {
        command: 'docker',
        args: [
          'run',
          '--rm',
          '-v',
          `${context.mountRoot}:${CONTAINER_WORKDIR}`,
          '-w',
          CONTAINER_WORKDIR,
          settings.image,
          VIPM_BUILD_WRAPPER,
          ...rewrittenArgs
        ]
      };
    }
  };
}
