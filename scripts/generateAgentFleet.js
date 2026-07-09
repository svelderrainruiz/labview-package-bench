#!/usr/bin/env node

// Single-source generator for the vi-history-suite agent fleet.
//
// Canonical agent definitions live in `.github/agent-fleet/<name>.md` and are
// emitted into two runtime dialects from one source of truth:
//   - `.github/agents/<name>.agent.md`  (VS Code / GitHub Copilot)
//   - `.claude/agents/<name>.md`        (Claude Code)
//
// Run `node scripts/generateAgentFleet.js` to (re)write the dialect files, or
// `node scripts/generateAgentFleet.js --check` to fail when they drift from the
// canonical sources (used as a governance gate).

const fs = require('node:fs');
const path = require('node:path');

const { parseFrontmatter } = require('./auditCustomizationGovernance.js');

const FLEET_DIR = '.github/agent-fleet';
const COPILOT_AGENTS_DIR = '.github/agents';
const CLAUDE_AGENTS_DIR = '.claude/agents';

// Canonical capability tokens mirror the Copilot agent tool vocabulary so the
// same list round-trips into both dialects.
const CANONICAL_TOOLS = ['read', 'search', 'edit', 'execute', 'todo'];

const CLAUDE_TOOL_MAP = {
  read: ['Read'],
  search: ['Grep', 'Glob'],
  edit: ['Edit', 'Write'],
  execute: ['Bash'],
  todo: ['TodoWrite']
};

// Stable emission order keeps generated Claude frontmatter deterministic.
const CLAUDE_TOOL_ORDER = ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'TodoWrite'];

const NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function splitAgentDoc(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatterText: '', body: text };
  }
  return { frontmatterText: match[1], body: text.slice(match[0].length) };
}

function scalarValue(frontmatter, key) {
  const value = frontmatter[key];
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return typeof value === 'string' ? value.trim() : '';
}

function arrayValue(frontmatter, key) {
  const value = frontmatter[key];
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return [value.trim()];
  }
  return [];
}

function buildAgentSpec(frontmatter, body) {
  return {
    name: scalarValue(frontmatter, 'name'),
    label: scalarValue(frontmatter, 'label'),
    description: scalarValue(frontmatter, 'description'),
    argumentHint: scalarValue(frontmatter, 'argument-hint'),
    tools: arrayValue(frontmatter, 'tools'),
    model: scalarValue(frontmatter, 'model') || 'inherit',
    memory: scalarValue(frontmatter, 'memory'),
    spawn: arrayValue(frontmatter, 'spawn'),
    userInvocable: scalarValue(frontmatter, 'user-invocable') || 'true',
    body
  };
}

