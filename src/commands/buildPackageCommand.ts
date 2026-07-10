import {
  createPackageBuildRequest,
  describePackageType,
  detectPackageType,
  type PackageBuildRequest
} from '../packaging/packageBuildRequest';
import { baseName, joinPath, joinWindowsPath, parentDir, toPosix } from '../packaging/pathUtil';
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
  /** Success notification. When `revealPath` is set, the UI may offer to reveal
   * or copy the built artifact. */
  showInfo(message: string, revealPath?: string): void;
  showError(message: string): void;
  /** Whether a filesystem path exists (injected so artifact cleanup is testable). */
  pathExists(path: string): boolean;
  /** Deletes a file, throwing on failure (injected so artifact cleanup is testable). */
  deleteFile(path: string): void;
  /** Reads a UTF-8 text file, or undefined when it is missing/unreadable
   * (injected so the `.lvversion` advisory is testable). */
  readTextFile(path: string): string | undefined;
}

export interface BuildPlan {
  request: PackageBuildRequest;
  provider: BuildProvider;
  invocation: CommandInvocation;
  specDir: string;
  /** Extra environment for the build process (e.g. VIPM's liveliness timeout for
   * native VI builds). Lives on the plan so every execution path — the command
   * and the opt-in integration harness — applies the same env. */
  env?: Record<string, string>;
}

export type BuildOutcome =
  | { status: 'no-target' }
  | { status: 'unsupported' }
  | { status: 'deferred' }
  | { status: 'cancelled' }
  | { status: 'succeeded'; exitCode: number; artifactPath?: string }
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
  // VIPM's default 60s liveliness watchdog can abort a native build during a long
  // silent mass-compile even after the .vip is written; grant native VIPM builds
  // the same tolerance the container images bake in.
  const env =
    request.packageType === 'vi' && provider.id === 'native-windows'
      ? { VIPM_DESKTOP_LIVELINESS_TIMEOUT: String(NATIVE_VIPM_LIVELINESS_SECONDS) }
      : undefined;
  return { request, provider, invocation, specDir, env };
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

/** Matches VIPM's "already exists in build output location" (Code 10) failure,
 * capturing the conflicting .vip file name. */
const ALREADY_EXISTS_VIP = /"([^"]+\.vip)"\s+already exists in build output location/i;

/** A clearer hint for a recognizable failure signature in the tool output. */
function describeBuildFailure(output: string): string | undefined {
  if (/public git repository|not inside a git repository|not a git repository/i.test(output)) {
    return 'The build spec must live inside a public git repository for VIPM Community Edition. Open the repository root as your workspace folder, or activate VIPM Professional.';
  }
  if (/already exists in build output location/i.test(output)) {
    const named = ALREADY_EXISTS_VIP.exec(output);
    const which = named ? `The package "${named[1]}"` : 'The output package';
    return `${which} already exists in the build output location and VIPM will not overwrite it. Delete the existing .vip, or raise the version in the build spec, then build again.`;
  }
  return undefined;
}

/** Pulls the built package path out of the tool output: VIPM lists the `.vip`
 * under "Generated files:" and NipbCli prints the produced `.nipkg`. Accepts
 * only a bare absolute path on its own line (so a `prefix: path` log line can't
 * be misparsed) and returns the last match, so the produced artifact wins over
 * any spec path echoed earlier. Undefined when no such line is present. */
function extractBuiltArtifactPath(output: string): string | undefined {
  let found: string | undefined;
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^(?:[A-Za-z]:[\\/]|[\\/]).*\.(?:vip|nipkg)$/i.test(line)) {
      found = line;
    }
  }
  return found;
}

/** Translates a build-tool artifact path to a path on the VS Code host. Native
 * builds already print host paths (no `containerWorkdir`); container providers
 * print a path under their bind-mounted workdir, which maps back onto
 * `mountRoot`. Returns undefined for a container path outside the workdir, so a
 * non-host path is never handed to "Reveal in Explorer"/"Copy Path". */
