import { baseName } from './pathUtil';

/**
 * The kind of package a build spec produces.
 *
 * - `vi`  — a JKI VI Package built from a `.vipb` spec via the VIPM CLI.
 * - `ni`  — an NI package built from a `.nipb` spec (planned for a later milestone).
 * - `unknown` — an unsupported file.
 */
export type PackageType = 'vi' | 'ni' | 'unknown';

export interface PackageBuildRequest {
  specPath: string;
  packageType: PackageType;
}

const EXTENSION_TYPE_MAP: Record<string, PackageType> = {
  '.vipb': 'vi',
  '.nipb': 'ni'
};

export function detectPackageType(specPath: string): PackageType {
  // Match by filename suffix so a bare dotfile spec (e.g. `.vipb`, which some
  // repositories use to name their build spec) is recognized, not only the
  // `Name.vipb` form.
  const name = baseName(specPath).toLowerCase();
  const extension = Object.keys(EXTENSION_TYPE_MAP).find((candidate) => name.endsWith(candidate));
  return extension ? EXTENSION_TYPE_MAP[extension] : 'unknown';
}

export function createPackageBuildRequest(specPath: string): PackageBuildRequest {
  return { specPath, packageType: detectPackageType(specPath) };
}

export function describePackageType(packageType: PackageType): string {
  switch (packageType) {
    case 'vi':
      return 'VI Package (JKI VIPM)';
    case 'ni':
      return 'NI Package (NI Package Builder)';
    case 'unknown':
      return 'Unsupported build spec';
  }
}