function validateAgentSpec(spec, sourceName) {
  const errors = [];

  if (!NAME_PATTERN.test(spec.name)) {
    errors.push(`name '${spec.name}' must be lowercase letters, digits, and single hyphens`);
  }
  if (!spec.description) {
    errors.push('description must be present and non-empty');
  }
  if (!spec.argumentHint) {
    errors.push('argument-hint must be present and non-empty');
  }
  if (spec.tools.length === 0) {
    errors.push('tools must declare at least one canonical capability');
  }

  const unknownTools = spec.tools.filter((tool) => !CANONICAL_TOOLS.includes(tool));
  if (unknownTools.length > 0) {
    errors.push(`tools include unsupported canonical values: ${unknownTools.join(', ')}`);
  }

  for (const requiredTool of ['read', 'search']) {
    if (!spec.tools.includes(requiredTool)) {
      errors.push(`tools must include '${requiredTool}' so the Copilot dialect stays valid`);
    }
  }

  if (!['true', 'false'].includes(spec.userInvocable)) {
    errors.push("user-invocable must be 'true' or 'false'");
  }
  if (spec.memory && !['user', 'project', 'local'].includes(spec.memory)) {
    errors.push(`memory '${spec.memory}' must be one of user, project, local`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid agent spec in ${sourceName}:\n  - ${errors.join('\n  - ')}`);
  }

  return spec;
}

function toClaudeTools(canonicalTools, spawn = []) {
  const mapped = [];
  for (const tool of canonicalTools) {
    for (const claudeTool of CLAUDE_TOOL_MAP[tool] || []) {
      if (!mapped.includes(claudeTool)) {
        mapped.push(claudeTool);
      }
    }
  }

  const ordered = CLAUDE_TOOL_ORDER.filter((tool) => mapped.includes(tool));
  if (Array.isArray(spawn) && spawn.length > 0) {
    ordered.push(`Agent(${spawn.join(', ')})`);
  }
  return ordered.join(', ');
}

function rewriteRootLinks(body, outputDir) {
  const normalizedDir = toPosixPath(outputDir);
  return body.replace(
    /\]\(@root\/([^)#\s]+)(#[^)\s]*)?\)/g,
    (_whole, targetPath, fragment) => {
      const relativeTarget = path.posix.relative(normalizedDir, targetPath);
      return `](${relativeTarget}${fragment || ''})`;
    }
  );
}

function renderCopilotAgent(spec) {
  const displayName = spec.label || spec.name;
  const body = rewriteRootLinks(spec.body, COPILOT_AGENTS_DIR).trim();
  return [
    '---',
    `name: ${displayName}`,
    `description: ${JSON.stringify(spec.description)}`,
    `argument-hint: ${JSON.stringify(spec.argumentHint)}`,
    `tools: [${spec.tools.join(', ')}]`,
    `user-invocable: ${spec.userInvocable}`,
    '---',
    '',
    body,
    ''
  ].join('\n');
}

function renderClaudeAgent(spec) {
  const body = rewriteRootLinks(spec.body, CLAUDE_AGENTS_DIR).trim();
  const frontmatter = [
    '---',
    `name: ${spec.name}`,
    `description: ${JSON.stringify(spec.description)}`,
    `tools: ${toClaudeTools(spec.tools, spec.spawn)}`,
    `model: ${spec.model}`
  ];
  if (spec.memory) {
    frontmatter.push(`memory: ${spec.memory}`);
  }
  frontmatter.push('---', '', body, '');
  return frontmatter.join('\n');
}

function loadFleetSpecs(cwd) {
  const fleetDir = path.join(cwd, FLEET_DIR);
  if (!fs.existsSync(fleetDir)) {
    return [];
  }

  const files = fs
    .readdirSync(fleetDir)
    .filter((entry) => entry.endsWith('.md'))
    .sort();

  return files.map((entry) => {
    const text = readText(path.join(fleetDir, entry));
    const frontmatter = parseFrontmatter(text);
    const { body } = splitAgentDoc(text);
    return validateAgentSpec(buildAgentSpec(frontmatter, body), `${FLEET_DIR}/${entry}`);
  });
}

function planFleetOutputs(specs) {
  const outputs = [];
  for (const spec of specs) {
    outputs.push({
      relativePath: `${COPILOT_AGENTS_DIR}/${spec.name}.agent.md`,
      content: renderCopilotAgent(spec)
    });
    outputs.push({
      relativePath: `${CLAUDE_AGENTS_DIR}/${spec.name}.md`,
      content: renderClaudeAgent(spec)
    });
  }
  return outputs.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function generateFleet(cwd, options = {}) {
  const specs = loadFleetSpecs(cwd);
  const outputs = planFleetOutputs(specs);

  const results = outputs.map((output) => {
    const absolutePath = path.join(cwd, output.relativePath);
    const current = fs.existsSync(absolutePath) ? readText(absolutePath) : null;
    const changed = current !== output.content;

    if (options.write && changed) {
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, output.content, 'utf8');
    }

    return {
      relativePath: output.relativePath,
      changed,
      existed: current !== null
    };
  });

  return { specCount: specs.length, outputs: results };
}

function parseMainArgs(argv) {
  let cwd;
  let check = false;

  for (const arg of argv) {
    if (arg === '--check') {
      check = true;
      continue;
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option '${arg}'. Supported options: --check [cwd].`);
    }

    if (cwd) {
      throw new Error('Only one cwd argument is supported.');
    }

    cwd = arg;
  }

  return { cwd: cwd || process.cwd(), check };
}

function main(argv = process.argv.slice(2), deps = {}) {
  let parsedArgs;
  try {
    parsedArgs = parseMainArgs(argv);
  } catch (error) {
    (deps.stderr || process.stderr).write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  const cwd = deps.cwd || parsedArgs.cwd;
  const stdout = deps.stdout || process.stdout;
  const stderr = deps.stderr || process.stderr;

  let result;
  try {
    result = generateFleet(cwd, { write: !parsedArgs.check });
  } catch (error) {
    stderr.write(`[agent-fleet] ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  if (parsedArgs.check) {
    const drift = result.outputs.filter((output) => output.changed);
    if (drift.length > 0) {
      stderr.write('[agent-fleet] Generated agents are out of date. Run: npm run fleet:generate\n');
      for (const output of drift) {
        stderr.write(`  - ${output.existed ? 'stale' : 'missing'}: ${output.relativePath}\n`);
      }
      return 1;
    }

    stdout.write(
      `[agent-fleet] Check passed. ${result.outputs.length} generated files match ${result.specCount} canonical agents.\n`
    );
    return 0;
  }

  const changed = result.outputs.filter((output) => output.changed);
  stdout.write(
    `[agent-fleet] Generated ${result.outputs.length} files from ${result.specCount} canonical agents (${changed.length} updated).\n`
  );
  for (const output of changed) {
    stdout.write(`  - ${output.existed ? 'updated' : 'created'}: ${output.relativePath}\n`);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  FLEET_DIR,
  COPILOT_AGENTS_DIR,
  CLAUDE_AGENTS_DIR,
  CANONICAL_TOOLS,
  CLAUDE_TOOL_MAP,
  buildAgentSpec,
  validateAgentSpec,
  toClaudeTools,
  rewriteRootLinks,
  renderCopilotAgent,
  renderClaudeAgent,
  splitAgentDoc,
  loadFleetSpecs,
  planFleetOutputs,
  generateFleet,
  parseMainArgs,
  main
};
