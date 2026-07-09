import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '..', '..');

type AgentSpec = {
  name: string;
  label: string;
  description: string;
  argumentHint: string;
  tools: string[];
  model: string;
  memory: string;
  spawn: string[];
  userInvocable: string;
  body: string;
};

const {
  buildAgentSpec,
  validateAgentSpec,
  toClaudeTools,
  rewriteRootLinks,
  renderCopilotAgent,
  renderClaudeAgent,
  planFleetOutputs,
  generateFleet
} = require('../../scripts/generateAgentFleet.js') as {
  buildAgentSpec: (frontmatter: Record<string, unknown>, body: string) => AgentSpec;
  validateAgentSpec: (spec: AgentSpec, sourceName: string) => AgentSpec;
  toClaudeTools: (canonicalTools: string[], spawn?: string[]) => string;
  rewriteRootLinks: (body: string, outputDir: string) => string;
  renderCopilotAgent: (spec: AgentSpec) => string;
  renderClaudeAgent: (spec: AgentSpec) => string;
  planFleetOutputs: (specs: AgentSpec[]) => Array<{ relativePath: string; content: string }>;
  generateFleet: (
    cwd: string,
    options?: { write?: boolean }
  ) => {
    specCount: number;
    outputs: Array<{ relativePath: string; changed: boolean; existed: boolean }>;
  };
};

function specFrom(overrides: Record<string, unknown> = {}): AgentSpec {
  return buildAgentSpec(
    {
      name: 'code-reviewer',
      label: 'Code Reviewer',
      description: 'Use to review code.',
      'argument-hint': 'Scope to review',
      tools: ['read', 'search', 'execute'],
      model: 'inherit',
      'user-invocable': 'true',
      ...overrides
    },
    'Body text.'
  );
}

describe('agent fleet generator', () => {
  it('maps canonical tools to the Claude vocabulary in a stable order', () => {
    expect(toClaudeTools(['read', 'search', 'execute'])).toBe('Read, Grep, Glob, Bash');
    expect(toClaudeTools(['read', 'search', 'edit', 'execute', 'todo'], ['code-reviewer'])).toBe(
      'Read, Grep, Glob, Edit, Write, Bash, TodoWrite, Agent(code-reviewer)'
    );
  });

  it('omits the Agent spawn allowlist when no spawn targets are declared', () => {
    expect(toClaudeTools(['read', 'search'])).toBe('Read, Grep, Glob');
  });

  it('rewrites @root links relative to each output directory and preserves fragments', () => {
    const body = 'See [skill](@root/.github/skills/testing-automation/SKILL.md).';
    expect(rewriteRootLinks(body, '.github/agents')).toBe(
      'See [skill](../skills/testing-automation/SKILL.md).'
    );
    expect(rewriteRootLinks(body, '.claude/agents')).toBe(
      'See [skill](../../.github/skills/testing-automation/SKILL.md).'
    );
    expect(
      rewriteRootLinks('See [flow](@root/CONTRIBUTING.md#branch-and-pr-flow).', '.github/agents')
    ).toBe('See [flow](../../CONTRIBUTING.md#branch-and-pr-flow).');
  });

  it('renders the Copilot dialect with the display label and canonical tools', () => {
    const rendered = renderCopilotAgent(specFrom({ label: 'Code Reviewer' }));
    expect(rendered).toContain('name: Code Reviewer');
    expect(rendered).toContain('tools: [read, search, execute]');
    expect(rendered).toContain('user-invocable: true');
    expect(rendered).toMatch(/---\n\nBody text\.\n$/);
  });

  it('renders the Claude dialect with mapped tools and optional memory', () => {
    const withoutMemory = renderClaudeAgent(specFrom());
    expect(withoutMemory).toContain('name: code-reviewer');
    expect(withoutMemory).toContain('tools: Read, Grep, Glob, Bash');
    expect(withoutMemory).toContain('model: inherit');
    expect(withoutMemory).not.toContain('memory:');

    const withMemory = renderClaudeAgent(
      specFrom({ tools: ['read', 'search', 'edit', 'execute', 'todo'], memory: 'project' })
    );
    expect(withMemory).toContain('memory: project');
  });

  it('rejects invalid canonical specs', () => {
    expect(() => validateAgentSpec(specFrom({ name: 'Bad Name' }), 'source')).toThrow(/lowercase/);
    expect(() => validateAgentSpec(specFrom({ tools: ['read'] }), 'source')).toThrow(/search/);
    expect(() => validateAgentSpec(specFrom({ memory: 'shared' }), 'source')).toThrow(/memory/);
  });

  it('plans both dialect files for every canonical agent', () => {
    const outputs = planFleetOutputs([specFrom({ name: 'code-reviewer', label: 'Code Reviewer' })]);
    expect(outputs.map((output) => output.relativePath)).toEqual([
      '.claude/agents/code-reviewer.md',
      '.github/agents/code-reviewer.agent.md'
    ]);
  });

  it('keeps the committed fleet files in sync with the canonical sources', () => {
    const result = generateFleet(repoRoot, { write: false });

    expect(result.specCount).toBeGreaterThanOrEqual(2);
    expect(result.outputs.length).toBe(result.specCount * 2);
    const drifted = result.outputs.filter((output) => output.changed);
    expect(drifted, `drifted: ${drifted.map((o) => o.relativePath).join(', ')}`).toEqual([]);
  });
});
