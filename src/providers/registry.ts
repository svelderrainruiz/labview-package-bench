import type { BuildProvider } from '../packaging/buildProvider';
import type { PackageBenchSettings } from '../packaging/settings';
import { nativeWindowsProvider } from './nativeWindowsProvider';
import { createDockerWindowsProvider } from './dockerWindowsProvider';
import { createDockerLinuxProvider } from './dockerLinuxProvider';

export function getBuildProviders(settings: PackageBenchSettings): BuildProvider[] {
  return [
    nativeWindowsProvider,
    createDockerWindowsProvider(settings.docker),
    createDockerLinuxProvider(settings.linuxContainer)
  ];
}

export function resolveConfiguredProvider(
  settings: PackageBenchSettings,
  providers: BuildProvider[]
): BuildProvider | undefined {
  if (settings.defaultProvider === 'ask') {
    return undefined;
  }
  return providers.find((provider) => provider.id === settings.defaultProvider);
}
