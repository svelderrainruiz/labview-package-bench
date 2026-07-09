import {
  createPackageBuildRequest,
  describePackageType,
  detectPackageType,
  type PackageBuildRequest
} from '../packaging/packageBuildRequest';
import { baseName, parentDir } from '../packaging/pathUtil';
import type { PackageBenchSettings } from '../packaging/settings';
import type { BuildProvider } from '../packaging/buildProvider';
import { buildNipbInvocation } from '../packaging/niPackageBuild';
import {
  buildVipmInvocation,
  renderInvocation,
  type CommandInvocation
} from '../packaging/vipmCliBuild';
import type { ProcessRunner } from '../packaging/processRunner';
import { getBuildProviders, resolveConfiguredProvider } from '../providers/registry';
import type { BuildLog } from '../ui/buildOutputChannel';

export interface BuildPackageDeps {
  readSettings(): PackageBenchSettings;
  resolveMountRoot(specPath: string): string;
  pickProvider(providers: BuildProvider[]): Promise<BuildProvider | undefined>;
  runner: ProcessRunner;
  log: BuildLog;
  showInfo(message: string): void;
  showError(message: string): void;
}

export interface BuildPlan {
  request: PackageBuildRequest;
  provider: BuildProvider;
  invocation: CommandInvocation;
  specDir: string;
}

export type BuildOutcome =
  | { status: 'no-target' }
  | { status: 'unsupported' }
  | { status: 'deferred' }
  | { status: 'cancelled' }
  | { status: 'succeeded'; exitCode: number }
  | { status: 'failed'; exitCode: number }
  | { status: 'error'; message: string };

export function extractSpecPath(
  target: unknown,
  activeEditorPath: string | undefined
): string | undefined {
  if (
    target &&
    typeof target === 'object' &&
    'fsPath' in target &&
    typeof (target as { fsPath: unknown }).fsPath === 'string'
  ) {
    return (target as { fsPath: string }).fsPath;
  }
  return activeEditorPath;
}

export function planBuildInvocation(
  specPath: string,
  mountRoot: string,
  provider: BuildProvider,
  settings: PackageBenchSettings
): BuildPlan {
  const request = createPackageBuildRequest(specPath);
  const base =
    request.packageType === 'ni'
      ? buildNipbInvocation({ specPath }, settings.nipb)
      : buildVipmInvocation(
          {
            specPath,
            labviewVersion: settings.labview.version,
            labviewBitness: settings.labview.bitness
          },
          settings.vipm
        );
  const specDir = parentDir(specPath);
  const invocation = provider.resolveInvocation({ specPath, specDir, mountRoot, base });
  return { request, provider, invocation, specDir };
}

/** A clearer message when a build tool cannot be launched (missing CLI/Docker). */
function describeLaunchFailure(command: string, message: string): string | undefined {
  if (/\bENOENT\b/i.test(message)) {
    return `Could not launch "${command}". Make sure it is installed and on PATH — set labviewPackageBench.vipm.cliPath or nipb.cliPath to the full CLI path, or start Docker Desktop for a container build.`;
  }
  return undefined;
}

/** Max characters of build output retained for failure-signature detection —
 * enough to see the tail of a `--verbose` log without holding all of it. */
const BUILD_OUTPUT_TAIL_LIMIT = 16 * 1024;

/** Seconds VIPM may run silently before its watchdog aborts. VIPM's own default
 * (60s) is too short for a long native mass-compile and can abort a build even
 * after the .vip is written; this matches the value baked into the container
 * images. */
const NATIVE_VIPM_LIVELINESS_SECONDS = 600;

/** A clearer hint for a recognizable failure signature in the tool output. */
function describeBuildFailure(output: string): string | undefined {
  if (/public git repository|not inside a git repository|not a git repository/i.test(output)) {
    return 'The build spec must live inside a public git repository for VIPM Community Edition. Open the repository root as your workspace folder, or activate VIPM Professional.';
  }
  if (/already exists in build output location/i.test(output)) {
    const named = /"([^"]+\.vip)"\s+already exists in build output location/i.exec(output);
    const which = named ? `The package "${named[1]}"` : 'The output package';
    return `${which} already exists in the build output location and VIPM will not overwrite it. Delete the existing .vip, or raise the version in the build spec, then build again.`;
  }
  return undefined;
}

