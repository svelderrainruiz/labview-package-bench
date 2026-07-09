#!/usr/bin/env node

// PreToolUse guard for the agent fleet (Claude Code).
//
// Wired from `.claude/settings.json` as a `PreToolUse` hook on the Bash tool, it
// converts the branch/push safety rules documented in AGENTS.md and
// CONTRIBUTING.md into mechanical enforcement: the hook reads the tool-call JSON
// from stdin, inspects the git command, and exits 2 (with a reason on stderr) to
// block the call when it would violate branch governance.
//
// The decision logic is exported for unit testing; the CLI is a thin wrapper.

const PROTECTED_BRANCHES = ['develop', 'main'];

function block(reason) {
  return { blocked: true, reason };
}

function targetsProtectedBranch(tokens) {
  return tokens.some((token) =>
    PROTECTED_BRANCHES.some(
      (branch) =>
        token === branch ||
        token === `HEAD:${branch}` ||
        token === `:${branch}` ||
        token === `+${branch}` ||
        token.endsWith(`:${branch}`)
    )
  );
}

function evaluateGitCommand(command) {
  const text = String(command || '').trim();
  if (text.length === 0) {
    return { blocked: false };
  }

  const tokens = text.split(/\s+/);
  const gitIndex = tokens.indexOf('git');
  if (gitIndex === -1) {
    return { blocked: false };
  }

  const rest = tokens.slice(gitIndex + 1);
  const isPush = rest.includes('push');
  const isReset = rest.includes('reset');

  if (rest.includes('--no-verify')) {
    return block('`--no-verify` bypasses required commit/push verification hooks.');
  }

  if (isReset && rest.includes('--hard')) {
    return block('`git reset --hard` discards work irreversibly; stash or stage changes instead.');
  }

  if (isPush) {
    if (rest.includes('--force') || rest.includes('-f')) {
      return block('Force push is blocked; use `--force-with-lease` on a non-protected branch.');
    }
    if (targetsProtectedBranch(rest)) {
      return block(
        'Direct push to a protected branch (develop/main) is blocked; open a PR from a feature branch.'
      );
    }
  }

  return { blocked: false };
}

function evaluateHookInput(input) {
  const command =
    input && typeof input === 'object' && input.tool_input ? input.tool_input.command : undefined;
  return evaluateGitCommand(command);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  const raw = await readStdin();

  let input;
  try {
    input = JSON.parse(raw);
  } catch (_error) {
    // A malformed or empty payload must not block legitimate work.
    return 0;
  }

  const decision = evaluateHookInput(input);
  if (decision.blocked) {
    process.stderr.write(`Blocked by branch-governance guard: ${decision.reason}\n`);
    return 2;
  }

  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  });
}

module.exports = {
  PROTECTED_BRANCHES,
  evaluateGitCommand,
  evaluateHookInput
};
