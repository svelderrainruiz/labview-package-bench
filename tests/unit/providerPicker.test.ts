import { describe, expect, it, vi } from 'vitest';

const { showQuickPickMock } = vi.hoisted(() => ({ showQuickPickMock: vi.fn() }));

vi.mock('vscode', () => ({
  window: { showQuickPick: showQuickPickMock }
}));

import { pickBuildProvider } from '../../src/ui/providerPicker';
import type { BuildProvider } from '../../src/packaging/buildProvider';

function makeProvider(id: BuildProvider['id'], label: string): BuildProvider {
  return {
    id,
    label,
    description: `runs in ${id}`,
    supportedPackageTypes: ['vi'],
    resolveInvocation: (context) => context.base
  };
}

describe('pickBuildProvider', () => {
  it('maps providers to quick-pick items and returns the selected provider', async () => {
    const providers = [
      makeProvider('native-windows', 'Native'),
      makeProvider('docker-linux', 'Linux')
    ];
    showQuickPickMock.mockResolvedValueOnce({ provider: providers[1] });

    const picked = await pickBuildProvider(providers);

    expect(picked).toBe(providers[1]);
    const items = showQuickPickMock.mock.calls[0][0] as Array<{
      label: string;
      description: string;
      detail: string;
    }>;
    expect(items.map((item) => item.label)).toEqual(['Native', 'Linux']);
    expect(items.map((item) => item.description)).toEqual(['native-windows', 'docker-linux']);
    expect(items[0].detail).toBe('runs in native-windows');
  });

  it('returns undefined when the picker is dismissed', async () => {
    showQuickPickMock.mockResolvedValueOnce(undefined);
    expect(await pickBuildProvider([makeProvider('native-windows', 'Native')])).toBeUndefined();
  });
});