export function resolveHostArtifactPath(
  rawPath: string | undefined,
  containerWorkdir: string | undefined,
  mountRoot: string
): string | undefined {
  if (!rawPath) {
    return undefined;
  }
  if (!containerWorkdir) {
    return rawPath;
  }
  const workdir = toPosix(containerWorkdir).replace(/\/+$/, '');
  const raw = toPosix(rawPath);
  if (raw !== workdir && !raw.startsWith(`${workdir}/`)) {
    return undefined;
  }
  const relative = raw.slice(workdir.length).replace(/^\/+/, '');
  if (!relative) {
    return undefined;
  }
  const hostUsesBackslash = mountRoot.includes('\\');
  const trimmedRoot = mountRoot.replace(/[\\/]+$/, '');
  const separator = hostUsesBackslash ? '\\' : '/';
  const hostRelative = hostUsesBackslash ? relative.replace(/\//g, '\\') : relative;
  return `${trimmedRoot}${separator}${hostRelative}`;
}

/** Walks from the spec directory up to the mount root (inclusive), returning the
 * first `<dir>\<fileName>` that exists. VIPM writes the .vip to the spec's
 * directory or an ancestor, per the .vipb's output-location setting. */
function findExistingArtifact(
  fileName: string,
  specDir: string,
  mountRoot: string,
  pathExists: (candidate: string) => boolean
): string | undefined {
  let current = specDir;
  let previous = '';
  for (let depth = 0; depth < 16 && current && current !== previous; depth += 1) {
    const candidate = joinWindowsPath(current, fileName);
    if (pathExists(candidate)) {
      return candidate;
    }
    if (current === mountRoot) {
      break;
    }
    previous = current;
    current = parentDir(current);
  }
  return undefined;
}

/** For VIPM's "already exists" (Code 10) failure, finds the named .vip near the
 * spec and deletes it, returning the removed path (or undefined when the output
 * is a different failure or the file cannot be located). */
function cleanExistingArtifact(
  output: string,
  specDir: string,
  mountRoot: string,
  deps: Pick<BuildPackageDeps, 'pathExists' | 'deleteFile'>
): string | undefined {
  const named = ALREADY_EXISTS_VIP.exec(output);
  if (!named) {
    return undefined;
  }
  const existing = findExistingArtifact(named[1], specDir, mountRoot, deps.pathExists);
  if (!existing) {
    return undefined;
  }
  deps.deleteFile(existing);
  return existing;
}

/** Parses a `.lvversion` value into a LabVIEW release year: the internal major
 * (`20.0` -> 2020) or an already-4-digit year (`2020`). Undefined otherwise. */
function parseLabviewYear(content: string): number | undefined {
  const match = /(\d{1,4})/.exec(content.trim());
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  if (value >= 1900) {
    return value;
  }
  if (value >= 6 && value <= 99) {
    return 2000 + value;
  }
  return undefined;
}

/** Reads the nearest `.lvversion` (walking the spec dir up to the mount root) and
 * returns the LabVIEW year the project targets, or undefined when none is found. */
function findProjectLabviewYear(
  specDir: string,
  mountRoot: string,
  readText: (path: string) => string | undefined
): number | undefined {
  let current = specDir;
  let previous = '';
  for (let depth = 0; depth < 16 && current && current !== previous; depth += 1) {
    const content = readText(joinPath(current, '.lvversion'));
    const year = content ? parseLabviewYear(content) : undefined;
    if (year !== undefined) {
      return year;
    }
    if (current === mountRoot) {
      break;
    }
    previous = current;
    current = parentDir(current);
  }
  return undefined;
}

/** The value passed to `--labview-version` in a resolved invocation (native, or
 * wrapped in `docker run`), or undefined when the command carries no version
 * flag — so the advisory reflects the actual build, not the raw setting. */
function labviewVersionFromArgs(args: string[]): string | undefined {
  const index = args.indexOf('--labview-version');
  return index >= 0 && index + 1 < args.length ? args[index + 1] : undefined;
}

/** Advises only about the failing direction: a project whose `.lvversion` targets
 * a LabVIEW *newer* than the version the command actually builds with can fail
 * (LabVIEW builds older code with a newer version, but not the reverse). Silent
 * when the build carries no `--labview-version`, when the project targets an
 * equal/older version, or when there is no `.lvversion`. */
function describeLabviewVersionMismatch(
  specDir: string,
  mountRoot: string,
  buildVersion: string | undefined,
  readText: (path: string) => string | undefined
): string | undefined {
  if (!buildVersion) {
    return undefined;
  }
  const buildYear = Number(buildVersion);
  if (!Number.isFinite(buildYear)) {
    return undefined;
  }
  const projectYear = findProjectLabviewYear(specDir, mountRoot, readText);
  if (projectYear === undefined || projectYear <= buildYear) {
    return undefined;
  }
  return `this project targets LabVIEW ${projectYear} (.lvversion) but the build uses ${buildYear}. Building newer code with an older LabVIEW can fail — build with LabVIEW ${projectYear} or newer (labviewPackageBench.labview.version).`;
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

  const mountRoot = deps.resolveMountRoot(specPath);
  const plan = planBuildInvocation(specPath, mountRoot, provider, settings);
  const kind = packageType === 'ni' ? 'NI package' : 'VI package';
  deps.log.clear();
  deps.log.show();
  deps.log.appendLine(
    `Building ${baseName(specPath)} — ${describePackageType(packageType)} via ${provider.label}`
  );
  if (provider.buildNote) {
    deps.log.appendLine(`Note: ${provider.buildNote}`);
  }
  const versionAdvisory =
    packageType === 'vi'
      ? describeLabviewVersionMismatch(
          plan.specDir,
          mountRoot,
          labviewVersionFromArgs(plan.invocation.args),
          deps.readTextFile
        )
      : undefined;
  if (versionAdvisory) {
    deps.log.appendLine(`Note: ${versionAdvisory}`);
  }
  deps.log.appendLine(`> ${renderInvocation(plan.invocation)}`);

  // Keep only a bounded tail of the output for failure-signature detection —
  // avoids retaining a large --verbose log or re-copying a growing buffer.
  let outputTail = '';
  const runBuild = () => {
    outputTail = '';
    return deps.runner.run(plan.invocation, {
      cwd: plan.specDir,
      onOutput: (chunk) => {
        outputTail = (outputTail + chunk).slice(-BUILD_OUTPUT_TAIL_LIMIT);
        deps.log.append(chunk);
      },
      signal,
      env: plan.env
    });
  };

  try {
    let exitCode = await runBuild();

    if (signal?.aborted) {
      deps.log.appendLine('\nBuild cancelled.');
      return { status: 'cancelled' };
    }

    // Opt-in recovery: VIPM refuses to overwrite an existing package (Code 10)
    // and its CLI has no force flag. When enabled for native VI builds, remove
    // the named .vip once and rebuild.
    if (
      exitCode !== 0 &&
      settings.vipm.overwriteExisting &&
      packageType === 'vi' &&
      provider.id === 'native-windows'
    ) {
      try {
        const removed = cleanExistingArtifact(outputTail, plan.specDir, mountRoot, deps);
        if (removed) {
          deps.log.appendLine(`\nRemoved existing package: ${removed}\nRebuilding…`);
          exitCode = await runBuild();
          if (signal?.aborted) {
            deps.log.appendLine('\nBuild cancelled.');
            return { status: 'cancelled' };
          }
        }
      } catch (cleanupError) {
        const message =
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        deps.log.appendLine(`\nCould not remove the existing package: ${message}`);
      }
    }

    if (exitCode === 0) {
      const artifactPath = resolveHostArtifactPath(
        extractBuiltArtifactPath(outputTail),
        provider.containerWorkdir,
        mountRoot
      );
      deps.log.appendLine('\nBuild succeeded.');
      if (artifactPath) {
        deps.log.appendLine(`Package: ${artifactPath}`);
      }
      deps.showInfo(
        `${kind} build succeeded: ${baseName(artifactPath ?? specPath)}`,
        artifactPath
      );
      return { status: 'succeeded', exitCode, artifactPath };
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
