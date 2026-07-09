import { describe, expect, it } from 'vitest';

const { evaluateGitCommand, evaluateHookInput, PROTECTED_BRANCHES } = require(
  '../../scripts/agent-hooks/guardGitBranch.js'
) as {
  evaluateGitCommand: (command: unknown) => { blocked: boolean; reason?: string };
  evaluateHookInput: (input: unknown) => { blocked: boolean; reason?: string };
  PROTECTED_BRANCHES: string[];
};

describe('branch-governance git guard', () => {
  it('protects develop and main', () => {
    expect(PROTECTED_BRANCHES).toEqual(['develop', 'main']);
  });

  it('blocks direct pushes to protected branches', () => {
    for (const command of [
      'git push origin develop',
      'git push origin main',
      'git push origin HEAD:develop',
      'git push origin feature/123-x:develop',
      'git -c core.pager=cat push origin main'
    ]) {
      expect(evaluateGitCommand(command).blocked, command).toBe(true);
    }
  });

  it('blocks force pushes, --no-verify, and hard resets', () => {
    expect(evaluateGitCommand('git push --force origin feature/1-x').blocked).toBe(true);
    expect(evaluateGitCommand('git push -f origin feature/1-x').blocked).toBe(true);
    expect(evaluateGitCommand('git commit --no-verify -m "x"').blocked).toBe(true);
    expect(evaluateGitCommand('git reset --hard HEAD~1').blocked).toBe(true);
  });

  it('allows safe git and non-git commands', () => {
    for (const command of [
      'git push origin feature/123-add-thing',
      'git push --force-with-lease origin feature/1-x',
      'git status',
      'git diff --staged',
      'git log --oneline origin/develop',
      'npm run fleet:check',
      'ls -la'
    ]) {
      expect(evaluateGitCommand(command).blocked, command).toBe(false);
    }
  });

  it('reads the command out of the PreToolUse hook payload', () => {
    expect(evaluateHookInput({ tool_input: { command: 'git push origin develop' } }).blocked).toBe(
      true
    );
    expect(evaluateHookInput({ tool_input: { command: 'git status' } }).blocked).toBe(false);
    expect(evaluateHookInput({}).blocked).toBe(false);
    expect(evaluateHookInput(null).blocked).toBe(false);
  });
});
