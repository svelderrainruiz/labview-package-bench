import type { VipmBuildSettings } from './vipmCliBuild';

export type DefaultProvider = 'ask' | 'native-windows' | 'docker-windows' | 'docker-linux';

export interface LabviewSettings {
  version: string;
  bitness: string;
}

export interface DockerProviderSettings {
  image: string;
  containerWorkdir: string;
}

export interface LinuxContainerSettings {
  image: string;
}

export interface PackageBenchSettings {
  defaultProvider: DefaultProvider;
  labview: LabviewSettings;
  vipm: VipmBuildSettings;
  docker: DockerProviderSettings;
  linuxContainer: LinuxContainerSettings;
}

export const DEFAULT_SETTINGS: PackageBenchSettings = {
  defaultProvider: 'ask',
  labview: {
    version: '2026',
    bitness: '64'
  },
  vipm: {
    cliPath: 'vipm',
    buildArgs: [
      'build',
      '${specPath}',
      '--labview-version',
      '${labviewVersion}',
      '--labview-bitness',
      '${labviewBitness}',
      '--show-progress',
      '--verbose'
    ]
  },
  docker: {
    image: 'labview-package-bench-windows:latest',
    containerWorkdir: 'C:\\work'
  },
  linuxContainer: {
    image: 'labview-package-bench-linux:latest'
  }
};

interface RawSettings {
  defaultProvider?: unknown;
  labview?: { version?: unknown; bitness?: unknown };
  vipm?: { cliPath?: unknown; buildArgs?: unknown };
  docker?: { image?: unknown; containerWorkdir?: unknown };
  linuxContainer?: { image?: unknown };
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
  return value === 'native-windows' || value === 'docker-windows' || value === 'docker-linux'
    ? value
    : 'ask';
}

export function normalizePackageBenchSettings(raw: RawSettings = {}): PackageBenchSettings {
  return {
    defaultProvider: asDefaultProvider(raw.defaultProvider),
    labview: {
      version: asString(raw.labview?.version, DEFAULT_SETTINGS.labview.version),
      bitness: asString(raw.labview?.bitness, DEFAULT_SETTINGS.labview.bitness)
    },
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
    },
    linuxContainer: {
      image: asString(raw.linuxContainer?.image, DEFAULT_SETTINGS.linuxContainer.image)
    }
  };
}
