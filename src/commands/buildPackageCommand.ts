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

export async function runBuildPackage(
  target: unknown,
  activeEditorPath: string | undefined,
  deps: BuildPackageDeps
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

  try {
    const exitCode = await deps.runner.run(plan.invocation, {
      cwd: plan.specDir,
      onOutput: (chunk) => deps.log.append(chunk)
    });

    if (exitCode === 0) {
      deps.log.appendLine('\nBuild succeeded.');
      deps.showInfo(`${kind} build succeeded: ${baseName(specPath)}`);
      return { status: 'succeeded', exitCode };
    }

    deps.log.appendLine(`\nBuild failed (exit code ${exitCode}).`);
    deps.showError(`${kind} build failed (exit code ${exitCode}).`);
    return { status: 'failed', exitCode };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.log.appendLine(`\nBuild error: ${message}`);
    deps.showError(`${kind} build error: ${message}`);
    return { status: 'error', message };
  }
}