export async function runBuildPackage(
  target: unknown,
  activeEditorPath: string | undefined,
  deps: BuildPackageDeps,
  signal?: AbortSignal
): Promise<BuildOutcome> {
  const settings = deps.readSettings();
  const specPath = extractSpecPath(target, activeEditorPath);

  if (!specPath) {
    deps.showError('Open or right-click a .vipb or .nipb build spec to build a package.');
    return { status: 'no-target' };
  }

  const packageType = detectPackageType(specPath);
  if (packageType === 'unknown') {
    deps.showError(`${baseName(specPath)} is not a .vipb, .pbs, or .nipb build spec.`);
    return { status: 'unsupported' };
  }

  const providers = getBuildProviders(settings).filter((candidate) =>
    candidate.supportedPackageTypes.includes(packageType)
  );
  if (providers.length === 0) {
    deps.showError(
      `No build environment can build ${describePackageType(packageType)}. NI packages require the native Windows host (NI Package Builder).`
    );
    return { status: 'unsupported' };
  }

  const provider =
    resolveConfiguredProvider(settings, providers) ?? (await deps.pickProvider(providers));
  if (!provider) {
    return { status: 'cancelled' };
  }

  const plan = planBuildInvocation(specPath, deps.resolveMountRoot(specPath), provider, settings);
  const kind = packageType === 'ni' ? 'NI package' : 'VI package';
  deps.log.clear();
  deps.log.show();
  deps.log.appendLine(
    `Building ${baseName(specPath)} — ${describePackageType(packageType)} via ${provider.label}`
  );
  if (provider.buildNote) {
    deps.log.appendLine(`Note: ${provider.buildNote}`);
  }
  deps.log.appendLine(`> ${renderInvocation(plan.invocation)}`);

  // VIPM's default 60s liveliness watchdog can abort a native build during a
  // long silent mass-compile even after the .vip is written; grant native VIPM
  // builds the same tolerance the container images bake in.
  const buildEnv =
    packageType === 'vi' && provider.id === 'native-windows'
      ? { VIPM_DESKTOP_LIVELINESS_TIMEOUT: String(NATIVE_VIPM_LIVELINESS_SECONDS) }
      : undefined;

  // Keep only a bounded tail of the output for failure-signature detection —
  // avoids retaining a large --verbose log or re-copying a growing buffer.
  let outputTail = '';
  try {
    const exitCode = await deps.runner.run(plan.invocation, {
      cwd: plan.specDir,
      onOutput: (chunk) => {
        outputTail = (outputTail + chunk).slice(-BUILD_OUTPUT_TAIL_LIMIT);
        deps.log.append(chunk);
      },
      signal,
      env: buildEnv
    });

    if (signal?.aborted) {
      deps.log.appendLine('\nBuild cancelled.');
      return { status: 'cancelled' };
    }

    if (exitCode === 0) {
      deps.log.appendLine('\nBuild succeeded.');
      deps.showInfo(`${kind} build succeeded: ${baseName(specPath)}`);
      return { status: 'succeeded', exitCode };
    }

    deps.log.appendLine(`\nBuild failed (exit code ${exitCode}).`);
    const failureHint = describeBuildFailure(outputTail);
    deps.showError(
      failureHint
        ? `${kind} build failed (exit code ${exitCode}). ${failureHint}`
        : `${kind} build failed (exit code ${exitCode}).`
    );
    return { status: 'failed', exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log.appendLine(`\nBuild error: ${message}`);
    deps.showError(
      describeLaunchFailure(plan.invocation.command, message) ?? `${kind} build error: ${message}`
    );
    return { status: 'error', message };
  }
}
