#!/usr/bin/env node

// Publish safety guard.
//
// Wired into `vscode:prepublish` (which `vsce package` and `vsce publish` both
// run), this aborts packaging when a credential-looking file would ship inside
// the VSIX — the failure mode that once leaked a `PAT.txt` into a published
// build. It scans only the paths vsce actually ships from (the extension root,
// top level only, plus `out/` and `images/`), so `.vscodeignore`-excluded dirs
// such as `docker/` — which legitimately hold a local `.env` — are never
// flagged.
//
// The detection is exported for unit testing; the CLI is a thin wrapper.

const fs = require('node:fs');
const path = require('node:path');

// File names that look like a secret and must never be packaged.
const SECRET_NAME =
  /(^|[._-])(pat|secret|token|credential|password|apikey)s?(\.|$)|\.(pat|pem|key|env|p12|pfx)$|^\.env(\..+)?$|(^|[._-])id_rsa/i;

// Sample/example env files are safe to ship.
const ALLOW = new Set(['.env.example', '.env.sample', '.env.template']);

function isSecretName(name) {
  return !ALLOW.has(name.toLowerCase()) && SECRET_NAME.test(name);
}

/**
 * Returns the POSIX-style relative paths of secret-looking files that would be
 * included in the VSIX, sorted. Scans the extension root at the top level only
 * (nested dirs like `src/`, `docker/`, `scripts/` are excluded by
 * `.vscodeignore`) plus everything under `out/` and `images/`.
 */
function findShippedSecrets(root) {
  const offenders = [];
  const record = (full) => offenders.push(path.relative(root, full).split(path.sep).join('/'));

  const topLevelFiles = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && isSecretName(entry.name)) record(path.join(dir, entry.name));
    }
  };

  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isSecretName(entry.name)) record(full);
    }
  };

  topLevelFiles(root);
  walk(path.join(root, 'out'));
  walk(path.join(root, 'images'));
  return offenders.sort();
}

module.exports = { findShippedSecrets, isSecretName, SECRET_NAME };

if (require.main === module) {
  const offenders = findShippedSecrets(process.cwd());
  if (offenders.length > 0) {
    console.error('\u2716 Refusing to package: credential-looking file(s) would ship in the VSIX:');
    for (const offender of offenders) {
      console.error(`   - ${offender}`);
    }
    console.error(
      'Never keep tokens or keys in the extension folder (vsce login reads the PAT from a prompt). Remove them and retry.'
    );
    process.exit(1);
  }
  console.log('\u2713 guard: no credential-looking files in the package set.');
}
