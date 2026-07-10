import type { BuildProvider, ProviderBuildContext } from '../packaging/buildProvider';
import type { DockerProviderSettings } from '../packaging/settings';
import { joinWindowsPath, relativeFromRoot } from '../packaging/pathUtil';

/**
 * VIPM Pro activation is required to build inside a container today. These host
 * environment variables are forwarded to the container by name only — never by
 * value — so the serial never appears on a command line or in build logs. The
 * baked wrapper (`docker/windows/vipm-build.ps1`) uses them to activate VIPM
 * before building.
 */
const VIPM_ACTIVATION_ENV = ['VIPM_SERIAL_NUMBER', 'VIPM_FULL_NAME', 'VIPM_EMAIL'];

/**
 * Runs the build inside a Docker Desktop Windows container that has LabVIEW and
 * VIPM installed (see `docker/windows/Dockerfile`). The git repo root
 * (`mountRoot`) is bind-mounted so VIPM can see `.git`, and the host spec path in
 * the base invocation is rewritten to its in-container location relative to that
 * root. The image's baked entrypoint activates VIPM Pro and runs `vipm refresh`
 * (to register LabVIEW) before executing the passed `vipm` command, so only the
 * `build ...` arguments are forwarded here.
 */
export function createDockerWindowsProvider(settings: DockerProviderSettings): BuildProvider {
  return {
    id: 'docker-windows',
    label: 'Docker Windows container',
    description: `Runs the build inside ${settings.image}.`,
    supportedPackageTypes: ['vi'],
    buildNote:
      'In-container package building is an upstream VIPM Windows-container preview and may not complete headlessly; the native-windows host is the verified build path.',
    containerWorkdir: settings.containerWorkdir,
    resolveInvocation(context: ProviderBuildContext) {
      const relativeSpec = relativeFromRoot(context.mountRoot, context.specPath).replace(/\//g, '\\');
      const containerSpecPath = joinWindowsPath(settings.containerWorkdir, relativeSpec);
      const rewrittenArgs = context.base.args.map((arg) =>
        arg === context.specPath ? containerSpecPath : arg
      );
      const envForwarding = VIPM_ACTIVATION_ENV.flatMap((name) => ['-e', name]);
      // The Docker NAT DNS proxy fails to resolve on some Windows hosts, which
      // breaks VIPM Pro online activation; an explicit DNS server fixes it.
      const dnsArgs = settings.dns ? ['--dns', settings.dns] : [];

      return {
        command: 'docker',
        args: [
          'run',
          '--rm',
          ...dnsArgs,
          ...envForwarding,
          '-v',
          `${context.mountRoot}:${settings.containerWorkdir}`,
          '-w',
          settings.containerWorkdir,
          settings.image,
          ...rewrittenArgs
        ]
      };
    }
  };
}
