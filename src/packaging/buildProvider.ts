import type { CommandInvocation } from './vipmCliBuild';

/**
 * A build environment capable of running a VIPM CLI invocation. Each provider
 * takes the base (host-relative) invocation and returns the invocation to
 * actually execute for its environment — unchanged for the native host, or
 * wrapped in `docker run` for a Windows container.
 */
export interface ProviderBuildContext {
  specPath: string;
  specDir: string;
  base: CommandInvocation;
}

export interface BuildProvider {
  id: 'native-windows' | 'docker-windows';
  label: string;
  description: string;
  resolveInvocation(context: ProviderBuildContext): CommandInvocation;
}
