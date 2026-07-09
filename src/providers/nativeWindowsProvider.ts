import type { BuildProvider } from '../packaging/buildProvider';

/**
 * Runs the VIPM CLI directly on the Windows host, using the host's installed
 * LabVIEW and VIPM. The base invocation is executed as-is.
 */
export const nativeWindowsProvider: BuildProvider = {
  id: 'native-windows',
  label: 'Native Windows (host LabVIEW + VIPM)',
  description: 'Runs the VIPM CLI directly on this Windows host.',
  resolveInvocation(context) {
    return context.base;
  }
};
