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

export function fileExtension(inputPath: string): string {
  const name = baseName(inputPath);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex <= 0 ? '' : name.slice(dotIndex).toLowerCase();
}

export function joinWindowsPath(directory: string, name: string): string {
  const trimmed = directory.replace(/[\\/]+$/, '');
  return `${trimmed}\\${name}`;
}
