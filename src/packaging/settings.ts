import type { VipmBuildSettings } from './vipmCliBuild';

export type DefaultProvider = 'ask' | 'native-windows' | 'docker-windows';

export interface DockerProviderSettings {
  image: string;
  containerWorkdir: string;
}

export interface PackageBenchSettings {
  defaultProvider: DefaultProvider;
  vipm: VipmBuildSettings;
  docker: DockerProviderSettings;
}

export const DEFAULT_SETTINGS: PackageBenchSettings = {
  defaultProvider: 'ask',
  vipm: {
    cliPath: 'vipm',
    buildArgs: ['build', '${specPath}']
  },
  docker: {
    image: 'labview-package-bench-windows:latest',
    containerWorkdir: 'C:\\work'
  }
};

interface RawSettings {
  defaultProvider?: unknown;
  vipm?: { cliPath?: unknown; buildArgs?: unknown };
  docker?: { image?: unknown; containerWorkdir?: unknown };
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value) && value.every((entry) => typeof entry === 'string')) {
    return value as string[];
  }
  return fallback;
}

function asDefaultProvider(value: unknown): DefaultProvider {
  return value === 'native-windows' || value === 'docker-windows' ? value : 'ask';
}

export function normalizePackageBenchSettings(raw: RawSettings = {}): PackageBenchSettings {
  return {
    defaultProvider: asDefaultProvider(raw.defaultProvider),
    vipm: {
      cliPath: asString(raw.vipm?.cliPath, DEFAULT_SETTINGS.vipm.cliPath),
      buildArgs: asStringArray(raw.vipm?.buildArgs, DEFAULT_SETTINGS.vipm.buildArgs)
    },
    docker: {
      image: asString(raw.docker?.image, DEFAULT_SETTINGS.docker.image),
      containerWorkdir: asString(
        raw.docker?.containerWorkdir,
        DEFAULT_SETTINGS.docker.containerWorkdir
      )
    }
  };
}
