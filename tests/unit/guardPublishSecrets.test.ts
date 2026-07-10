import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const { findShippedSecrets, isSecretName } = require('../../scripts/guardPublishSecrets.js') as {
  findShippedSecrets: (root: string) => string[];
  isSecretName: (name: string) => boolean;
};

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lvpb-guard-'));
  // A clean, representative package set.
  fs.writeFileSync(path.join(root, 'package.json'), '{}');
  fs.writeFileSync(path.join(root, 'README.md'), '# x');
  fs.mkdirSync(path.join(root, 'out', 'commands'), { recursive: true });
  fs.writeFileSync(path.join(root, 'out', 'extension.js'), '');
  fs.writeFileSync(path.join(root, 'out', 'commands', 'pathUtil.js'), '');
  fs.mkdirSync(path.join(root, 'images'), { recursive: true });
  fs.writeFileSync(path.join(root, 'images', 'icon.png'), '');
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('isSecretName', () => {
  it('flags credential-looking names', () => {
    for (const name of ['PAT.txt', 'my.pat', 'server.pem', 'signing.key', '.env', '.env.local', 'id_rsa', 'token.txt']) {
      expect(isSecretName(name), name).toBe(true);
    }
  });

  it('does not flag ordinary or sample files', () => {
    for (const name of ['package.json', 'pathUtil.js', 'README.md', 'icon.png', '.env.example', 'extension.js']) {
      expect(isSecretName(name), name).toBe(false);
    }
  });
});

describe('findShippedSecrets', () => {
  it('passes a clean package set', () => {
    expect(findShippedSecrets(root)).toEqual([]);
  });

  it('flags a PAT.txt at the extension root', () => {
    fs.writeFileSync(path.join(root, 'PAT.txt'), 'token');
    expect(findShippedSecrets(root)).toEqual(['PAT.txt']);
  });

  it('flags secret files under out/ and images/', () => {
    fs.writeFileSync(path.join(root, 'out', 'signing.pem'), '');
    fs.writeFileSync(path.join(root, 'images', 'deploy.key'), '');
    expect(findShippedSecrets(root)).toEqual(['images/deploy.key', 'out/signing.pem']);
  });

  it('ignores secret files in dirs that .vscodeignore excludes (not shipped)', () => {
    fs.mkdirSync(path.join(root, 'docker', 'windows'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docker', 'windows', '.env'), 'VIPM_SERIAL=x');
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'creds.pem'), '');
    expect(findShippedSecrets(root)).toEqual([]);
  });
});
