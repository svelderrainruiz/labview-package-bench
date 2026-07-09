import { describe, expect, it, vi } from 'vitest';

import {
  BUILD_OUTPUT_CHANNEL_NAME,
  createOutputChannelBuildLog
} from '../../src/ui/buildOutputChannel';

describe('createOutputChannelBuildLog', () => {
  it('delegates each log method to the output channel', () => {
    const channel = {
      append: vi.fn(),
      appendLine: vi.fn(),
      clear: vi.fn(),
      show: vi.fn()
    };
    const log = createOutputChannelBuildLog(
      channel as unknown as Parameters<typeof createOutputChannelBuildLog>[0]
    );

    log.append('partial');
    log.appendLine('line');
    log.clear();
    log.show();

    expect(channel.append).toHaveBeenCalledWith('partial');
    expect(channel.appendLine).toHaveBeenCalledWith('line');
    expect(channel.clear).toHaveBeenCalledTimes(1);
    // show(true) keeps focus in the editor rather than stealing it.
    expect(channel.show).toHaveBeenCalledWith(true);
  });

  it('names the channel', () => {
    expect(BUILD_OUTPUT_CHANNEL_NAME).toContain('LabVIEW');
  });
});
