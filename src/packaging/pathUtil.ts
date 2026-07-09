/**
 * Separator-agnostic path helpers.
 *
 * The extension constructs commands that run on Windows hosts and inside
 * Windows containers, but its unit tests run on Linux CI. These helpers avoid
 * `node:path`'s platform-coupled behavior so build-spec paths parse the same
 * way regardless of which separator the incoming path uses.
 */

export function baseName(inputPath: string): string {
  const segments = inputPath.split(/[\\/]/);
  return segments[segments.length - 1] ?? inputPath;
}

export function parentDir(inputPath: string): string {
  const lastSeparator = Math.max(inputPath.lastIndexOf('/'), inputPath.lastIndexOf('\\'));
  return lastSeparator < 0 ? '' : inputPath.slice(0, lastSeparator);
}

export function joinWindowsPath(directory: string, name: string): string {
  const trimmed = directory.replace(/[\\/]+$/, '');
  return `${trimmed}\\${name}`;
}

export function toPosix(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Path of `target` relative to `root`, using forward slashes. Falls back to the
 * base name when `target` is not under `root`. Used to map a host build-spec
 * path to its location inside a bind-mounted container working directory.
 */
export function relativeFromRoot(root: string, target: string): string {
  const normalizedRoot = toPosix(root).replace(/\/+$/, '');
  const normalizedTarget = toPosix(target);
  if (normalizedRoot.length > 0 && normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    return normalizedTarget.slice(normalizedRoot.length + 1);
  }
  return baseName(target);
}
