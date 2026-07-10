import type { PackageType } from './packageBuildRequest';
import type { CommandInvocation } from './vipmCliBuild';

/**
 * A build environment capable of running a VIPM CLI invocation. Each provider
 * takes the base (host-relative) invocation and returns the invocation to
 * actually execute for its environment — unchanged for the native host, or
 * wrapped in `docker run` for a Windows container.
 */
export interface ProviderBuildContext {
  specPath: string;
  specDir: string;
  /** Directory bind-mounted into container providers; the git repo root that
   * VIPM Community Edition requires for its public-repository check. */
  mountRoot: string;
  base: CommandInvocation;
}

export interface BuildProvider {
  id: 'native-windows' | 'docker-windows' | 'docker-linux';
  label: string;
  description: string;
  /** Package types this environment can build. NI packages require the NI
   * Package Builder CLI, which only the native Windows host provides today. */
  supportedPackageTypes: readonly PackageType[];
  /** Optional advisory logged when this environment runs a build — e.g. to flag
   * that in-container package building is an upstream preview that may not
   * complete, so the native host stays the verified path. */
  buildNote?: string;
  /** For container providers, the workdir the repo (`mountRoot`) is bind-mounted
   * to inside the container (e.g. `/work` or `C:\work`). Used to translate a
   * container artifact path the build tool prints back to a host path. Undefined
   * for the native host, whose tool output already prints host paths. */
  containerWorkdir?: string;
  resolveInvocation(context: ProviderBuildContext): CommandInvocation;
}
