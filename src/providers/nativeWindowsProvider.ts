import type { BuildProvider } from '../packaging/buildProvider';

/**
 * Runs the build CLI directly on the Windows host, using the host's installed
 * LabVIEW and packaging tools (VIPM for `.vipb`, NI Package Builder for `.pbs`).
 * The base invocation is executed as-is.
 */
export const nativeWindowsProvider: BuildProvider = {
  id: 'native-windows',
  label: 'Native Windows (host LabVIEW + VIPM)',
  description: 'Runs the VI/NI package build CLI directly on this Windows host.',
  supportedPackageTypes: ['vi', 'ni'],
  resolveInvocation(context) {
    return context.base;
  }
};
